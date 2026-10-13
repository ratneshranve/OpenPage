import crypto from 'crypto';
import Razorpay from 'razorpay';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { safeEqual } from '../utils/helpers.js';

let client = null;

export const isRazorpayConfigured = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);

const getClient = () => {
    if (!isRazorpayConfigured()) throw ApiError.unavailable('Online payments are not configured yet. Please contact support.');
    if (!client) client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
    return client;
};

const gatewayError = (err, fallback) => {
    const description = err?.error?.description || err?.message || fallback;
    const e = new ApiError(502, `${fallback}${description ? `: ${description}` : ''}`, null, 'GATEWAY_ERROR');
    e.gateway = err?.error;
    return e;
};

export const createGatewayOrder = async ({ amount, currency, receipt, notes }) => {
    try {
        return await getClient().orders.create({ amount, currency, receipt, notes, payment_capture: 1 });
    } catch (err) {
        throw gatewayError(err, 'Unable to start payment');
    }
};

export const fetchPayment = async (paymentId) => {
    try {
        return await getClient().payments.fetch(paymentId);
    } catch (err) {
        throw gatewayError(err, 'Unable to fetch payment');
    }
};

export const fetchOrder = async (orderId) => {
    try {
        return await getClient().orders.fetch(orderId);
    } catch (err) {
        throw gatewayError(err, 'Unable to fetch gateway order');
    }
};

export const fetchOrderPayments = async (orderId) => {
    try {
        const res = await getClient().orders.fetchPayments(orderId);
        return res?.items || [];
    } catch (err) {
        throw gatewayError(err, 'Unable to fetch gateway payments');
    }
};

/** Only ever called from an explicit administrator action. */
export const createRefund = async (paymentId, { amount, notes, receipt }) => {
    try {
        return await getClient().payments.refund(paymentId, { amount, notes, receipt, speed: 'normal' });
    } catch (err) {
        throw gatewayError(err, 'Refund could not be initiated');
    }
};

export const fetchRefund = async (paymentId, refundId) => {
    try {
        return await getClient().payments.fetchRefund(paymentId, refundId);
    } catch (err) {
        throw gatewayError(err, 'Unable to fetch refund');
    }
};

/** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export const verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
    if (!orderId || !paymentId || !signature || !config.razorpay.keySecret) return false;
    const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, signature);
};

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). Must use the exact raw bytes. */
export const verifyWebhookSignature = (rawBody, signature) => {
    if (!rawBody || !signature || !config.razorpay.webhookSecret) return false;
    const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
};

export const razorpayMode = () => (config.razorpay.keyId.startsWith('rzp_live_') ? 'live' : config.razorpay.keyId.startsWith('rzp_test_') ? 'test' : 'unknown');
