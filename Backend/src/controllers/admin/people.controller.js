import { User, Order, Entitlement, SupportTicket, Subscriber, Suppression, NotificationSubscription, AuditLog, RefreshSession } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, normalizeEmail, paginated, parsePagination } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { revokeAllSessions, forgotPassword } from '../../services/auth.service.js';
import { queueEmail } from '../../services/email.service.js';
import { sendCsv } from './csv.js';

// ---- Customers ----
export const listCustomers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { role: 'customer' };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
        const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
        filter.$or = [{ email: rx }, { name: rx }];
    }
    const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)]);
    const stats = await Order.aggregate([
        { $match: { email: { $in: users.map((u) => u.email) }, status: { $in: ['paid', 'partially_refunded', 'refunded'] } } },
        { $group: { _id: '$email', orders: { $sum: 1 }, value: { $sum: { $subtract: ['$total', { $ifNull: ['$refundedAmount', 0] }] } }, last: { $max: '$paidAt' } } },
    ]);
    const byEmail = Object.fromEntries(stats.map((s) => [s._id, s]));
    ok(res, paginated(users.map((u) => ({ id: u._id, name: u.name, email: u.email, emailVerified: u.emailVerified, status: u.status, marketingEmails: u.marketingEmails, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, orders: byEmail[u.email]?.orders || 0, totalValue: byEmail[u.email]?.value || 0, lastPurchaseAt: byEmail[u.email]?.last })), total, { page, limit }));
});

/** Guest buyers (no account) are listed separately so the team can still find their purchases. */
export const listGuestBuyers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const match = { user: null, status: { $in: ['paid', 'partially_refunded', 'refunded'] } };
    if (req.query.q) match.email = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
    const rows = await Order.aggregate([
        { $match: match },
        { $group: { _id: '$email', orders: { $sum: 1 }, value: { $sum: '$total' }, last: { $max: '$paidAt' } } },
        { $sort: { last: -1 } },
        { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]);
    ok(res, paginated(rows[0].items, rows[0].total[0]?.n || 0, { page, limit }));
});

export const getCustomer = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).lean();
    if (!user || user.role !== 'customer') throw ApiError.notFound('Customer not found');
    const emailFilter = { $or: [{ user: user._id }, { email: user.email }] };
    const [orders, entitlements, tickets, subscriber, push, sessions] = await Promise.all([
        Order.find(emailFilter).sort({ createdAt: -1 }).limit(100).select('orderNumber total currency status deliveryStatus refundStatus createdAt paidAt').lean(),
        Entitlement.find(emailFilter).select('productTitle status fileVersion downloadCount grantedAt order').lean(),
        SupportTicket.find({ $or: [{ user: user._id }, { email: user.email }] }).sort({ createdAt: -1 }).select('ticketNumber subject category status createdAt').lean(),
        Subscriber.findOne({ email: user.email }).lean(),
        NotificationSubscription.countDocuments({ user: user._id, active: true }),
        RefreshSession.countDocuments({ user: user._id, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);
    const paid = orders.filter((o) => ['paid', 'partially_refunded', 'refunded'].includes(o.status));
    const { passwordHash, tokenVersion, ...safe } = user;
    ok(res, {
        customer: safe,
        orders,
        entitlements,
        tickets,
        newsletter: subscriber ? { status: subscriber.status, consentAt: subscriber.consentAt, source: subscriber.source } : null,
        notificationSubscriptions: push,
        activeSessions: sessions,
        totals: { orders: paid.length, value: paid.reduce((s, o) => s + o.total, 0) },
    });
});

export const setCustomerStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'customer') throw ApiError.notFound('Customer not found');
    user.status = req.body.status;
    user.suspendedReason = req.body.status === 'suspended' ? req.body.reason : undefined;
    await user.save();
    if (user.status === 'suspended') await revokeAllSessions(user._id);
    await audit(req, `customer.${req.body.status === 'suspended' ? 'suspend' : 'reactivate'}`, { targetType: 'User', targetId: user._id, details: { reason: req.body.reason } });
    ok(res, { status: user.status }, req.body.status === 'suspended' ? 'Account suspended and signed out everywhere.' : 'Account reactivated.');
});

export const customerRecovery = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'customer') throw ApiError.notFound('Customer not found');
    const { action } = req.body;
    if (action === 'send_password_reset') await forgotPassword(user.email);
    else if (action === 'revoke_sessions') await revokeAllSessions(user._id);
    else if (action === 'resend_verification' && !user.emailVerified) await queueEmail({ to: user.email, templateKey: 'account_verification', type: 'account_verification', user: user._id, data: { userId: String(user._id) } });
    else throw ApiError.badRequest('Unknown action');
    await audit(req, `customer.${action}`, { targetType: 'User', targetId: user._id });
    ok(res, null, 'Done.');
});

// ---- Subscribers & suppression ----
export const listSubscribers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.email = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
    const [items, total, counts] = await Promise.all([
        Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-confirmTokenHash -ip').lean(),
        Subscriber.countDocuments(filter),
        Subscriber.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    ok(res, { ...paginated(items, total, { page, limit }), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

export const exportSubscribers = asyncHandler(async (req, res) => {
    const subs = await Subscriber.find({ status: 'subscribed' }).sort({ createdAt: -1 }).lean();
    await audit(req, 'subscribers.export', { details: { count: subs.length } });
    sendCsv(res, `subscribers-${new Date().toISOString().slice(0, 10)}.csv`, [['Email', 'Name', 'Status', 'Source', 'Consent at', 'Confirmed at'], ...subs.map((s) => [s.email, s.name || '', s.status, s.source, s.consentAt?.toISOString() || '', s.confirmedAt?.toISOString() || ''])]);
});

export const unsubscribeSubscriber = asyncHandler(async (req, res) => {
    const sub = await Subscriber.findByIdAndUpdate(req.params.id, { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } }, { new: true });
    if (!sub) throw ApiError.notFound('Subscriber not found');
    await Suppression.updateOne({ email: sub.email }, { $setOnInsert: { reason: 'manual', source: 'admin' } }, { upsert: true });
    await audit(req, 'subscriber.unsubscribe', { targetType: 'Subscriber', targetId: sub._id });
    ok(res, sub, 'Subscriber removed from marketing.');
});

export const listSuppressions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = req.query.q ? { email: new RegExp(escapeRegex(String(req.query.q)), 'i') } : {};
    const [items, total] = await Promise.all([Suppression.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Suppression.countDocuments(filter)]);
    ok(res, paginated(items, total, { page, limit }));
});

export const addSuppression = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    await Suppression.updateOne({ email }, { $set: { reason: req.body.reason || 'manual', source: 'admin' } }, { upsert: true });
    await audit(req, 'suppression.add', { details: { email } });
    ok(res, null, 'Address suppressed from marketing.');
});

export const removeSuppression = asyncHandler(async (req, res) => {
    const s = await Suppression.findByIdAndDelete(req.params.id);
    await audit(req, 'suppression.remove', { details: { email: s?.email } });
    ok(res, null, 'Suppression removed. Marketing still requires the person’s consent.');
});

// ---- Support ----
export const listTickets = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) {
        const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
        filter.$or = [{ email: rx }, { ticketNumber: String(req.query.q).toUpperCase() }, { subject: rx }, { orderNumber: String(req.query.q).toUpperCase() }];
    }
    const [items, total, counts] = await Promise.all([
        SupportTicket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).select('-replies -internalNotes -ip').lean(),
        SupportTicket.countDocuments(filter),
        SupportTicket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    ok(res, { ...paginated(items, total, { page, limit }), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

export const getTicket = asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id).populate('replies.by internalNotes.by', 'name email').populate('order', 'orderNumber status total currency').populate('refundRequest', 'refundNumber status').lean();
    if (!ticket) throw ApiError.notFound('Ticket not found');
    ok(res, ticket);
});

export const replyTicket = asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    ticket.replies.push({ from: 'admin', by: req.user._id, message: req.body.message });
    ticket.status = req.body.status || 'pending';
    await ticket.save();
    await queueEmail({ to: ticket.email, templateKey: 'support_reply', type: 'support_reply', data: { ticketNumber: ticket.ticketNumber, message: req.body.message } });
    await audit(req, 'support.reply', { targetType: 'SupportTicket', targetId: ticket._id });
    ok(res, ticket, 'Reply sent.');
});

export const updateTicket = asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw ApiError.notFound('Ticket not found');
    if (req.body.status) ticket.status = req.body.status;
    if (req.body.priority) ticket.priority = req.body.priority;
    if (req.body.note) ticket.internalNotes.push({ by: req.user._id, text: req.body.note });
    await ticket.save();
    await audit(req, 'support.update', { targetType: 'SupportTicket', targetId: ticket._id, details: { status: req.body.status, priority: req.body.priority } });
    ok(res, ticket, 'Ticket updated.');
});

// ---- Audit logs & admin account ----
export const listAuditLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
    const filter = {};
    if (req.query.action) filter.action = new RegExp(`^${escapeRegex(String(req.query.action))}`);
    if (req.query.targetType) filter.targetType = req.query.targetType;
    if (req.query.targetId) filter.targetId = req.query.targetId;
    if (req.query.outcome) filter.outcome = req.query.outcome;
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
    ok(res, paginated(items, total, { page, limit }));
});

export const adminSessions = asyncHandler(async (req, res) => {
    const sessions = await RefreshSession.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).select('userAgent ip createdAt lastUsedAt').lean();
    const logins = await AuditLog.find({ action: 'admin.login', $or: [{ actor: req.user._id }, { 'details.email': req.user.email }] }).sort({ createdAt: -1 }).limit(20).lean();
    ok(res, { sessions, logins });
});

export const updateAdminProfile = asyncHandler(async (req, res) => {
    req.user.name = req.body.name;
    await req.user.save();
    await audit(req, 'admin.profile_update', { targetType: 'User', targetId: req.user._id });
    ok(res, { user: req.user.toSafeJSON() }, 'Profile updated.');
});
