import { Order, RefundRequest, Payment, Entitlement } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatMoney, humanRef } from '../utils/helpers.js';
import { createRefund } from './razorpay.service.js';
import { queueEmail } from './email.service.js';
import { revokeTokensFor } from './download.service.js';

/**
 * Manual refunds only. Nothing in this module runs automatically: refunds are created by a
 * customer request or an admin, and money moves only through initiateRefund(), which is
 * called exclusively from an explicit, audited administrator action.
 */

const STATUS_LABELS = {
    requested: 'Received',
    under_review: 'Under review',
    approved: 'Approved',
    rejected: 'Not approved',
    processing: 'Refund initiated',
    processed: 'Refunded',
    failed: 'Refund failed',
};

const notify = async (refund, order, message) => {
    await queueEmail({
        to: order.email,
        templateKey: 'refund_status',
        type: 'refund_status',
        order: order._id,
        data: {
            refundNumber: refund.refundNumber,
            orderNumber: order.orderNumber,
            statusLabel: STATUS_LABELS[refund.status],
            message,
            amountFormatted: ['processing', 'processed'].includes(refund.status) && refund.amount ? formatMoney(refund.amount, order.currency) : '',
        },
        dedupeKey: `refund:${refund._id}:${refund.status}`,
    });
    await RefundRequest.updateOne({ _id: refund._id }, { $set: { customerNotifiedAt: new Date() } });
};

export const createRefundRequest = async ({ order, email, user, reason, category, source = 'customer', adminUser }) => {
    if (!['paid', 'partially_refunded'].includes(order.status)) throw ApiError.badRequest('Only paid orders can be refunded.');
    const open = await RefundRequest.exists({ order: order._id, status: { $in: ['requested', 'under_review', 'approved', 'processing'] } });
    if (open) throw ApiError.conflict('A refund request for this order is already being reviewed.');
    const refund = await RefundRequest.create({
        refundNumber: humanRef('RF', 8),
        order: order._id,
        email: email || order.email,
        user: user?._id,
        reason,
        category,
        source,
        history: [{ status: 'requested', note: source === 'admin' ? 'Created by administrator' : 'Submitted by customer', by: adminUser?._id }],
    });
    await Order.updateOne({ _id: order._id, refundStatus: 'none' }, { $set: { refundStatus: 'requested' } });
    if (source === 'customer') {
        await queueEmail({
            to: order.email,
            templateKey: 'refund_requested',
            type: 'refund_requested',
            order: order._id,
            data: { refundNumber: refund.refundNumber, orderNumber: order.orderNumber, reason },
            dedupeKey: `refund-ack:${refund._id}`,
        });
    }
    return refund;
};

/** Admin decision: review, approve or reject. Does not move money. */
export const decideRefund = async (refund, { decision, decisionReason, eligibilityNotes, amount, revokeAccess, notifyCustomer }, admin) => {
    const order = await Order.findById(refund.order);
    if (!['requested', 'under_review', 'approved', 'failed'].includes(refund.status)) throw ApiError.badRequest(`A ${refund.status} refund cannot be changed.`);
    const remaining = order.total - (order.refundedAmount || 0);
    if (decision === 'approved') {
        const value = amount ?? remaining;
        if (value <= 0 || value > remaining) throw ApiError.badRequest(`Refund amount must be between ₹0.01 and ${formatMoney(remaining, order.currency)}.`);
        refund.amount = value;
        refund.revokeAccess = Boolean(revokeAccess);
    }
    refund.status = decision;
    refund.decisionReason = decisionReason;
    if (eligibilityNotes !== undefined) refund.eligibilityNotes = eligibilityNotes;
    refund.decidedBy = admin._id;
    refund.decidedAt = new Date();
    refund.history.push({ status: decision, note: decisionReason, by: admin._id });
    await refund.save();
    if (decision === 'rejected') {
        await Order.updateOne({ _id: order._id, refundStatus: 'requested' }, { $set: { refundStatus: order.refundedAmount ? 'partial' : 'none' } });
    }
    if (notifyCustomer && ['rejected', 'under_review', 'approved'].includes(decision)) await notify(refund, order, decisionReason);
    return refund;
};

/** Explicit administrator action that asks Razorpay to refund. */
export const initiateRefund = async (refund, admin) => {
    if (refund.status !== 'approved') throw ApiError.badRequest('Approve the refund request before initiating the refund.');
    const order = await Order.findById(refund.order);
    if (!order.razorpay?.paymentId) throw ApiError.badRequest('This order has no captured gateway payment to refund.');
    const remaining = order.total - (order.refundedAmount || 0);
    if (!refund.amount || refund.amount > remaining) throw ApiError.badRequest('Refund amount exceeds the refundable balance.');

    // Mark as processing first so a double click cannot initiate two refunds.
    const locked = await RefundRequest.findOneAndUpdate({ _id: refund._id, status: 'approved' }, { $set: { status: 'processing', initiatedBy: admin._id, initiatedAt: new Date() } }, { new: true });
    if (!locked) throw ApiError.conflict('This refund is already being processed.');
    try {
        const gateway = await createRefund(order.razorpay.paymentId, {
            amount: refund.amount,
            receipt: refund.refundNumber,
            notes: { refundNumber: refund.refundNumber, orderNumber: order.orderNumber },
        });
        locked.razorpayRefundId = gateway.id;
        locked.gatewayStatus = gateway.status;
        locked.history.push({ status: 'processing', note: `Gateway refund ${gateway.id} (${gateway.status})`, by: admin._id });
        await locked.save();
        await Order.updateOne({ _id: order._id }, { $set: { refundStatus: 'processing' } });
        if (gateway.status === 'processed') await applyGatewayRefund(gateway, 'refund.processed');
        else await notify(locked, order);
        return RefundRequest.findById(locked._id);
    } catch (err) {
        await RefundRequest.updateOne({ _id: locked._id }, { $set: { status: 'failed', failureReason: err.message }, $push: { history: { status: 'failed', note: err.message, by: admin._id } } });
        await Order.updateOne({ _id: order._id }, { $set: { refundStatus: 'failed' } });
        throw err;
    }
};

/**
 * Applies a verified gateway refund state (from a webhook or the gateway API response).
 * Only updates refunds that an administrator initiated; unknown refunds are recorded as ignored.
 */
export const applyGatewayRefund = async (gatewayRefund, event) => {
    const refund = await RefundRequest.findOne({ razorpayRefundId: gatewayRefund.id });
    if (!refund) return false;
    const order = await Order.findById(refund.order);
    if (event === 'refund.processed' && refund.status !== 'processed') {
        const updated = await RefundRequest.findOneAndUpdate(
            { _id: refund._id, status: { $ne: 'processed' } },
            { $set: { status: 'processed', gatewayStatus: 'processed', processedAt: new Date() }, $push: { history: { status: 'processed', note: 'Confirmed by gateway' } } },
            { new: true }
        );
        if (!updated) return true;
        const refundedAmount = (order.refundedAmount || 0) + updated.amount;
        const full = refundedAmount >= order.total;
        await Order.updateOne({ _id: order._id }, { $set: { refundedAmount, refundStatus: full ? 'refunded' : 'partial', status: full ? 'refunded' : 'partially_refunded' } });
        if (full) await Payment.updateOne({ razorpayPaymentId: order.razorpay.paymentId }, { $set: { status: 'refunded' } });
        if (updated.revokeAccess) {
            const ents = await Entitlement.find({ order: order._id, status: 'active' }).select('_id').lean();
            await Entitlement.updateMany({ _id: { $in: ents.map((e) => e._id) } }, { $set: { status: 'revoked', revokedAt: new Date(), revokedReason: `Refund ${updated.refundNumber}` } });
            await revokeTokensFor(ents.map((e) => e._id));
        }
        await notify(updated, order);
    } else if (event === 'refund.failed' && refund.status !== 'failed') {
        await RefundRequest.updateOne({ _id: refund._id }, { $set: { status: 'failed', gatewayStatus: 'failed', failureReason: 'Gateway reported failure' }, $push: { history: { status: 'failed', note: 'Gateway reported failure' } } });
        await Order.updateOne({ _id: order._id }, { $set: { refundStatus: 'failed' } });
        const fresh = await RefundRequest.findById(refund._id);
        await notify(fresh, order, 'We were unable to complete the refund and our team will contact you.');
    } else {
        await RefundRequest.updateOne({ _id: refund._id }, { $set: { gatewayStatus: gatewayRefund.status } });
    }
    return true;
};
