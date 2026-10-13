import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { clientIp, sha256 } from '../utils/helpers.js';
import * as checkout from '../services/checkout.service.js';
import { sendCheckoutOtp, verifyCheckoutOtp } from '../services/otp.service.js';
import { priceCart } from '../services/pricing.service.js';
import { Order, WebhookEvent } from '../models/index.js';
import { verifyCheckoutSignature, fetchPayment, verifyWebhookSignature } from '../services/razorpay.service.js';
import { applyGatewayPayment } from '../services/fulfillment.service.js';
import { enqueueJob, runJobNow } from '../jobs/queue.js';
import { summarizeEvent } from '../services/webhook.service.js';
import { logger } from '../utils/logger.js';

const sessionToken = (req) => req.get('x-checkout-session') || req.body?.sessionToken || req.query?.sessionToken;

export const createSession = asyncHandler(async (req, res) => {
    const result = await checkout.createSession({ ...req.body, user: req.user, ip: clientIp(req) });
    created(res, result, 'Checkout started');
});

export const getSession = asyncHandler(async (req, res) => {
    const session = await checkout.findSession(sessionToken(req));
    ok(res, await checkout.getSessionView(session));
});

export const updateSession = asyncHandler(async (req, res) => {
    const session = await checkout.findSession(sessionToken(req));
    ok(res, await checkout.updateSession(session, req.body));
});

export const resumeSession = asyncHandler(async (req, res) => {
    ok(res, await checkout.resumeSession({ ...req.body, ip: clientIp(req) }));
});

export const sendOtp = asyncHandler(async (req, res) => {
    const session = await checkout.findSession(sessionToken(req));
    const result = await sendCheckoutOtp(session, req.body.email, clientIp(req));
    ok(res, result, 'Email verification code sent.');
});

export const verifyOtp = asyncHandler(async (req, res) => {
    const session = await checkout.findSession(sessionToken(req));
    const result = await verifyCheckoutOtp(session, req.body.email, req.body.code);
    const fresh = await checkout.findSession(sessionToken(req));
    ok(res, { ...result, session: await checkout.getSessionView(fresh) }, 'Your email has been verified.');
});

/** Cart/coupon quote. Works with or without a checkout session; prices always come from the DB. */
export const validateCoupon = asyncHandler(async (req, res) => {
    const token = sessionToken(req);
    if (token) {
        const session = await checkout.findSession(token);
        if (req.body.productIds) session.items = req.body.productIds.map((product) => ({ product }));
        const quote = await checkout.quoteForSession(session, req.body.couponCode ?? null);
        return ok(res, quote);
    }
    ok(res, await priceCart({ productIds: req.body.productIds || [], couponCode: req.body.couponCode }));
});

export const createOrder = asyncHandler(async (req, res) => {
    const session = await checkout.findSession(sessionToken(req));
    const result = await checkout.createOrder(session, req.body, { user: req.user, ip: clientIp(req) });
    created(res, result, 'Order created');
});

export const orderStatus = asyncHandler(async (req, res) => {
    ok(res, await checkout.getOrderStatus(req.params.orderId, { sessionToken: sessionToken(req), user: req.user }));
});

export const conversionTracked = asyncHandler(async (req, res) => {
    await checkout.markConversionTracked(req.params.orderId, { sessionToken: sessionToken(req), user: req.user });
    ok(res, null);
});

/**
 * Checkout callback. The signature proves the browser received these IDs from Razorpay;
 * the payment's actual state and amount are then fetched from Razorpay server-to-server.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
        logger.warn(`Invalid checkout signature for gateway order ${orderId}`);
        throw ApiError.badRequest('We could not verify this payment. If money was debited, it will be confirmed automatically or refunded by the bank.');
    }
    const order = await Order.findOne({ 'razorpay.orderId': orderId });
    if (!order) throw ApiError.notFound('Order not found for this payment.');
    const payment = await fetchPayment(paymentId);
    const updated = await applyGatewayPayment(order, payment, 'checkout_callback', { signatureVerified: true });
    ok(res, { orderNumber: updated.orderNumber, status: updated.status, paymentStatus: updated.paymentStatus }, updated.status === 'paid' ? 'Payment successful. Your eBook is ready.' : 'Payment is being confirmed.');
});

/** Browser reported a failed attempt. The failure is confirmed with Razorpay before recording it. */
export const reportPaymentFailure = asyncHandler(async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId } = req.body;
    const order = await Order.findOne({ 'razorpay.orderId': orderId });
    if (!order) throw ApiError.notFound('Order not found.');
    if (paymentId) {
        try {
            const payment = await fetchPayment(paymentId);
            if (payment.order_id === orderId) await applyGatewayPayment(order, payment, 'checkout_callback');
        } catch (err) {
            logger.warn(`Could not confirm failed payment ${paymentId}: ${err.message}`);
        }
    }
    const fresh = await Order.findById(order._id).lean();
    ok(res, { orderNumber: fresh.orderNumber, status: fresh.status, failureReason: fresh.failureReason });
});

/**
 * POST /api/v1/webhooks/razorpay
 * Mounted with express.raw so the signature is checked against the exact bytes received.
 * The event is stored (unique by event ID) and queued durably, then acknowledged quickly.
 */
export const razorpayWebhook = async (req, res) => {
    const signature = req.get('x-razorpay-signature');
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
        logger.warn('Rejected Razorpay webhook with invalid signature');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    let body;
    try {
        body = JSON.parse(raw.toString('utf8'));
    } catch {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    const eventId = req.get('x-razorpay-event-id') || sha256(raw);
    try {
        await WebhookEvent.create({ eventId, payload: body, ...summarizeEvent(body) });
    } catch (err) {
        if (err.code === 11000) return res.status(200).json({ success: true, duplicate: true });
        logger.error(`Webhook store failed: ${err.message}`);
        return res.status(500).json({ success: false });
    }
    const job = await enqueueJob('webhook.razorpay', { eventId }, { dedupeKey: `webhook:${eventId}` });
    res.status(200).json({ success: true });
    // Process right away; if this fails the queue worker retries.
    setImmediate(() => runJobNow(job._id).catch((err) => logger.error(`Webhook immediate run failed: ${err.message}`)));
};
