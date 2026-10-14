import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const attributionSchema = new mongoose.Schema(
    { source: String, medium: String, campaign: String, term: String, content: String, referrer: String, landingPage: String, gclid: String, fbclid: String },
    { _id: false }
);

/**
 * Checkout session. The public identifier is random; only its SHA-256 is stored,
 * so a database read does not let anyone act on a customer's checkout.
 * Verification fields are written exclusively by the OTP service.
 */
const checkoutSessionSchema = new mongoose.Schema(
    {
        tokenHash: { type: String, required: true, unique: true },
        items: [{ product: { type: ObjectId, ref: 'Product', required: true }, _id: false }],
        couponCode: String,
        email: { type: String, lowercase: true, trim: true, index: true },
        emailVerifiedAt: Date,
        verificationExpiresAt: Date,
        otp: { type: ObjectId, ref: 'Otp' },
        user: { type: ObjectId, ref: 'User' },
        marketingConsent: { type: Boolean, default: false },
        marketingConsentAt: Date,
        termsAcceptedAt: Date,
        termsVersion: String,
        status: { type: String, enum: ['active', 'payment_pending', 'converted', 'expired'], default: 'active', index: true },
        lastActivityAt: { type: Date, default: Date.now, index: true },
        cartSnapshot: { subtotal: Number, total: Number, currency: String, titles: [String] },
        currentOrder: { type: ObjectId, ref: 'Order' },
        convertedOrder: { type: ObjectId, ref: 'Order' },
        remindersSent: { type: Number, default: 0 },
        lastReminderAt: Date,
        attribution: attributionSchema,
        ip: String,
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);
checkoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const otpSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, lowercase: true, index: true },
        checkoutSession: { type: ObjectId, ref: 'CheckoutSession', required: true, index: true },
        codeHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'used', 'superseded', 'locked', 'expired'], default: 'pending' },
        ip: String,
        usedAt: Date,
    },
    { timestamps: true }
);
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
otpSchema.index({ ip: 1, createdAt: -1 });

const orderItemSchema = new mongoose.Schema(
    {
        product: { type: ObjectId, ref: 'Product', required: true },
        title: String,
        slug: String,
        coverImage: String,
        format: String,
        fileVersion: String,
        unitPrice: Number,
        compareAtPrice: Number,
        discount: { type: Number, default: 0 },
        total: Number,
        appliedOffer: { type: ObjectId, ref: 'Offer' },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: { type: String, required: true, unique: true },
        user: { type: ObjectId, ref: 'User', index: true },
        email: { type: String, required: true, lowercase: true, index: true },
        checkoutSession: { type: ObjectId, ref: 'CheckoutSession', index: true },
        items: [orderItemSchema],
        currency: { type: String, default: 'INR' },
        subtotal: Number,
        automaticDiscount: { type: Number, default: 0 },
        couponDiscount: { type: Number, default: 0 },
        discountTotal: { type: Number, default: 0 },
        coupon: { code: String, offer: { type: ObjectId, ref: 'Offer' } },
        offersApplied: [{ type: ObjectId, ref: 'Offer' }],
        tax: { label: String, rate: Number, inclusive: Boolean, amount: { type: Number, default: 0 } },
        total: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'], default: 'pending', index: true },
        paymentStatus: { type: String, enum: ['created', 'attempted', 'pending', 'paid', 'failed'], default: 'created', index: true },
        deliveryStatus: { type: String, enum: ['not_started', 'queued', 'sent', 'failed'], default: 'not_started', index: true },
        refundStatus: { type: String, enum: ['none', 'requested', 'processing', 'partial', 'refunded', 'failed'], default: 'none' },
        refundedAmount: { type: Number, default: 0 },
        paymentMethod: { type: String, enum: ['razorpay', 'manual_upi'], default: 'manual_upi', index: true },
        manualPayment: {
            upiId: String,
            utr: { type: String, trim: true, index: true },
            submittedAt: Date,
            approvedAt: Date,
            approvedBy: { type: ObjectId, ref: 'User' },
            rejectedAt: Date,
            rejectedReason: String,
        },
        razorpay: { orderId: { type: String, index: true, sparse: true }, paymentId: String, method: String },
        paidAt: Date,
        failureReason: String,
        termsAcceptedAt: Date,
        termsVersion: String,
        marketingConsent: Boolean,
        attribution: attributionSchema,
        conversionTrackedAt: Date,
        notes: [{ by: { type: ObjectId, ref: 'User' }, text: String, at: { type: Date, default: Date.now }, _id: false }],
        reconciledBy: { type: ObjectId, ref: 'User' },
        ip: String,
    },
    { timestamps: true }
);
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, paidAt: -1 });
orderSchema.index({ 'items.product': 1, status: 1 });

const paymentSchema = new mongoose.Schema(
    {
        order: { type: ObjectId, ref: 'Order', required: true, index: true },
        razorpayOrderId: { type: String, index: true },
        razorpayPaymentId: { type: String, unique: true, sparse: true },
        amount: Number,
        currency: String,
        status: { type: String, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created' },
        method: String,
        signatureVerified: { type: Boolean, default: false },
        verifiedVia: [{ type: String, enum: ['checkout_callback', 'webhook', 'reconciliation'] }],
        fee: Number,
        gatewayTax: Number,
        errorCode: String,
        errorDescription: String,
        errorReason: String,
        capturedAt: Date,
        failedAt: Date,
        raw: { type: mongoose.Schema.Types.Mixed, select: false },
    },
    { timestamps: true }
);

const webhookEventSchema = new mongoose.Schema(
    {
        provider: { type: String, default: 'razorpay' },
        eventId: { type: String, required: true, unique: true },
        event: { type: String, index: true },
        razorpayOrderId: { type: String, index: true },
        razorpayPaymentId: String,
        order: { type: ObjectId, ref: 'Order', index: true },
        payload: { type: mongoose.Schema.Types.Mixed, select: false },
        status: { type: String, enum: ['received', 'processing', 'processed', 'ignored', 'failed'], default: 'received', index: true },
        attempts: { type: Number, default: 0 },
        error: String,
        processedAt: Date,
        eventCreatedAt: Date,
    },
    { timestamps: true }
);

const entitlementSchema = new mongoose.Schema(
    {
        user: { type: ObjectId, ref: 'User', index: true },
        email: { type: String, required: true, lowercase: true, index: true },
        order: { type: ObjectId, ref: 'Order', required: true },
        product: { type: ObjectId, ref: 'Product', required: true },
        productTitle: String,
        fileKey: String,
        fileVersion: String,
        fileName: String,
        status: { type: String, enum: ['active', 'revoked'], default: 'active' },
        grantedAt: { type: Date, default: Date.now },
        revokedAt: Date,
        revokedReason: String,
        downloadCount: { type: Number, default: 0 },
        lastDownloadAt: Date,
    },
    { timestamps: true }
);
entitlementSchema.index({ order: 1, product: 1 }, { unique: true });

const downloadTokenSchema = new mongoose.Schema(
    {
        entitlement: { type: ObjectId, ref: 'Entitlement', required: true, index: true },
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        maxUses: { type: Number, default: 5 },
        uses: { type: Number, default: 0 },
        issuedFor: { type: String, enum: ['email', 'library', 'regenerate', 'admin_resend'], default: 'email' },
        revokedAt: Date,
    },
    { timestamps: true }
);
downloadTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const downloadEventSchema = new mongoose.Schema(
    {
        entitlement: { type: ObjectId, ref: 'Entitlement', index: true },
        order: { type: ObjectId, ref: 'Order', index: true },
        product: { type: ObjectId, ref: 'Product' },
        email: String,
        via: String,
        outcome: { type: String, enum: ['served', 'denied'] },
        reason: String,
        ip: String,
        userAgent: String,
    },
    { timestamps: true }
);

const offerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: String,
        discountType: { type: String, enum: ['percentage', 'fixed', 'bundle'], required: true },
        // Percentage (0-100) or a minor-unit amount. For bundles: the bundle price.
        value: { type: Number, required: true, min: 0 },
        appliesTo: { type: String, enum: ['all', 'products', 'categories'], default: 'all' },
        products: [{ type: ObjectId, ref: 'Product' }],
        categories: [{ type: ObjectId, ref: 'Category' }],
        couponCode: { type: String, uppercase: true, trim: true, unique: true, sparse: true },
        startsAt: Date,
        endsAt: Date,
        timezone: { type: String, default: 'Asia/Kolkata' },
        minOrderAmount: { type: Number, default: 0 },
        maxDiscountAmount: Number,
        redemptionLimit: Number,
        perCustomerLimit: Number,
        firstPurchaseOnly: { type: Boolean, default: false },
        audienceEmails: [{ type: String, lowercase: true, trim: true }],
        stackable: { type: Boolean, default: false },
        active: { type: Boolean, default: false, index: true },
        paused: { type: Boolean, default: false },
        showOnHomepage: { type: Boolean, default: false },
        bannerText: String,
        promoteViaEmail: { type: Boolean, default: false },
        promoteViaNotification: { type: Boolean, default: false },
        redemptionCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const offerRedemptionSchema = new mongoose.Schema(
    {
        offer: { type: ObjectId, ref: 'Offer', required: true, index: true },
        order: { type: ObjectId, ref: 'Order', required: true },
        email: { type: String, lowercase: true, index: true },
        discount: Number,
        orderTotal: Number,
    },
    { timestamps: true }
);
offerRedemptionSchema.index({ offer: 1, order: 1 }, { unique: true });

const refundRequestSchema = new mongoose.Schema(
    {
        refundNumber: { type: String, required: true, unique: true },
        order: { type: ObjectId, ref: 'Order', required: true, index: true },
        email: { type: String, lowercase: true },
        user: { type: ObjectId, ref: 'User' },
        reason: { type: String, maxlength: 2000 },
        category: { type: String, enum: ['inaccessible_file', 'defective_file', 'duplicate_charge', 'not_as_described', 'other'], default: 'other' },
        source: { type: String, enum: ['customer', 'admin'], default: 'customer' },
        status: { type: String, enum: ['requested', 'under_review', 'approved', 'rejected', 'processing', 'processed', 'failed'], default: 'requested', index: true },
        eligibilityNotes: String,
        decisionReason: String,
        decidedBy: { type: ObjectId, ref: 'User' },
        decidedAt: Date,
        amount: Number,
        revokeAccess: { type: Boolean, default: false },
        razorpayRefundId: { type: String, index: true, sparse: true },
        gatewayStatus: String,
        initiatedBy: { type: ObjectId, ref: 'User' },
        initiatedAt: Date,
        processedAt: Date,
        failureReason: String,
        customerNotifiedAt: Date,
        history: [{ status: String, note: String, by: { type: ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, _id: false }],
    },
    { timestamps: true }
);

export const CheckoutSession = mongoose.model('CheckoutSession', checkoutSessionSchema);
export const Otp = mongoose.model('Otp', otpSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export const Entitlement = mongoose.model('Entitlement', entitlementSchema);
export const DownloadToken = mongoose.model('DownloadToken', downloadTokenSchema);
export const DownloadEvent = mongoose.model('DownloadEvent', downloadEventSchema);
export const Offer = mongoose.model('Offer', offerSchema);
export const OfferRedemption = mongoose.model('OfferRedemption', offerRedemptionSchema);
export const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
