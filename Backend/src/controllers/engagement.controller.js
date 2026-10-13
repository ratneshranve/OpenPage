import { config } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { clientIp, humanRef, normalizeEmail, sha256 } from '../utils/helpers.js';
import { Subscriber, Suppression, SupportTicket, ConsentRecord, Order, User } from '../models/index.js';
import { queueEmail, verifyUnsubscribe } from '../services/email.service.js';
import { registerToken, unregisterToken } from '../services/notification.service.js';
import { getSettings } from '../services/settings.service.js';
import { createRefundRequest } from '../services/refund.service.js';
import { describeToken, redeemToken, requestLinksByEmail } from '../services/download.service.js';

// ---- Newsletter (double opt-in) ----
export const subscribe = asyncHandler(async (req, res) => {
    const features = await getSettings('features');
    if (!features.newsletter) throw ApiError.notFound('Newsletter is not available.');
    const email = normalizeEmail(req.body.email);
    const existing = await Subscriber.findOne({ email });
    if (existing?.status === 'subscribed') return ok(res, null, 'Please check your inbox to confirm your subscription.');
    const sub = existing || new Subscriber({ email });
    sub.name = req.body.name || sub.name;
    sub.status = 'pending';
    sub.source = req.body.source || 'newsletter_form';
    sub.consentText = 'Occasional emails about new eBooks and genuine offers. Unsubscribe any time.';
    sub.ip = clientIp(req);
    await sub.save();
    await queueEmail({ to: email, templateKey: 'newsletter_confirmation', type: 'newsletter_confirmation', data: { subscriberId: String(sub._id) }, dedupeKey: `nl-confirm:${sub._id}:${Math.floor(Date.now() / 600000)}` });
    // Same response whether or not the address was already known.
    ok(res, null, 'Please check your inbox to confirm your subscription.');
});

export const confirmSubscription = asyncHandler(async (req, res) => {
    const sub = await Subscriber.findOne({ confirmTokenHash: sha256(String(req.body.token || '')) });
    if (!sub) throw ApiError.badRequest('This confirmation link is invalid or has already been used.');
    sub.status = 'subscribed';
    sub.confirmedAt = new Date();
    sub.consentAt = new Date();
    sub.confirmTokenHash = undefined;
    await sub.save();
    await Suppression.deleteOne({ email: sub.email, reason: 'unsubscribed' });
    ok(res, { email: sub.email }, 'Subscription confirmed.');
});

/** One-click unsubscribe from signed links. Affects marketing only, never receipts or downloads. */
export const unsubscribe = asyncHandler(async (req, res) => {
    const email = verifyUnsubscribe(req.body.e || req.query.e, req.body.s || req.query.s);
    if (!email) throw ApiError.badRequest('This unsubscribe link is not valid.');
    const now = new Date();
    await Subscriber.updateOne({ email }, { $set: { status: 'unsubscribed', unsubscribedAt: now } });
    await User.updateOne({ email }, { $set: { marketingEmails: false }, $push: { consents: { type: 'marketing_email', granted: false, source: 'unsubscribe_link', at: now } } });
    await Suppression.updateOne({ email }, { $setOnInsert: { reason: 'unsubscribed', source: 'unsubscribe_link' } }, { upsert: true });
    ok(res, { email }, 'You have been unsubscribed from marketing emails.');
});

// ---- Browser notifications ----
export const registerNotification = asyncHandler(async (req, res) => {
    const settings = await getSettings('notifications');
    if (!settings.enabled) throw ApiError.notFound('Notifications are not enabled.');
    await registerToken({ ...req.body, user: req.user, userAgent: req.get('user-agent') });
    if (req.user && !req.user.notificationsEnabled) {
        req.user.notificationsEnabled = true;
        req.user.consents.push({ type: 'notifications', granted: true, source: 'browser_prompt' });
        await req.user.save();
    }
    ok(res, null, 'Notifications enabled.');
});

export const unregisterNotification = asyncHandler(async (req, res) => {
    await unregisterToken(req.body);
    ok(res, null, 'Notifications disabled.');
});

// ---- Support ----
export const createTicket = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    let order = null;
    if (req.body.orderNumber) {
        order = await Order.findOne({ orderNumber: String(req.body.orderNumber).trim().toUpperCase() }).lean();
        // Do not reveal whether an order exists for a different email.
        if (order && order.email !== email) order = null;
    }
    const ticket = await SupportTicket.create({
        ticketNumber: humanRef('ST', 7),
        name: req.body.name,
        email,
        user: req.user?._id,
        orderNumber: req.body.orderNumber ? String(req.body.orderNumber).toUpperCase() : undefined,
        order: order?._id,
        category: req.body.category,
        subject: req.body.subject,
        message: req.body.message,
        replies: [{ from: 'customer', message: req.body.message }],
        ip: clientIp(req),
    });
    if (req.body.category === 'refund' && order && ['paid', 'partially_refunded'].includes(order.status)) {
        try {
            const refund = await createRefundRequest({ order, email, user: req.user, reason: req.body.message, category: req.body.refundReason || 'other' });
            await SupportTicket.updateOne({ _id: ticket._id }, { $set: { refundRequest: refund._id } });
        } catch {
            // Existing open refund request: the ticket is still recorded for the team.
        }
    }
    const general = await getSettings('general');
    await queueEmail({ to: email, templateKey: 'support_acknowledgment', type: 'support_acknowledgment', data: { ticketNumber: ticket.ticketNumber, subject: ticket.subject, responseTime: general.responseTime } });
    created(res, { ticketNumber: ticket.ticketNumber }, 'Your message has been sent. We will get back to you soon.');
});

// ---- Consent records ----
export const recordConsent = asyncHandler(async (req, res) => {
    await ConsentRecord.create({ ...req.body, user: req.user?._id, ip: clientIp(req), userAgent: req.get('user-agent')?.slice(0, 300) });
    ok(res, null, 'Preferences saved');
});

// ---- Guest download flow ----
export const describeDownload = asyncHandler(async (req, res) => {
    ok(res, await describeToken(req.params.token));
});

export const downloadFile = async (req, res, next) => {
    try {
        await redeemToken(req.params.token, req, res);
    } catch (err) {
        if (res.headersSent) return next(err);
        // Browsers open this URL directly: send them to the friendly page that explains what happened.
        if (err.statusCode && err.statusCode < 500 && req.accepts(['html', 'json']) === 'html') {
            return res.redirect(302, `${config.frontendUrl}/download/${encodeURIComponent(req.params.token)}?error=${err.statusCode}`);
        }
        next(err);
    }
};

export const requestDownloadLinks = asyncHandler(async (req, res) => {
    await requestLinksByEmail(req.body, queueEmail);
    ok(res, null, 'If we find a matching purchase, we will email fresh download links to that address within a few minutes.');
});
