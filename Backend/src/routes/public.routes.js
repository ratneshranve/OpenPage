import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { authLimiter, otpLimiter, formLimiter, downloadLimiter, checkoutLimiter } from '../middleware/rateLimit.js';
import * as catalog from '../controllers/catalog.controller.js';
import * as checkout from '../controllers/checkout.controller.js';
import * as auth from '../controllers/auth.controller.js';
import * as customer from '../controllers/customer.controller.js';
import * as engage from '../controllers/engagement.controller.js';

const router = Router();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().min(10, 'Use at least 10 characters').max(128).regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number');
const coupon = z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/, 'Invalid coupon code').optional().nullable();
const attribution = z.object({ source: z.string(), medium: z.string(), campaign: z.string(), term: z.string(), content: z.string(), referrer: z.string(), landingPage: z.string(), gclid: z.string(), fbclid: z.string() }).partial().optional();

// ---- Catalogue & content ----
router.get('/config/public', catalog.publicConfig);
router.get('/home', catalog.homepage);
router.get('/products', catalog.listProducts);
router.get('/products/:slug', catalog.getProduct);
router.get('/products/:slug/sample', downloadLimiter, catalog.downloadSample);
router.get('/categories', catalog.listCategories);
router.get('/categories/:slug', catalog.getCategory);
router.get('/offers/active', catalog.activeOffers);
router.get('/reviews/featured', catalog.featuredReviews);
router.get('/pages/:slug', catalog.getPage);

// ---- Checkout ----
router.post('/checkout/sessions', checkoutLimiter, optionalAuth, validate(z.object({ productIds: z.array(objectId).min(1).max(25), couponCode: coupon, attribution })), checkout.createSession);
router.get('/checkout/sessions/current', checkout.getSession);
router.patch('/checkout/sessions/current', checkoutLimiter, validate(z.object({ productIds: z.array(objectId).max(25).optional(), couponCode: coupon, customerName: z.string().trim().max(120).optional().nullable(), customerPhone: z.string().trim().max(20).optional().nullable() })), checkout.updateSession);
router.post('/checkout/sessions/resume', checkoutLimiter, validate(z.object({ sid: objectId, sig: z.string().max(64) })), checkout.resumeSession);
router.post('/checkout/otp/send', otpLimiter, validate(z.object({ email })), checkout.sendOtp);
router.post('/checkout/otp/verify', otpLimiter, validate(z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') })), checkout.verifyOtp);
router.post('/checkout/validate-coupon', checkoutLimiter, validate(z.object({ productIds: z.array(objectId).max(25).optional(), couponCode: coupon })), checkout.validateCoupon);
router.post('/checkout/create-order', checkoutLimiter, optionalAuth, validate(z.object({ termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms and Conditions' }) }), marketingConsent: z.boolean().optional().default(false), paymentMethod: z.enum(['razorpay', 'manual_upi']).optional(), customerName: z.string().trim().max(120).optional().nullable(), customerPhone: z.string().trim().max(20).optional().nullable() })), checkout.createOrder);
router.get('/checkout/order-status/:orderId', optionalAuth, checkout.orderStatus);
router.post('/checkout/order-status/:orderId/submit-utr', checkoutLimiter, optionalAuth, validate(z.object({ utr: z.string().trim().min(4, 'Enter a valid reference / UTR number').max(64) })), checkout.submitUtr);
router.post('/checkout/order-status/:orderId/tracked', optionalAuth, checkout.conversionTracked);

// ---- Payments ----
const rzpIds = { razorpay_order_id: z.string().max(64), razorpay_payment_id: z.string().max(64) };
router.post('/payments/verify', checkoutLimiter, validate(z.object({ ...rzpIds, razorpay_signature: z.string().max(128) })), checkout.verifyPayment);
router.post('/payments/failed', checkoutLimiter, validate(z.object({ razorpay_order_id: z.string().max(64), razorpay_payment_id: z.string().max(64).optional() })), checkout.reportPaymentFailure);

// ---- Auth ----
router.get('/auth/csrf', auth.csrf);
router.get('/auth/me', optionalAuth, auth.me);
router.post('/auth/otp/send', otpLimiter, validate(z.object({ email })), auth.sendOtp);
router.post('/auth/otp/verify', otpLimiter, validate(z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') })), auth.loginWithOtp);
router.post('/auth/register', authLimiter, validate(z.object({ name: z.string().trim().min(1, 'Enter your name').max(120), email, password, marketingEmails: z.boolean().optional().default(false) })), auth.register);
router.post('/auth/login', authLimiter, validate(z.object({ email, password: z.string().min(1).max(128) })), auth.login);
router.post('/auth/admin/login', authLimiter, validate(z.object({ email, password: z.string().min(1).max(128) })), auth.adminLogin);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);
router.post('/auth/logout-all', requireAuth, auth.logoutAll);
router.post('/auth/forgot-password', authLimiter, validate(z.object({ email })), auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, validate(z.object({ token: z.string().min(20).max(100), password })), auth.resetPassword);
router.post('/auth/verify-email', authLimiter, validate(z.object({ token: z.string().min(20).max(100) })), auth.verifyEmail);
router.post('/auth/resend-verification', authLimiter, requireAuth, auth.resendVerification);
router.post('/auth/change-password', authLimiter, requireAuth, validate(z.object({ currentPassword: z.string().min(1).max(128), newPassword: password })), auth.changePassword);

// ---- Customer account ----
router.get('/users/me', requireAuth, customer.getMe);
router.patch('/users/me', requireAuth, validate(z.object({ name: z.string().trim().min(1).max(120).optional() })), customer.updateMe);
router.patch('/users/me/preferences', requireAuth, validate(z.object({ marketingEmails: z.boolean().optional(), notificationsEnabled: z.boolean().optional() })), customer.updatePreferences);
router.get('/users/me/orders', requireAuth, customer.listOrders);
router.get('/users/me/orders/:orderId', requireAuth, customer.getOrder);
router.post('/users/me/orders/:orderId/refund-request', formLimiter, requireAuth, validate(z.object({ reason: z.string().trim().min(10, 'Please describe the issue').max(2000), category: z.enum(['inaccessible_file', 'defective_file', 'duplicate_charge', 'not_as_described', 'other']) })), customer.requestRefund);
router.get('/users/me/library', requireAuth, customer.library);
router.get('/users/me/support', requireAuth, customer.mySupportTickets);
router.post('/users/me/claim-purchase', formLimiter, requireAuth, validate(z.object({ orderNumber: z.string().trim().min(4).max(20) })), customer.claimPurchase);
router.post('/users/me/library/:entitlementId/review', formLimiter, requireAuth, validate(z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().min(10, 'Please write at least a sentence').max(3000), displayName: z.string().trim().max(60).optional() })), customer.submitReview);

// ---- Downloads ----
router.post('/downloads/request-link', formLimiter, validate(z.object({ email, orderNumber: z.string().trim().max(20).optional() })), engage.requestDownloadLinks);
router.get('/downloads/token/:token', downloadLimiter, engage.describeDownload);
router.get('/downloads/file/:token', downloadLimiter, engage.downloadFile);
router.post('/downloads/:entitlementId', downloadLimiter, requireAuth, customer.createDownload);
router.post('/downloads/:entitlementId/regenerate', formLimiter, requireAuth, customer.regenerateDownload);

// ---- Newsletter, notifications, support, consent ----
router.post('/newsletter/subscribe', formLimiter, validate(z.object({ email, name: z.string().trim().max(120).optional(), source: z.string().max(40).optional() })), engage.subscribe);
router.post('/newsletter/confirm', formLimiter, validate(z.object({ token: z.string().min(20).max(100) })), engage.confirmSubscription);
router.post('/newsletter/unsubscribe', formLimiter, validate(z.object({ e: z.string().max(400), s: z.string().max(64) })), engage.unsubscribe);
router.post('/notifications/register', formLimiter, optionalAuth, validate(z.object({ token: z.string().min(20).max(4096), installationId: z.string().max(100).optional(), permission: z.enum(['granted', 'denied', 'default']).optional() })), engage.registerNotification);
router.post('/notifications/unregister', formLimiter, validate(z.object({ token: z.string().max(4096).optional(), installationId: z.string().max(100).optional() })), engage.unregisterNotification);
router.post(
    '/support',
    formLimiter,
    optionalAuth,
    validate(
        z.object({
            name: z.string().trim().min(1, 'Enter your name').max(120),
            email,
            orderNumber: z.string().trim().max(20).optional().or(z.literal('')),
            category: z.enum(['download', 'payment', 'refund', 'account', 'product', 'other']),
            refundReason: z.enum(['inaccessible_file', 'defective_file', 'duplicate_charge', 'not_as_described', 'other']).optional(),
            subject: z.string().trim().max(200).optional(),
            message: z.string().trim().min(10, 'Please give us a little more detail').max(5000),
        })
    ),
    engage.createTicket
);
router.post('/consent', formLimiter, optionalAuth, validate(z.object({ visitorId: z.string().max(64), analytics: z.boolean(), advertising: z.boolean(), policyVersion: z.string().max(20).optional(), action: z.enum(['accept_all', 'reject_all', 'custom', 'withdraw']) })), engage.recordConsent);

export default router;
