import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const emailTemplateSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: String,
        category: { type: String, enum: ['transactional', 'marketing'], required: true },
        subject: { type: String, required: true },
        preheader: String,
        html: { type: String, required: true },
        variables: [String],
        isSystem: { type: Boolean, default: false },
        updatedBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

/**
 * One document per email. It is both the durable send queue (status/nextAttemptAt)
 * and the delivery log the admin sees.
 */
const emailMessageSchema = new mongoose.Schema(
    {
        to: { type: String, required: true, lowercase: true, index: true },
        user: { type: ObjectId, ref: 'User' },
        templateKey: { type: String, index: true },
        category: { type: String, enum: ['transactional', 'marketing'], required: true },
        type: { type: String, index: true },
        subject: String,
        data: { type: Mixed, select: false },
        // Sensitive payloads (e.g. OTP codes, download links) are wiped after sending.
        sensitive: { type: Boolean, default: false },
        status: { type: String, enum: ['queued', 'sending', 'sent', 'failed', 'cancelled', 'suppressed'], default: 'queued', index: true },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        nextAttemptAt: { type: Date, default: Date.now },
        lockedAt: Date,
        sentAt: Date,
        providerMessageId: String,
        providerResponse: String,
        lastError: String,
        errors: [{ at: Date, message: String, _id: false }],
        dedupeKey: { type: String, unique: true, sparse: true },
        order: { type: ObjectId, ref: 'Order', index: true },
        campaign: { type: ObjectId, ref: 'EmailCampaign', index: true },
        automation: { type: ObjectId, ref: 'Automation', index: true },
        checkoutSession: { type: ObjectId, ref: 'CheckoutSession' },
        openedAt: Date,
        clickedAt: Date,
    },
    { timestamps: true, suppressReservedKeysWarning: true }
);
emailMessageSchema.index({ status: 1, nextAttemptAt: 1 });
emailMessageSchema.index({ createdAt: -1 });

const automationSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: String,
        trigger: { type: String, enum: ['checkout_abandoned', 'order_paid'], required: true },
        step: { type: Number, default: 1 },
        delayMinutes: { type: Number, required: true, min: 5 },
        templateKey: { type: String, required: true },
        enabled: { type: Boolean, default: false },
        conditions: {
            requireMarketingConsent: { type: Boolean, default: true },
            minOrderValue: { type: Number, default: 0 },
            excludeRecentPurchasersDays: { type: Number, default: 0 },
            productIds: [{ type: ObjectId, ref: 'Product' }],
        },
        audience: { type: String, enum: ['all_eligible', 'registered_only', 'guests_only'], default: 'all_eligible' },
        maxPerRecipient: { type: Number, default: 1 },
        frequencyCapHours: { type: Number, default: 24 },
        cancelOnPurchase: { type: Boolean, default: true },
        lookbackHours: { type: Number, default: 72 },
        lastRunAt: Date,
        stats: { queued: { type: Number, default: 0 }, sent: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, skipped: { type: Number, default: 0 }, converted: { type: Number, default: 0 } },
    },
    { timestamps: true }
);

const automationRunSchema = new mongoose.Schema(
    {
        automation: { type: ObjectId, ref: 'Automation', index: true },
        startedAt: Date,
        finishedAt: Date,
        candidates: Number,
        queued: Number,
        skipped: Number,
        error: String,
    },
    { timestamps: true }
);
automationRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const subscriberSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: String,
        user: { type: ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'subscribed', 'unsubscribed'], default: 'pending', index: true },
        source: { type: String, default: 'newsletter_form' },
        consentAt: Date,
        consentText: String,
        confirmTokenHash: String,
        confirmedAt: Date,
        unsubscribedAt: Date,
        ip: String,
    },
    { timestamps: true }
);

/** Addresses that must not receive marketing email (unsubscribed, bounced, complained). */
const suppressionSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true },
        reason: { type: String, enum: ['unsubscribed', 'bounced', 'complaint', 'manual'], default: 'unsubscribed' },
        source: String,
    },
    { timestamps: true }
);

const emailCampaignSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        subject: { type: String, required: true },
        preheader: String,
        html: { type: String, required: true },
        audience: { type: String, enum: ['newsletter', 'consented_customers', 'all_marketing'], default: 'newsletter' },
        offer: { type: ObjectId, ref: 'Offer' },
        status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'], default: 'draft', index: true },
        scheduledAt: Date,
        startedAt: Date,
        completedAt: Date,
        stats: { recipients: { type: Number, default: 0 }, sent: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, suppressed: { type: Number, default: 0 }, orders: { type: Number, default: 0 }, revenue: { type: Number, default: 0 } },
        createdBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

export const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
export const EmailMessage = mongoose.model('EmailMessage', emailMessageSchema);
export const Automation = mongoose.model('Automation', automationSchema);
export const AutomationRun = mongoose.model('AutomationRun', automationRunSchema);
export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export const Suppression = mongoose.model('Suppression', suppressionSchema);
export const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
