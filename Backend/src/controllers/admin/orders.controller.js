import mongoose from 'mongoose';
import { Order, Payment, WebhookEvent, EmailMessage, DownloadEvent, Entitlement, RefundRequest, AuditLog } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, paginated, parsePagination } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { queueEmail } from '../../services/email.service.js';
import { reconcileOrder, approveManualOrder, rejectManualOrder } from '../../services/fulfillment.service.js';
import { createRefundRequest, decideRefund, initiateRefund, applyGatewayRefund } from '../../services/refund.service.js';
import { fetchRefund } from '../../services/razorpay.service.js';
import { revokeTokensFor } from '../../services/download.service.js';
import { sendCsv } from './csv.js';

const orderFilter = (q) => {
    const filter = {};
    if (q.status) filter.status = q.status;
    if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
    if (q.deliveryStatus) filter.deliveryStatus = q.deliveryStatus;
    if (q.refundStatus) filter.refundStatus = q.refundStatus;
    if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
    if (q.from || q.to) {
        filter.createdAt = {};
        if (q.from) filter.createdAt.$gte = new Date(q.from);
        if (q.to) filter.createdAt.$lte = new Date(`${q.to}T23:59:59.999Z`);
    }
    if (q.product && mongoose.isValidObjectId(q.product)) filter['items.product'] = new mongoose.Types.ObjectId(q.product);
    if (q.q) {
        const term = String(q.q).trim().slice(0, 100);
        const rx = new RegExp(escapeRegex(term), 'i');
        filter.$or = [{ orderNumber: term.toUpperCase() }, { email: rx }, { 'items.title': rx }, { 'razorpay.orderId': term }, { 'razorpay.paymentId': term }, { 'manualPayment.utr': term }];
    }
    return filter;
};

export const listOrders = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = orderFilter(req.query);
    const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('orderNumber email items.title total currency status paymentStatus deliveryStatus refundStatus createdAt paidAt razorpay.orderId coupon.code paymentMethod manualPayment').lean(),
        Order.countDocuments(filter),
    ]);
    ok(res, paginated(items, total, { page, limit }));
});

export const exportOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find(orderFilter(req.query)).sort({ createdAt: -1 }).limit(10000).lean();
    await audit(req, 'orders.export', { details: { count: orders.length, filter: req.query } });
    sendCsv(res, `orders-${new Date().toISOString().slice(0, 10)}.csv`, [
        ['Order', 'Created', 'Paid at', 'Email', 'Products', 'Subtotal', 'Discount', 'Tax', 'Total', 'Currency', 'Status', 'Payment', 'Delivery', 'Refund', 'Refunded', 'Coupon', 'Razorpay order', 'Razorpay payment', 'Source', 'Medium', 'Campaign'],
        ...orders.map((o) => [
            o.orderNumber, o.createdAt?.toISOString(), o.paidAt?.toISOString() || '', o.email, o.items.map((i) => i.title).join(' | '),
            (o.subtotal || 0) / 100, (o.discountTotal || 0) / 100, (o.tax?.amount || 0) / 100, o.total / 100, o.currency, o.status, o.paymentStatus, o.deliveryStatus, o.refundStatus, (o.refundedAmount || 0) / 100,
            o.coupon?.code || '', o.razorpay?.orderId || '', o.razorpay?.paymentId || '', o.attribution?.source || '', o.attribution?.medium || '', o.attribution?.campaign || '',
        ]),
    ]);
});

export const getOrder = asyncHandler(async (req, res) => {
    const order = await Order.findOne(mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { orderNumber: String(req.params.id).toUpperCase() })
        .populate('user', 'name email status')
        .populate('notes.by', 'name email')
        .lean();
    if (!order) throw ApiError.notFound('Order not found');
    const [payments, webhooks, emails, downloads, entitlements, refunds, auditTrail] = await Promise.all([
        Payment.find({ order: order._id }).sort({ createdAt: 1 }).lean(),
        WebhookEvent.find({ $or: [{ order: order._id }, { razorpayOrderId: order.razorpay?.orderId || '__none__' }] }).sort({ createdAt: 1 }).lean(),
        EmailMessage.find({ order: order._id }).sort({ createdAt: -1 }).select('-data').lean(),
        DownloadEvent.find({ order: order._id }).sort({ createdAt: -1 }).limit(100).lean(),
        Entitlement.find({ order: order._id }).lean(),
        RefundRequest.find({ order: order._id }).sort({ createdAt: -1 }).lean(),
        AuditLog.find({ targetType: 'Order', targetId: String(order._id) }).sort({ createdAt: -1 }).lean(),
    ]);
    ok(res, { order, payments, webhooks, emails, downloads, entitlements: entitlements.map(({ fileKey, ...e }) => e), refunds, audit: auditTrail });
});

export const addNote = asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { $push: { notes: { by: req.user._id, text: req.body.text } } }, { new: true });
    if (!order) throw ApiError.notFound('Order not found');
    await audit(req, 'order.note', { targetType: 'Order', targetId: order._id });
    ok(res, order.notes, 'Note added.');
});

export const resendDelivery = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    if (!['paid', 'partially_refunded'].includes(order.status)) throw ApiError.badRequest('Only paid orders can receive delivery emails.');
    const ents = await Entitlement.find({ order: order._id, status: 'active' }).select('_id').lean();
    if (!ents.length) throw ApiError.badRequest('This order has no active purchases to deliver.');
    await revokeTokensFor(ents.map((e) => e._id));
    const msg = await queueEmail({ to: order.email, templateKey: 'ebook_delivery', type: 'ebook_delivery', order: order._id, data: { orderId: String(order._id) }, dedupeKey: `resend:${order._id}:${Date.now()}` });
    await Order.updateOne({ _id: order._id, deliveryStatus: { $ne: 'sent' } }, { $set: { deliveryStatus: 'queued' } });
    await audit(req, 'order.resend_delivery', { targetType: 'Order', targetId: order._id, details: { emailId: msg?._id } });
    ok(res, null, 'Your download email has been queued.');
});

/**
 * Controlled reconciliation: asks Razorpay for the real state of the payment. There is no way
 * to mark an order paid without a gateway-confirmed captured payment.
 */
export const reconcile = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const before = { status: order.status, paymentStatus: order.paymentStatus };
    const updated = await reconcileOrder(order, 'reconciliation');
    if (updated.status !== before.status) await Order.updateOne({ _id: order._id }, { $set: { reconciledBy: req.user._id } });
    await audit(req, 'order.reconcile', { targetType: 'Order', targetId: order._id, details: { before, after: { status: updated.status, paymentStatus: updated.paymentStatus } } });
    ok(res, { status: updated.status, paymentStatus: updated.paymentStatus }, updated.status === before.status ? 'No change: the gateway state matches our records.' : `Order updated to ${updated.status} from gateway records.`);
});

export const approveManualPayment = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const updated = await approveManualOrder(order, req.user, req.body?.note);
    await audit(req, 'order.approve_manual_payment', { targetType: 'Order', targetId: order._id, details: { utr: order.manualPayment?.utr, note: req.body?.note } });
    ok(res, updated, 'Payment approved! eBook entitlements created and delivery email sent to the customer.');
});

export const rejectManualPayment = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const updated = await rejectManualOrder(order, req.user, req.body?.reason);
    await audit(req, 'order.reject_manual_payment', { targetType: 'Order', targetId: order._id, details: { reason: req.body?.reason } });
    ok(res, updated, 'Order marked as payment failed.');
});

export const setEntitlementStatus = asyncHandler(async (req, res) => {
    const ent = await Entitlement.findById(req.params.entitlementId);
    if (!ent) throw ApiError.notFound('Purchase not found');
    ent.status = req.body.status;
    ent.revokedAt = req.body.status === 'revoked' ? new Date() : undefined;
    ent.revokedReason = req.body.status === 'revoked' ? req.body.reason : undefined;
    await ent.save();
    if (ent.status === 'revoked') await revokeTokensFor([ent._id]);
    await audit(req, `entitlement.${req.body.status === 'revoked' ? 'revoke' : 'restore'}`, { targetType: 'Order', targetId: ent.order, details: { entitlement: ent._id, reason: req.body.reason } });
    ok(res, ent, 'Access updated.');
});

// ---- Payments ----
export const listPayments = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
        const q = String(req.query.q).trim();
        const orders = await Order.find({ $or: [{ orderNumber: q.toUpperCase() }, { email: q.toLowerCase() }] }).select('_id').lean();
        filter.$or = [{ razorpayOrderId: q }, { razorpayPaymentId: q }, { order: { $in: orders.map((o) => o._id) } }];
    }
    const [items, total] = await Promise.all([Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber email status deliveryStatus total').lean(), Payment.countDocuments(filter)]);
    ok(res, paginated(items, total, { page, limit }));
});

export const listWebhookEvents = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.event) filter.event = req.query.event;
    const [items, total] = await Promise.all([WebhookEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber').lean(), WebhookEvent.countDocuments(filter)]);
    ok(res, paginated(items, total, { page, limit }));
});

// ---- Refunds (manual only) ----
export const listRefunds = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = req.query.status ? { status: req.query.status } : {};
    const [items, total] = await Promise.all([
        RefundRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber email total currency status paidAt refundedAmount').lean(),
        RefundRequest.countDocuments(filter),
    ]);
    ok(res, paginated(items, total, { page, limit }));
});

export const getRefund = asyncHandler(async (req, res) => {
    const refund = await RefundRequest.findById(req.params.id).populate('order').populate('decidedBy initiatedBy history.by', 'name email').lean();
    if (!refund) throw ApiError.notFound('Refund request not found');
    const [payment, downloads] = await Promise.all([
        Payment.findOne({ order: refund.order._id, status: { $in: ['captured', 'refunded'] } }).lean(),
        DownloadEvent.countDocuments({ order: refund.order._id, outcome: 'served' }),
    ]);
    ok(res, { refund, payment, downloads });
});

export const createRefundForOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw ApiError.notFound('Order not found');
    const refund = await createRefundRequest({ order, reason: req.body.reason, category: req.body.category, source: 'admin', adminUser: req.user });
    await audit(req, 'refund.create', { targetType: 'Order', targetId: order._id, details: { refund: refund.refundNumber } });
    ok(res, refund, 'Refund request created. Review and approve it to continue.');
});

export const decide = asyncHandler(async (req, res) => {
    const refund = await RefundRequest.findById(req.params.id);
    if (!refund) throw ApiError.notFound('Refund request not found');
    const updated = await decideRefund(refund, req.body, req.user);
    await audit(req, `refund.${req.body.decision}`, { targetType: 'Order', targetId: refund.order, details: { refund: refund.refundNumber, amount: updated.amount, reason: req.body.decisionReason } });
    ok(res, updated, 'Refund request updated.');
});

export const initiate = asyncHandler(async (req, res) => {
    const refund = await RefundRequest.findById(req.params.id);
    if (!refund) throw ApiError.notFound('Refund request not found');
    try {
        const updated = await initiateRefund(refund, req.user);
        await audit(req, 'refund.initiate', { targetType: 'Order', targetId: refund.order, details: { refund: refund.refundNumber, amount: refund.amount, gatewayRefund: updated.razorpayRefundId } });
        ok(res, updated, 'Refund initiated with Razorpay.');
    } catch (err) {
        await audit(req, 'refund.initiate', { targetType: 'Order', targetId: refund.order, outcome: 'failure', details: { refund: refund.refundNumber, error: err.message } });
        throw err;
    }
});

export const syncRefund = asyncHandler(async (req, res) => {
    const refund = await RefundRequest.findById(req.params.id).populate('order', 'razorpay');
    if (!refund?.razorpayRefundId) throw ApiError.badRequest('This refund has not been sent to the gateway.');
    const gateway = await fetchRefund(refund.order.razorpay.paymentId, refund.razorpayRefundId);
    if (gateway.status === 'processed') await applyGatewayRefund(gateway, 'refund.processed');
    else if (gateway.status === 'failed') await applyGatewayRefund(gateway, 'refund.failed');
    else await RefundRequest.updateOne({ _id: refund._id }, { $set: { gatewayStatus: gateway.status } });
    ok(res, { gatewayStatus: gateway.status }, `Gateway status: ${gateway.status}`);
});
