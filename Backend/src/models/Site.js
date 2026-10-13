import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

/**
 * Non-secret, admin-editable configuration. Stored as a few keyed documents
 * (general, homepage, seo, tracking, ...). Secrets live only in environment variables.
 */
const settingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: Mixed, default: {} },
        updatedBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true, minimize: false }
);

const pageSchema = new mongoose.Schema(
    {
        slug: { type: String, required: true, unique: true, lowercase: true },
        title: { type: String, required: true },
        type: { type: String, enum: ['legal', 'content'], default: 'content' },
        body: { type: String, default: '' },
        published: { type: Boolean, default: true },
        seo: { title: String, description: String, noindex: { type: Boolean, default: false } },
        version: { type: Number, default: 1 },
        updatedBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

const redirectSchema = new mongoose.Schema(
    {
        from: { type: String, required: true, unique: true },
        to: { type: String, required: true },
        statusCode: { type: Number, enum: [301, 302], default: 301 },
        active: { type: Boolean, default: true },
        hits: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
    {
        actor: { type: ObjectId, ref: 'User', index: true },
        actorEmail: String,
        action: { type: String, required: true, index: true },
        targetType: { type: String, index: true },
        targetId: { type: String, index: true },
        outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
        details: Mixed,
        ip: String,
        userAgent: String,
    },
    { timestamps: true }
);
auditLogSchema.index({ createdAt: -1 });

const supportTicketSchema = new mongoose.Schema(
    {
        ticketNumber: { type: String, required: true, unique: true },
        name: { type: String, maxlength: 120 },
        email: { type: String, required: true, lowercase: true, index: true },
        user: { type: ObjectId, ref: 'User', index: true },
        orderNumber: String,
        order: { type: ObjectId, ref: 'Order' },
        category: { type: String, enum: ['download', 'payment', 'refund', 'account', 'product', 'other'], default: 'other' },
        subject: { type: String, maxlength: 200 },
        message: { type: String, required: true, maxlength: 5000 },
        status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open', index: true },
        priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
        replies: [{ from: { type: String, enum: ['customer', 'admin'] }, by: { type: ObjectId, ref: 'User' }, message: String, at: { type: Date, default: Date.now }, _id: false }],
        internalNotes: [{ by: { type: ObjectId, ref: 'User' }, text: String, at: { type: Date, default: Date.now }, _id: false }],
        refundRequest: { type: ObjectId, ref: 'RefundRequest' },
        ip: String,
    },
    { timestamps: true }
);

const consentRecordSchema = new mongoose.Schema(
    {
        visitorId: { type: String, index: true },
        user: { type: ObjectId, ref: 'User' },
        analytics: Boolean,
        advertising: Boolean,
        policyVersion: String,
        action: { type: String, enum: ['accept_all', 'reject_all', 'custom', 'withdraw'] },
        ip: String,
        userAgent: String,
    },
    { timestamps: true }
);

const notificationSubscriptionSchema = new mongoose.Schema(
    {
        token: { type: String, required: true, unique: true },
        installationId: { type: String, index: true },
        user: { type: ObjectId, ref: 'User', index: true },
        permission: { type: String, enum: ['granted', 'denied', 'default'], default: 'granted' },
        active: { type: Boolean, default: true, index: true },
        userAgent: String,
        lastSeenAt: Date,
        lastNotifiedAt: Date,
        deliveredCount: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        lastError: String,
    },
    { timestamps: true }
);

const notificationCampaignSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, maxlength: 80 },
        body: { type: String, required: true, maxlength: 240 },
        url: { type: String, default: '/' },
        imageUrl: String,
        type: { type: String, enum: ['launch', 'offer', 'price_drop', 'announcement', 'reminder'], default: 'announcement' },
        audience: { type: String, enum: ['all', 'customers', 'guests'], default: 'all' },
        offer: { type: ObjectId, ref: 'Offer' },
        product: { type: ObjectId, ref: 'Product' },
        active: { type: Boolean, default: true },
        status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'], default: 'draft', index: true },
        scheduledAt: Date,
        sentAt: Date,
        stats: { targeted: { type: Number, default: 0 }, delivered: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, skipped: { type: Number, default: 0 }, removedTokens: { type: Number, default: 0 } },
        errors: [{ code: String, message: String, count: Number, _id: false }],
        createdBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true, suppressReservedKeysWarning: true }
);

/** Generic durable background job (webhook processing, campaign sends, ...). */
const jobSchema = new mongoose.Schema(
    {
        type: { type: String, required: true, index: true },
        payload: Mixed,
        status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued', index: true },
        runAt: { type: Date, default: Date.now },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        lockedAt: Date,
        lastError: String,
        dedupeKey: { type: String, unique: true, sparse: true },
        finishedAt: Date,
    },
    { timestamps: true }
);
jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

export const Setting = mongoose.model('Setting', settingSchema);
export const Page = mongoose.model('Page', pageSchema);
export const Redirect = mongoose.model('Redirect', redirectSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export const ConsentRecord = mongoose.model('ConsentRecord', consentRecordSchema);
export const NotificationSubscription = mongoose.model('NotificationSubscription', notificationSubscriptionSchema);
export const NotificationCampaign = mongoose.model('NotificationCampaign', notificationCampaignSchema);
export const Job = mongoose.model('Job', jobSchema);
export const Counter = mongoose.model('Counter', counterSchema);
