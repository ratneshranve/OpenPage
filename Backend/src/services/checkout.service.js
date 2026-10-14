import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { CheckoutSession, Order, Payment, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addMinutes, hmac, humanRef, normalizeEmail, randomToken, safeEqual, sha256 } from '../utils/helpers.js';
import { priceCart } from './pricing.service.js';
import { getSettings } from './settings.service.js';
import { createGatewayOrder, fetchOrder, isRazorpayConfigured } from './razorpay.service.js';
import { reconcileOrder } from './fulfillment.service.js';
import { logger } from '../utils/logger.js';

const MAX_ITEMS = 25;

export const findSession = async (token) => {
    if (!token || typeof token !== 'string' || token.length > 100) throw ApiError.notFound('Checkout session not found. Please return to your cart.');
    const session = await CheckoutSession.findOne({ tokenHash: sha256(token) });
    if (!session || session.expiresAt < new Date()) throw new ApiError(404, 'Your checkout session has expired. Please return to your cart.', null, 'SESSION_EXPIRED');
    return session;
};

const isVerified = (session) => Boolean(session.email && session.emailVerifiedAt && session.verificationExpiresAt > new Date());

const sessionView = async (session, quote) => ({
    email: session.email || null,
    emailVerified: isVerified(session),
    verifiedUntil: isVerified(session) ? session.verificationExpiresAt : null,
    status: session.status,
    couponCode: session.couponCode || null,
    marketingConsent: session.marketingConsent,
    quote: quote || (await priceCart({ productIds: session.items.map((i) => String(i.product)), couponCode: session.couponCode, email: isVerified(session) ? session.email : null })),
});

const sanitizeAttribution = (a = {}) => {
    const out = {};
    for (const key of ['source', 'medium', 'campaign', 'term', 'content', 'referrer', 'landingPage', 'gclid', 'fbclid']) {
        if (a[key]) out[key] = String(a[key]).slice(0, 300);
    }
    return out;
};

export const createSession = async ({ productIds, couponCode, attribution, user, ip }) => {
    const ids = [...new Set(productIds)].filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_ITEMS);
    if (!ids.length) throw ApiError.badRequest('Your cart is empty.');
    const { sessionTtlHours } = await getSettings('checkout');
    const token = randomToken(32);
    const session = await CheckoutSession.create({
        tokenHash: sha256(token),
        items: ids.map((product) => ({ product })),
        couponCode: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
        user: user?._id,
        attribution: sanitizeAttribution(attribution),
        ip,
        expiresAt: addMinutes(new Date(), sessionTtlHours * 60),
    });
    return { sessionToken: token, ...(await sessionView(session)) };
};

export const updateSession = async (session, { productIds, couponCode }) => {
    if (productIds) {
        const ids = [...new Set(productIds)].filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_ITEMS);
        session.items = ids.map((product) => ({ product }));
    }
    if (couponCode !== undefined) session.couponCode = couponCode ? String(couponCode).trim().toUpperCase() : undefined;
    session.lastActivityAt = new Date();
    await session.save();
    return sessionView(session);
};

export const getSessionView = (session) => sessionView(session);

export const quoteForSession = async (session, couponCode) =>
    priceCart({ productIds: session.items.map((i) => String(i.product)), couponCode: couponCode ?? session.couponCode, email: isVerified(session) ? session.email : null });

/** Rebuilds a checkout from a signed reminder link. The email must be verified again. */
export const resumeSession = async ({ sid, sig, ip }) => {
    const expected = hmac(config.sessionSecret, `resume:${sid}`).slice(0, 32);
    if (!mongoose.isValidObjectId(sid) || !safeEqual(expected, String(sig || ''))) throw ApiError.badRequest('This checkout link is not valid.');
    const old = await CheckoutSession.findById(sid).lean();
    if (!old) throw ApiError.notFound('This checkout has expired. Please browse the catalogue to start again.');
    const created = await createSession({ productIds: old.items.map((i) => String(i.product)), couponCode: old.couponCode, attribution: { source: 'email', medium: 'reminder', campaign: 'abandoned_checkout' }, ip });
    return { ...created, suggestedEmail: old.email, productIds: old.items.map((i) => String(i.product)) };
};

const newOrderNumber = async () => {
    for (let i = 0; i < 5; i += 1) {
        const candidate = humanRef('OP', 8);
        if (!(await Order.exists({ orderNumber: candidate }))) return candidate;
    }
    throw new Error('Could not allocate an order number');
};

const sameItems = (order, quote) =>
    order.total === quote.total &&
    order.currency === quote.currency &&
    order.items.length === quote.items.length &&
    order.items.every((item) => quote.items.some((q) => String(q.product) === String(item.product) && q.total === item.total));

const upiPayload = async (order, paymentsSettings) => {
    const general = await getSettings('general');
    const manualUpi = paymentsSettings?.manualUpi || {};
    const upiId = manualUpi.upiId || 'ranveratnesh@okhdfcbank';
    const payeeName = manualUpi.accountHolderName || general.siteName || 'OpenPage';
    const amountInRupees = (order.total / 100).toFixed(2);
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountInRupees}&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}&cu=INR`;
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: 'manual_upi',
        amount: order.total,
        currency: order.currency,
        manualUpi: {
            upiId,
            payeeName,
            amountInRupees,
            upiUri,
            qrCodeUrl: manualUpi.qrCodeUrl || '',
            instructions: manualUpi.instructions || '',
            submittedUtr: order.manualPayment?.utr || '',
        },
        prefill: { email: order.email },
        merchantName: general.siteName,
    };
};

const paymentPayload = async (order, paymentsSettings) => {
    if (order.paymentMethod === 'manual_upi') {
        return upiPayload(order, paymentsSettings);
    }
    const general = await getSettings('general');
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: 'razorpay',
        amount: order.total,
        currency: order.currency,
        razorpay: { keyId: config.razorpay.keyId, orderId: order.razorpay?.orderId, amount: order.total, currency: order.currency },
        prefill: { email: order.email },
        merchantName: general.siteName,
    };
};

/**
 * Creates (or safely reuses) the internal order and handles Manual UPI or Razorpay gateway flow.
 * Preserves Razorpay configuration while allowing seamless manual UPI payments.
 */
export const createOrder = async (session, { termsAccepted, marketingConsent, paymentMethod }, { user, ip }) => {
    if (!isVerified(session)) throw new ApiError(403, 'Please verify your email address before continuing to payment.', null, 'EMAIL_NOT_VERIFIED');
    if (!termsAccepted) throw ApiError.badRequest('Please accept the Terms and Conditions to continue.');

    const quote = await quoteForSession(session);
    if (quote.invalidItems.length) {
        throw new ApiError(409, 'Some items in your cart are no longer available. Please review your cart.', { invalidItems: quote.invalidItems }, 'CART_CHANGED');
    }
    if (!quote.items.length) throw ApiError.badRequest('Your cart is empty.');
    if (session.couponCode && !quote.coupon?.valid) {
        throw new ApiError(409, quote.coupon?.message || 'Your coupon is no longer valid.', { coupon: quote.coupon }, 'COUPON_INVALID');
    }

    const [checkoutSettings, paymentsSettings] = await Promise.all([
        getSettings('checkout'),
        getSettings('payments'),
    ]);

    const activeGateway = paymentsSettings.activeGateway || 'manual_upi';
    let chosenMethod = paymentMethod || activeGateway;
    if (activeGateway !== 'both') {
        chosenMethod = activeGateway;
    }
    if (chosenMethod === 'razorpay' && !isRazorpayConfigured()) {
        chosenMethod = 'manual_upi';
    }

    // Reconcile any earlier order from this checkout before creating a new one.
    if (session.currentOrder) {
        let existing = await Order.findById(session.currentOrder);
        if (existing && existing.status === 'pending' && existing.paymentMethod === 'razorpay') {
            try {
                existing = await reconcileOrder(existing, 'reconciliation');
            } catch (err) {
                logger.warn(`Could not reconcile ${existing.orderNumber} before reuse: ${err.message}`);
                throw ApiError.unavailable('We are confirming a previous payment attempt for this checkout. Please wait a moment and check your order status.');
            }
        }
        if (existing && ['paid', 'partially_refunded'].includes(existing.status)) {
            throw new ApiError(409, 'This checkout has already been paid.', { orderNumber: existing.orderNumber, alreadyPaid: true }, 'ALREADY_PAID');
        }
        if (existing && existing.status === 'pending' && existing.paymentStatus === 'pending' && existing.paymentMethod === 'razorpay') {
            throw new ApiError(409, 'A payment for this checkout is still being confirmed. Please wait before paying again.', { orderNumber: existing.orderNumber, pending: true }, 'PAYMENT_PENDING');
        }
        const reusable =
            existing &&
            ['pending', 'failed'].includes(existing.status) &&
            existing.email === session.email &&
            sameItems(existing, quote) &&
            Date.now() - existing.createdAt.getTime() < checkoutSettings.pendingOrderReuseMinutes * 60000;
        if (reusable) {
            if (existing.paymentMethod === 'manual_upi') {
                if (existing.status === 'failed') await Order.updateOne({ _id: existing._id }, { $set: { status: 'pending', paymentStatus: 'pending' } });
                return upiPayload(existing, paymentsSettings);
            }
            if (existing.razorpay?.orderId && isRazorpayConfigured()) {
                const gatewayOrder = await fetchOrder(existing.razorpay.orderId);
                if (gatewayOrder.status !== 'paid') {
                    if (existing.status === 'failed') await Order.updateOne({ _id: existing._id }, { $set: { status: 'pending', paymentStatus: 'attempted' } });
                    return paymentPayload(existing, paymentsSettings);
                }
            }
        }
        if (existing && ['pending', 'failed'].includes(existing.status)) {
            // Superseded. A late capture on it would still be honoured by the webhook.
            await Order.updateOne({ _id: existing._id, status: { $in: ['pending', 'failed'] } }, { $set: { status: 'cancelled' } });
        }
    }

    const owner = user || (await User.findOne({ email: session.email, emailVerified: true }).select('_id').lean());
    const order = await Order.create({
        orderNumber: await newOrderNumber(),
        user: owner?._id,
        email: normalizeEmail(session.email),
        checkoutSession: session._id,
        items: quote.items.map(({ offerName, ...item }) => item),
        currency: quote.currency,
        subtotal: quote.subtotal,
        automaticDiscount: quote.automaticDiscount,
        couponDiscount: quote.couponDiscount,
        discountTotal: quote.discountTotal,
        coupon: quote.coupon?.valid ? { code: quote.coupon.code, offer: quote.coupon.offerId } : undefined,
        offersApplied: quote.offersApplied,
        tax: quote.tax || undefined,
        total: quote.total,
        paymentMethod: chosenMethod,
        paymentStatus: chosenMethod === 'manual_upi' ? 'pending' : 'created',
        termsAcceptedAt: new Date(),
        termsVersion: checkoutSettings.termsVersion,
        marketingConsent: Boolean(marketingConsent),
        attribution: session.attribution,
        ip,
    });

    if (chosenMethod === 'razorpay') {
        let gatewayOrder;
        try {
            gatewayOrder = await createGatewayOrder({
                amount: order.total,
                currency: order.currency,
                receipt: order.orderNumber,
                notes: { orderId: String(order._id), orderNumber: order.orderNumber },
            });
        } catch (err) {
            await Order.updateOne({ _id: order._id }, { $set: { status: 'cancelled', failureReason: 'Gateway order creation failed' } });
            throw err;
        }
        order.razorpay = { orderId: gatewayOrder.id };
        await order.save();
        await Payment.create({ order: order._id, razorpayOrderId: gatewayOrder.id, amount: order.total, currency: order.currency, status: 'created' });
    }

    const now = new Date();
    await CheckoutSession.updateOne(
        { _id: session._id },
        {
            $set: {
                status: 'payment_pending',
                currentOrder: order._id,
                termsAcceptedAt: now,
                termsVersion: checkoutSettings.termsVersion,
                marketingConsent: Boolean(marketingConsent),
                ...(marketingConsent ? { marketingConsentAt: now } : {}),
                lastActivityAt: now,
                user: user?._id || session.user,
                cartSnapshot: { subtotal: quote.subtotal, total: quote.total, currency: quote.currency, titles: quote.items.map((i) => i.title) },
            },
        }
    );
    return paymentPayload(order, paymentsSettings);
};

const lastReconcile = new Map();

/**
 * Order status for the success/pending pages. Access requires the checkout session token
 * that created the order, or the signed-in owner.
 */
export const getOrderStatus = async (orderNumber, { sessionToken, user }) => {
    let order = await Order.findOne({ orderNumber: String(orderNumber).toUpperCase() });
    if (!order) throw ApiError.notFound('Order not found.');
    let allowed = false;
    if (sessionToken && order.checkoutSession) {
        const session = await CheckoutSession.findOne({ tokenHash: sha256(sessionToken) }).select('_id').lean();
        allowed = Boolean(session && String(session._id) === String(order.checkoutSession));
    }
    if (!allowed && user) allowed = String(order.user) === String(user._id) || (user.emailVerified && user.email === order.email) || user.role === 'admin';
    if (!allowed) throw ApiError.notFound('Order not found.');

    // If the webhook has not arrived yet, ask the gateway directly (throttled).
    if (order.status === 'pending' && order.razorpay?.orderId && Date.now() - order.createdAt.getTime() > 5000) {
        const last = lastReconcile.get(order.orderNumber) || 0;
        if (Date.now() - last > 15000) {
            lastReconcile.set(order.orderNumber, Date.now());
            try {
                order = await reconcileOrder(order, 'reconciliation');
            } catch (err) {
                logger.warn(`Status reconcile failed for ${order.orderNumber}: ${err.message}`);
            }
        }
    }

    const account = user || (await User.findOne({ email: order.email, emailVerified: true }).select('_id').lean());
    const paymentsSettings = await getSettings('payments');
    const manualUpi = paymentsSettings?.manualUpi || {};
    const general = await getSettings('general');
    const amountInRupees = (order.total / 100).toFixed(2);
    const upiId = manualUpi.upiId || 'ranveratnesh@okhdfcbank';
    const payeeName = manualUpi.accountHolderName || general.siteName || 'OpenPage';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountInRupees}&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}&cu=INR`;

    return {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod || 'manual_upi',
        deliveryStatus: order.deliveryStatus,
        email: order.email,
        items: order.items.map((i) => ({ productId: i.product, title: i.title, slug: i.slug, coverImage: i.coverImage, total: i.total, unitPrice: i.unitPrice, discount: i.discount })),
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        tax: order.tax?.amount ? order.tax : null,
        total: order.total,
        currency: order.currency,
        paidAt: order.paidAt,
        failureReason: order.status === 'failed' ? order.failureReason : null,
        hasAccount: Boolean(account),
        manualPayment: order.manualPayment ? {
            utr: order.manualPayment.utr || null,
            submittedAt: order.manualPayment.submittedAt || null,
            approvedAt: order.manualPayment.approvedAt || null,
            rejectedAt: order.manualPayment.rejectedAt || null,
            rejectedReason: order.manualPayment.rejectedReason || null,
        } : null,
        manualUpi: {
            upiId,
            payeeName,
            amountInRupees,
            upiUri,
            qrCodeUrl: manualUpi.qrCodeUrl || '',
            instructions: manualUpi.instructions || '',
        },
        // Purchase conversions are reported once per order, only after verified payment.
        trackPurchase: order.status === 'paid' && !order.conversionTrackedAt,
    };
};

/**
 * Customers submit the 12-digit UTR/reference number after paying via UPI.
 */
export const submitUtr = async (orderNumber, utr, { sessionToken, user }) => {
    let order = await Order.findOne({ orderNumber: String(orderNumber).toUpperCase() });
    if (!order) throw ApiError.notFound('Order not found.');
    let allowed = false;
    if (sessionToken && order.checkoutSession) {
        const session = await CheckoutSession.findOne({ tokenHash: sha256(sessionToken) }).select('_id').lean();
        allowed = Boolean(session && String(session._id) === String(order.checkoutSession));
    }
    if (!allowed && user) allowed = String(order.user) === String(user._id) || (user.emailVerified && user.email === order.email) || user.role === 'admin';
    if (!allowed) throw ApiError.notFound('Order not found.');

    if (order.status === 'paid') return order;

    const trimmedUtr = String(utr).trim();
    order.manualPayment = order.manualPayment || {};
    order.manualPayment.utr = trimmedUtr;
    order.manualPayment.submittedAt = new Date();
    order.paymentStatus = 'pending';
    order.notes = order.notes || [];
    order.notes.push({ text: `Customer submitted UPI Reference / UTR: ${trimmedUtr}`, at: new Date() });
    await order.save();
    return order;
};

export const markConversionTracked = async (orderNumber, { sessionToken, user }) => {
    await getOrderStatus(orderNumber, { sessionToken, user });
    await Order.updateOne({ orderNumber: String(orderNumber).toUpperCase(), status: 'paid', conversionTrackedAt: null }, { $set: { conversionTrackedAt: new Date() } });
};

/** Records a checkout dismissal so the order can be retried cleanly. */
export const recordCheckoutDismissed = async (session) => {
    await CheckoutSession.updateOne({ _id: session._id }, { $set: { lastActivityAt: new Date() } });
};
