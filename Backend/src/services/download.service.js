import { config } from '../config/env.js';
import { DownloadToken, DownloadEvent, Entitlement, Order, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addMinutes, clientIp, normalizeEmail, randomToken, sha256 } from '../utils/helpers.js';
import { getSettings } from './settings.service.js';
import { sendPrivateFile } from './storage.service.js';

/**
 * Download links are random 256-bit tokens. Only the SHA-256 is stored, each link
 * expires, and each has a usage cap. The private storage location is never exposed.
 */
export const issueDownloadToken = async (entitlement, { issuedFor = 'email', ttlMinutes } = {}) => {
    const settings = await getSettings('downloads');
    const minutes = ttlMinutes || (issuedFor === 'library' ? settings.libraryLinkTtlMinutes : config.downloadLinkTtlMinutes);
    const token = randomToken(32);
    const doc = await DownloadToken.create({
        entitlement: entitlement._id,
        tokenHash: sha256(token),
        expiresAt: addMinutes(new Date(), minutes),
        maxUses: settings.maxUsesPerLink,
        issuedFor,
    });
    return {
        token,
        expiresAt: doc.expiresAt,
        // Email links go to a friendly page that explains expiry; library links go straight to the file.
        url: issuedFor === 'library' ? `${config.apiBaseUrl}/api/v1/downloads/file/${token}` : `${config.frontendUrl}/download/${token}`,
        fileUrl: `${config.apiBaseUrl}/api/v1/downloads/file/${token}`,
    };
};

const findToken = async (token) => {
    if (!token || token.length < 20 || token.length > 100) return null;
    return DownloadToken.findOne({ tokenHash: sha256(token) });
};

/** Inspects a link without consuming it (for the download landing page). */
export const describeToken = async (token) => {
    const doc = await findToken(token);
    if (!doc) return { valid: false, reason: 'not_found' };
    const ent = await Entitlement.findById(doc.entitlement).lean();
    const product = ent ? await Product.findById(ent.product).select('title coverImage format slug').lean() : null;
    const base = { productTitle: ent?.productTitle, coverImage: product?.coverImage?.url, format: product?.format, version: ent?.fileVersion };
    if (doc.revokedAt) return { valid: false, reason: 'replaced', ...base };
    if (doc.expiresAt < new Date()) return { valid: false, reason: 'expired', ...base };
    if (doc.uses >= doc.maxUses) return { valid: false, reason: 'used_up', ...base };
    if (!ent || ent.status !== 'active') return { valid: false, reason: 'access_revoked', ...base };
    return { valid: true, ...base, expiresAt: doc.expiresAt, usesLeft: doc.maxUses - doc.uses, fileUrl: `${config.apiBaseUrl}/api/v1/downloads/file/${token}` };
};

const logEvent = (req, ent, outcome, reason, via) =>
    DownloadEvent.create({
        entitlement: ent?._id,
        order: ent?.order,
        product: ent?.product,
        email: ent?.email,
        via,
        outcome,
        reason,
        ip: clientIp(req),
        userAgent: req.get('user-agent')?.slice(0, 300),
    }).catch(() => {});

/** Consumes one use of a link and streams the purchased file version. */
export const redeemToken = async (token, req, res) => {
    const doc = await findToken(token);
    if (!doc) throw ApiError.notFound('This download link is not valid. Please request a new link.');

    const claimed = await DownloadToken.findOneAndUpdate(
        { _id: doc._id, revokedAt: null, expiresAt: { $gt: new Date() }, $expr: { $lt: ['$uses', '$maxUses'] } },
        { $inc: { uses: 1 } },
        { new: true }
    );
    const ent = await Entitlement.findById(doc.entitlement);
    if (!claimed) {
        await logEvent(req, ent, 'denied', 'link expired or used up', doc.issuedFor);
        throw new ApiError(410, 'This download link has expired or reached its download limit. Please request a new link.', null, 'LINK_EXPIRED');
    }
    if (!ent || ent.status !== 'active') {
        await logEvent(req, ent, 'denied', 'entitlement inactive', doc.issuedFor);
        throw ApiError.forbidden('Access to this purchase is no longer active. Please contact support.');
    }

    const { maxDownloadsPerEntitlementPerDay } = await getSettings('downloads');
    const today = await DownloadEvent.countDocuments({ entitlement: ent._id, outcome: 'served', createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } });
    if (today >= maxDownloadsPerEntitlementPerDay) {
        await logEvent(req, ent, 'denied', 'daily limit', doc.issuedFor);
        throw ApiError.tooMany('This purchase has reached its daily download limit. Please try again tomorrow or contact support.');
    }

    // Serve the file version that was purchased, falling back to the product's current file
    // only if the snapshot is missing (e.g. legacy data).
    let fileKey = ent.fileKey;
    let mime = 'application/pdf';
    const product = await Product.findById(ent.product).select('file slug title').lean();
    if (!fileKey && product?.file?.key) fileKey = product.file.key;
    if (product?.file?.key === fileKey) mime = product.file.mimeType || mime;
    if (!fileKey) throw ApiError.notFound('The file for this product is not available yet. Please contact support.');

    const ext = fileKey.split('.').pop();
    const name = ent.fileName || `${product?.slug || 'ebook'}-v${ent.fileVersion || '1'}.${ext}`;
    await Entitlement.updateOne({ _id: ent._id }, { $inc: { downloadCount: 1 }, $set: { lastDownloadAt: new Date() } });
    await logEvent(req, ent, 'served', null, doc.issuedFor);
    await sendPrivateFile(res, fileKey, name, ext === 'epub' ? 'application/epub+zip' : ext === 'zip' ? 'application/zip' : mime);
};

export const revokeTokensFor = (entitlementIds) => DownloadToken.updateMany({ entitlement: { $in: entitlementIds }, revokedAt: null }, { $set: { revokedAt: new Date() } });

/** Entitlements a signed-in customer may access: their own, plus guest purchases made with their verified email. */
export const entitlementFilterForUser = (user) => ({
    status: 'active',
    $or: [{ user: user._id }, ...(user.emailVerified ? [{ email: normalizeEmail(user.email) }] : [])],
});

export const getUserEntitlement = async (user, entitlementId) => {
    const ent = await Entitlement.findOne({ _id: entitlementId, ...entitlementFilterForUser(user) });
    if (!ent) throw ApiError.notFound('Purchase not found in your library.');
    return ent;
};

/**
 * Emails fresh links for a guest purchase. Always responds the same way so it cannot be
 * used to discover which emails or order numbers exist.
 */
export const requestLinksByEmail = async ({ email, orderNumber }, queueEmail) => {
    email = normalizeEmail(email);
    const filter = { email, status: { $in: ['paid', 'partially_refunded'] } };
    if (orderNumber) filter.orderNumber = String(orderNumber).trim().toUpperCase();
    const orders = await Order.find(filter).sort({ paidAt: -1 }).limit(orderNumber ? 1 : 5).lean();
    for (const order of orders) {
        const ents = await Entitlement.find({ order: order._id, status: 'active' }).select('_id').lean();
        if (!ents.length) continue;
        await revokeTokensFor(ents.map((e) => e._id));
        await queueEmail({
            to: email,
            templateKey: 'download_link_regenerated',
            type: 'download_link_regenerated',
            order: order._id,
            data: { orderId: String(order._id) },
            dedupeKey: `regen:${order._id}:${Math.floor(Date.now() / 60000)}`,
        });
    }
};
