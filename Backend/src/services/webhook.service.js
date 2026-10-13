import { WebhookEvent, Order } from '../models/index.js';
import { applyGatewayPayment } from './fulfillment.service.js';
import { applyGatewayRefund } from './refund.service.js';
import { logger } from '../utils/logger.js';

/**
 * Processes a stored, signature-verified Razorpay webhook event.
 * Handlers are idempotent and tolerate out-of-order delivery: a late payment.failed never
 * downgrades a paid order, and a capture after a failure still completes the order.
 * Refund events only update records; they never initiate a refund.
 */
export const processWebhookEvent = async ({ eventId }) => {
    const evt = await WebhookEvent.findOneAndUpdate(
        { eventId, status: { $in: ['received', 'failed', 'processing'] } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { new: true }
    ).select('+payload');
    if (!evt) return; // already processed or ignored

    try {
        const { event, payload } = evt.payload;
        const payment = payload?.payment?.entity;
        const refund = payload?.refund?.entity;
        let outcome = 'processed';

        if (['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(event) && payment) {
            const order = await Order.findOne({ 'razorpay.orderId': payment.order_id });
            if (!order) {
                // Not one of ours (or created by another integration on the same account).
                outcome = 'ignored';
            } else {
                await applyGatewayPayment(order, payment, 'webhook');
                await WebhookEvent.updateOne({ _id: evt._id }, { $set: { order: order._id } });
            }
        } else if (event.startsWith('refund.') && refund) {
            const handled = await applyGatewayRefund(refund, event);
            if (!handled) outcome = 'ignored';
        } else {
            outcome = 'ignored';
        }
        await WebhookEvent.updateOne({ _id: evt._id }, { $set: { status: outcome, processedAt: new Date(), error: null } });
    } catch (err) {
        await WebhookEvent.updateOne({ _id: evt._id }, { $set: { status: 'failed', error: err.message } });
        logger.error(`Webhook ${eventId} processing failed: ${err.message}`);
        // Mismatched payments need human review (visible in Admin > Payments), not retries.
        if (!err.permanent) throw err;
    }
};

export const summarizeEvent = (body) => ({
    event: body?.event,
    razorpayOrderId: body?.payload?.payment?.entity?.order_id || body?.payload?.order?.entity?.id,
    razorpayPaymentId: body?.payload?.payment?.entity?.id || body?.payload?.refund?.entity?.payment_id,
    eventCreatedAt: body?.created_at ? new Date(body.created_at * 1000) : undefined,
});

