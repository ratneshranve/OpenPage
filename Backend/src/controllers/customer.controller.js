import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizeEmail, paginated, parsePagination } from '../utils/helpers.js';
import { Order, Entitlement, Product, Review, RefundRequest, SupportTicket, Subscriber, Suppression, NotificationSubscription } from '../models/index.js';
import { entitlementFilterForUser, getUserEntitlement, issueDownloadToken, revokeTokensFor } from '../services/download.service.js';
import { queueEmail } from '../services/email.service.js';
import { linkGuestPurchases } from '../services/auth.service.js';
import { createRefundRequest } from '../services/refund.service.js';

const orderFilterForUser = (user) => ({ $or: [{ user: user._id }, ...(user.emailVerified ? [{ email: user.email }] : [])] });

export const getMe = asyncHandler(async (req, res) => {
    const [orders, library, subscriber, pushCount] = await Promise.all([
        Order.countDocuments({ ...orderFilterForUser(req.user), status: { $in: ['paid', 'partially_refunded', 'refunded'] } }),
        Entitlement.countDocuments(entitlementFilterForUser(req.user)),
        Subscriber.findOne({ email: req.user.email }).select('status').lean(),
        NotificationSubscription.countDocuments({ user: req.user._id, active: true }),
    ]);
    ok(res, { user: req.user.toSafeJSON(), stats: { orders, library }, newsletter: subscriber?.status || 'none', pushSubscriptions: pushCount });
});

export const updateMe = asyncHandler(async (req, res) => {
    if (req.body.name !== undefined) req.user.name = req.body.name;
    await req.user.save();
    ok(res, { user: req.user.toSafeJSON() }, 'Profile updated');
});

export const updatePreferences = asyncHandler(async (req, res) => {
    const { marketingEmails, notificationsEnabled } = req.body;
    const now = new Date();
    if (marketingEmails !== undefined && marketingEmails !== req.user.marketingEmails) {
        req.user.marketingEmails = marketingEmails;
        req.user.consents.push({ type: 'marketing_email', granted: marketingEmails, source: 'account_preferences', at: now });
        if (marketingEmails) await Suppression.deleteOne({ email: req.user.email, reason: 'unsubscribed' });
        else {
            await Subscriber.updateOne({ email: req.user.email }, { $set: { status: 'unsubscribed', unsubscribedAt: now } });
            await Suppression.updateOne({ email: req.user.email }, { $setOnInsert: { reason: 'unsubscribed', source: 'account_preferences' } }, { upsert: true });
        }
    }
    if (notificationsEnabled !== undefined) {
        req.user.notificationsEnabled = notificationsEnabled;
        req.user.consents.push({ type: 'notifications', granted: notificationsEnabled, source: 'account_preferences', at: now });
        if (!notificationsEnabled) await NotificationSubscription.updateMany({ user: req.user._id }, { $set: { active: false } });
    }
    await req.user.save();
    ok(res, { user: req.user.toSafeJSON() }, 'Preferences saved');
});

export const listOrders = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });
    const filter = { ...orderFilterForUser(req.user), status: { $in: ['paid', 'partially_refunded', 'refunded', 'pending', 'failed'] } };
    const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('orderNumber items.title items.slug items.coverImage total currency status deliveryStatus refundStatus createdAt paidAt').lean(),
        Order.countDocuments(filter),
    ]);
    ok(res, paginated(items, total, { page, limit }));
});

export const getOrder = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.params.orderId).toUpperCase(), ...orderFilterForUser(req.user) })
        .select('-ip -notes -attribution -reconciledBy -checkoutSession')
        .lean();
    if (!order) throw ApiError.notFound('Order not found.');
    const [entitlements, refunds] = await Promise.all([
        Entitlement.find({ order: order._id }).select('product productTitle status fileVersion downloadCount lastDownloadAt').lean(),
        RefundRequest.find({ order: order._id }).select('refundNumber status amount reason createdAt processedAt').lean(),
    ]);
    ok(res, { order, entitlements, refunds });
});

export const library = asyncHandler(async (req, res) => {
    const ents = await Entitlement.find(entitlementFilterForUser(req.user)).sort({ grantedAt: -1 }).lean();
    const products = await Product.find({ _id: { $in: ents.map((e) => e.product) } }).select('title slug coverImage format file.version file.format status author').lean();
    const reviews = await Review.find({ entitlement: { $in: ents.map((e) => e._id) } }).select('entitlement rating status').lean();
    const orders = await Order.find({ _id: { $in: ents.map((e) => e.order) } }).select('orderNumber paidAt').lean();
    ok(
        res,
        ents.map((e) => {
            const p = products.find((x) => String(x._id) === String(e.product));
            const o = orders.find((x) => String(x._id) === String(e.order));
            return {
                id: e._id,
                productId: e.product,
                title: p?.title || e.productTitle,
                slug: p?.status === 'published' ? p.slug : null,
                author: p?.author,
                coverImage: p?.coverImage?.url,
                format: p?.file?.format || p?.format,
                purchasedVersion: e.fileVersion,
                latestVersion: p?.file?.version,
                downloadCount: e.downloadCount,
                lastDownloadAt: e.lastDownloadAt,
                grantedAt: e.grantedAt,
                orderNumber: o?.orderNumber,
                review: reviews.find((r) => String(r.entitlement) === String(e._id)) || null,
            };
        })
    );
});

/** Issues a short-lived direct download URL for a library item. */
export const createDownload = asyncHandler(async (req, res) => {
    const ent = await getUserEntitlement(req.user, req.params.entitlementId);
    const { fileUrl, expiresAt } = await issueDownloadToken(ent, { issuedFor: 'library' });
    ok(res, { url: fileUrl, expiresAt });
});

export const regenerateDownload = asyncHandler(async (req, res) => {
    const ent = await getUserEntitlement(req.user, req.params.entitlementId);
    await revokeTokensFor([ent._id]);
    await queueEmail({
        to: ent.email,
        templateKey: 'download_link_regenerated',
        type: 'download_link_regenerated',
        order: ent.order,
        data: { orderId: String(ent.order), entitlementIds: [String(ent._id)] },
        dedupeKey: `regen:${ent._id}:${Math.floor(Date.now() / 60000)}`,
    });
    ok(res, null, 'A new download link has been emailed to you.');
});

/**
 * Links a guest purchase to the account. Requires the account email to be verified and to
 * match the purchase email, so knowing an order number alone is never enough.
 */
export const claimPurchase = asyncHandler(async (req, res) => {
    if (!req.user.emailVerified) throw ApiError.forbidden('Please confirm your account email first. We sent you a verification link.');
    const order = await Order.findOne({ orderNumber: String(req.body.orderNumber).trim().toUpperCase() });
    if (!order || order.email !== normalizeEmail(req.user.email)) {
        throw ApiError.notFound('We could not find a purchase with that order number for your verified email address.');
    }
    const linked = await linkGuestPurchases(req.user);
    ok(res, { linked }, 'Purchase added to your library.');
});

export const submitReview = asyncHandler(async (req, res) => {
    const ent = await getUserEntitlement(req.user, req.params.entitlementId);
    const review = await Review.findOneAndUpdate(
        { entitlement: ent._id },
        { $set: { product: ent.product, user: req.user._id, email: ent.email, displayName: req.body.displayName || req.user.name?.split(' ')[0] || 'Verified buyer', rating: req.body.rating, title: req.body.title, body: req.body.body, status: 'pending' } },
        { upsert: true, new: true }
    );
    created(res, review, 'Thank you! Your review will appear after moderation.');
});

export const requestRefund = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderNumber: String(req.params.orderId).toUpperCase(), ...orderFilterForUser(req.user) });
    if (!order) throw ApiError.notFound('Order not found.');
    const refund = await createRefundRequest({ order, user: req.user, reason: req.body.reason, category: req.body.category });
    created(res, { refundNumber: refund.refundNumber, status: refund.status }, 'Refund request submitted.');
});

export const mySupportTickets = asyncHandler(async (req, res) => {
    const tickets = await SupportTicket.find({ $or: [{ user: req.user._id }, ...(req.user.emailVerified ? [{ email: req.user.email }] : [])] })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('ticketNumber subject category status createdAt replies')
        .lean();
    ok(res, tickets);
});
