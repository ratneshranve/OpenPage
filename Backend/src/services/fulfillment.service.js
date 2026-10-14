import { Order, Payment, Entitlement, Product, Offer, OfferRedemption, CheckoutSession, EmailMessage, User } from '../models/index.js';
import { queueEmail } from './email.service.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Validates a Razorpay payment entity against our order. Any mismatch means the payment
 * does not belong to this order and must not grant access.
 */
const mismatch = (message) => Object.assign(new Error(message), { permanent: true });
const assertMatches = (order, payment) => {
    if (payment.order_id !== order.razorpay?.orderId) throw mismatch(`Payment ${payment.id} belongs to gateway order ${payment.order_id}, expected ${order.razorpay?.orderId}`);
    if (Number(payment.amount) !== Number(order.total)) throw mismatch(`Amount mismatch for ${order.orderNumber}: paid ${payment.amount}, expected ${order.total}`);
    if (String(payment.currency).toUpperCase() !== String(order.currency).toUpperCase()) throw mismatch(`Currency mismatch for ${order.orderNumber}`);
};

const upsertPayment = async (order, payment, via, signatureVerified = false) => {
    const status = ['captured', 'authorized', 'failed', 'refunded'].includes(payment.status) ? payment.status : 'created';
    const update = {
        $set: {
            order: order._id,
            razorpayOrderId: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            fee: payment.fee,
            gatewayTax: payment.tax,
            errorCode: payment.error_code || undefined,
            errorDescription: payment.error_description || undefined,
            errorReason: payment.error_reason || undefined,
            raw: payment,
        },
        $addToSet: { verifiedVia: via },
    };
    // Never move a captured payment backwards because of a late/out-of-order event.
    const existing = await Payment.findOne({ razorpayPaymentId: payment.id }).lean();
    if (!existing || existing.status !== 'captured' || status === 'refunded') update.$set.status = status;
    if (status === 'captured') update.$set.capturedAt = payment.captured_at ? new Date(payment.captured_at * 1000) : new Date();
    if (status === 'failed') update.$set.failedAt = new Date();
    if (signatureVerified) update.$set.signatureVerified = true;
    return Payment.findOneAndUpdate({ razorpayPaymentId: payment.id }, update, { upsert: true, new: true });
};

/** Grants access and starts delivery. Idempotent: safe for duplicate callbacks and webhooks. */
export const markPaid = async (order, payment, via) => {
    const isManual = payment?.method === 'manual_upi' || order.paymentMethod === 'manual_upi';
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: { $in: ['pending', 'failed', 'cancelled'] } },
        {
            $set: {
                status: 'paid',
                paymentStatus: 'paid',
                paidAt: new Date(),
                paymentMethod: isManual ? 'manual_upi' : 'razorpay',
                ...(payment?.id ? { 'razorpay.paymentId': payment.id } : {}),
                ...(payment?.method ? { 'razorpay.method': payment.method } : {}),
                failureReason: null,
            },
        },
        { new: true }
    );
    const fresh = Boolean(updated);
    const current = updated || (await Order.findById(order._id));
    if (!['paid', 'partially_refunded'].includes(current.status)) return current;

    // Link to an account owned by the same verified email, if one exists.
    if (!current.user) {
        const owner = await User.findOne({ email: current.email, emailVerified: true }).select('_id').lean();
        if (owner) await Order.updateOne({ _id: current._id }, { $set: { user: owner._id } });
        current.user = owner?._id;
    }

    // Entitlements snapshot the file version that was purchased.
    const products = await Product.find({ _id: { $in: current.items.map((i) => i.product) } }).select('file title slug').lean();
    for (const item of current.items) {
        const product = products.find((p) => String(p._id) === String(item.product));
        try {
            await Entitlement.updateOne(
                { order: current._id, product: item.product },
                {
                    $setOnInsert: {
                        user: current.user,
                        email: current.email,
                        productTitle: item.title,
                        fileKey: product?.file?.key,
                        fileVersion: product?.file?.version || item.fileVersion,
                        fileName: product?.file ? `${product.slug}-v${product.file.version}.${product.file.key.split('.').pop()}` : undefined,
                        grantedAt: new Date(),
                    },
                },
                { upsert: true }
            );
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }

    if (fresh) {
        await Product.bulkWrite(current.items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { salesCount: 1 } } } })));
        for (const offerId of current.offersApplied || []) {
            const discount = current.items.filter((i) => String(i.appliedOffer) === String(offerId)).reduce((s, i) => s + i.discount, 0);
            try {
                await OfferRedemption.create({ offer: offerId, order: current._id, email: current.email, discount, orderTotal: current.total });
                await Offer.updateOne({ _id: offerId }, { $inc: { redemptionCount: 1 } });
            } catch (err) {
                if (err.code !== 11000) logger.error(`Offer redemption record failed: ${err.message}`);
            }
        }
        if (current.checkoutSession) {
            await CheckoutSession.updateOne({ _id: current.checkoutSession }, { $set: { status: 'converted', convertedOrder: current._id } });
        }
        // Cancel any reminder emails still waiting for this customer.
        await EmailMessage.updateMany({ to: current.email, status: 'queued', type: 'abandoned_checkout' }, { $set: { status: 'cancelled', lastError: 'Customer completed purchase' } });
        await EmailMessage.updateMany({ order: current._id, status: 'queued', type: { $in: ['payment_failed', 'payment_pending'] } }, { $set: { status: 'cancelled', lastError: 'Payment succeeded' } });
        logger.info(`Order ${current.orderNumber} paid via ${via}`);
    }

    // Delivery email. The dedupe key guarantees one delivery job per order.
    const msg = await queueEmail({
        to: current.email,
        templateKey: 'order_confirmation',
        type: 'order_delivery',
        order: current._id,
        user: current.user,
        data: { orderId: String(current._id) },
        dedupeKey: `delivery:${current._id}`,
    });
    if (msg && current.deliveryStatus === 'not_started') {
        await Order.updateOne({ _id: current._id, deliveryStatus: 'not_started' }, { $set: { deliveryStatus: msg.status === 'sent' ? 'sent' : 'queued' } });
    }
    return Order.findById(current._id);
};

const markFailed = async (order, payment) => {
    const reason = payment.error_description || payment.error_reason || 'Payment failed';
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: 'pending' },
        { $set: { status: 'failed', paymentStatus: 'failed', failureReason: reason } },
        { new: true }
    );
    if (updated) {
        await queueEmail({
            to: updated.email,
            templateKey: 'payment_failed',
            type: 'payment_failed',
            order: updated._id,
            data: { orderNumber: updated.orderNumber, reason, retryUrl: `${config.frontendUrl}/checkout` },
            dedupeKey: `payfail:${updated._id}`,
            // Short delay: if the customer retries successfully, the email is cancelled.
            sendAt: new Date(Date.now() + 10 * 60 * 1000),
        });
    }
    return updated || order;
};

/**
 * Applies a gateway payment to an order. `via` records which channel confirmed it.
 * Payment state is always taken from the gateway's payment entity, never from the browser.
 */
export const applyGatewayPayment = async (order, payment, via, { signatureVerified = false } = {}) => {
    assertMatches(order, payment);
    await upsertPayment(order, payment, via, signatureVerified);
    if (payment.status === 'captured') return markPaid(order, payment, via);
    if (payment.status === 'authorized') {
        // Auto-capture is enabled on the gateway order; capture normally follows within seconds.
        await Order.updateOne({ _id: order._id, status: 'pending' }, { $set: { paymentStatus: 'pending' } });
        return Order.findById(order._id);
    }
    if (payment.status === 'failed') return markFailed(order, payment);
    return order;
};

/** Pulls the latest state from Razorpay for an order (browser closed, webhook delayed, admin reconcile). */
export const reconcileOrder = async (order, via = 'reconciliation') => {
    if (!order.razorpay?.orderId) return order;
    const { fetchOrderPayments } = await import('./razorpay.service.js');
    const payments = await fetchOrderPayments(order.razorpay.orderId);
    const captured = payments.find((p) => p.status === 'captured');
    if (captured) return applyGatewayPayment(order, captured, via);
    const authorized = payments.find((p) => p.status === 'authorized');
    if (authorized) return applyGatewayPayment(order, authorized, via);
    const failed = payments.filter((p) => p.status === 'failed');
    for (const p of failed) await upsertPayment(order, p, via);
    if (payments.length) await Order.updateOne({ _id: order._id, paymentStatus: 'created' }, { $set: { paymentStatus: 'attempted' } });
    return Order.findById(order._id);
};

/**
 * Manually approves a pending UPI or offline order from the Admin panel.
 * Records the admin reviewer, marks payment as captured, issues entitlements, and sends delivery email.
 */
export const approveManualOrder = async (order, adminUser, note) => {
    if (!['pending', 'failed'].includes(order.status)) {
        throw ApiError.badRequest('Only pending or failed orders can be approved.');
    }
    const utr = order.manualPayment?.utr || `UPI-MANUAL-${Date.now()}`;
    await Payment.findOneAndUpdate(
        { order: order._id },
        {
            $set: {
                amount: order.total,
                currency: order.currency,
                status: 'captured',
                method: 'manual_upi',
                signatureVerified: true,
                capturedAt: new Date(),
                verifiedVia: ['admin_manual_approval'],
            },
        },
        { upsert: true, new: true }
    );

    const updateDoc = {
        'manualPayment.approvedAt': new Date(),
        'manualPayment.approvedBy': adminUser._id,
    };
    if (note) {
        await Order.updateOne({ _id: order._id }, { $push: { notes: { by: adminUser._id, text: `Manual payment approved: ${note}` } } });
    }
    await Order.updateOne({ _id: order._id }, { $set: updateDoc });

    return markPaid(order, { id: utr, method: 'manual_upi' }, 'admin_manual_approval');
};

/**
 * Rejects a manual payment when UTR is invalid or payment not received.
 */
export const rejectManualOrder = async (order, adminUser, reason) => {
    if (order.status !== 'pending') {
        throw ApiError.badRequest('Only pending orders can be rejected.');
    }
    const reasonText = reason || 'Manual payment could not be verified with bank records';
    const update = {
        $set: {
            status: 'failed',
            paymentStatus: 'failed',
            failureReason: reasonText,
            'manualPayment.rejectedAt': new Date(),
            'manualPayment.rejectedReason': reasonText,
        },
    };
    if (reason) {
        update.$push = { notes: { by: adminUser._id, text: `Manual payment rejected: ${reason}` } };
    }
    const updated = await Order.findByIdAndUpdate(order._id, update, { new: true });
    return updated;
};
