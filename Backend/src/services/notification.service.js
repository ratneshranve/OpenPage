import admin from 'firebase-admin';
import { config, integrationStatus } from '../config/env.js';
import { NotificationSubscription, NotificationCampaign } from '../models/index.js';
import { getSettings } from './settings.service.js';
import { logger } from '../utils/logger.js';

let app = null;
let initError = null;

const getMessaging = () => {
    if (!integrationStatus().firebaseAdmin) return null;
    if (!app && !initError) {
        try {
            app = admin.initializeApp({
                credential: admin.credential.cert({ projectId: config.firebase.projectId, clientEmail: config.firebase.clientEmail, privateKey: config.firebase.privateKey }),
            }, 'openpage');
        } catch (err) {
            initError = err.message;
            logger.error(`Firebase init failed: ${err.message}`);
        }
    }
    return app ? admin.messaging(app) : null;
};

export const firebaseStatus = () => ({ adminConfigured: integrationStatus().firebaseAdmin, webConfigured: integrationStatus().firebaseWeb, initialized: Boolean(app), error: initError });

/** Public web config. Only identifiers that are designed to be public are exposed. */
export const firebaseWebConfig = () =>
    integrationStatus().firebaseWeb
        ? { apiKey: config.firebase.webApiKey, authDomain: config.firebase.authDomain, projectId: config.firebase.projectId, messagingSenderId: config.firebase.messagingSenderId, appId: config.firebase.appId, vapidKey: config.firebase.vapidKey }
        : null;

export const registerToken = async ({ token, installationId, permission = 'granted', user, userAgent }) =>
    NotificationSubscription.findOneAndUpdate(
        { token },
        { $set: { installationId, permission, active: permission === 'granted', user: user?._id, userAgent: userAgent?.slice(0, 300), lastSeenAt: new Date() } },
        { upsert: true, new: true }
    );

export const unregisterToken = async ({ token, installationId }) => {
    const filter = token ? { token } : { installationId };
    if (!token && !installationId) return;
    await NotificationSubscription.updateMany(filter, { $set: { active: false, permission: 'default' } });
};

const INVALID_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

const sendToTokens = async (subs, { title, body, url, imageUrl }) => {
    const messaging = getMessaging();
    if (!messaging) throw new Error('Firebase is not configured');
    const link = url?.startsWith('http') ? url : `${config.frontendUrl}${url?.startsWith('/') ? url : `/${url || ''}`}`;
    const result = { delivered: 0, failed: 0, removed: 0, errors: {} };
    for (let i = 0; i < subs.length; i += 500) {
        const chunk = subs.slice(i, i + 500);
        const res = await messaging.sendEachForMulticast({
            tokens: chunk.map((s) => s.token),
            notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
            data: { url: link },
            webpush: { fcmOptions: { link }, notification: { icon: `${config.frontendUrl}/icon-192.png` } },
        });
        const now = new Date();
        const ops = res.responses.map((r, idx) => {
            const sub = chunk[idx];
            if (r.success) {
                result.delivered += 1;
                return { updateOne: { filter: { _id: sub._id }, update: { $set: { lastNotifiedAt: now, lastError: null }, $inc: { deliveredCount: 1 } } } };
            }
            result.failed += 1;
            const code = r.error?.code || 'unknown';
            result.errors[code] = (result.errors[code] || 0) + 1;
            if (INVALID_TOKEN_CODES.has(code)) {
                result.removed += 1;
                return { updateOne: { filter: { _id: sub._id }, update: { $set: { active: false, lastError: code } } } };
            }
            return { updateOne: { filter: { _id: sub._id }, update: { $set: { lastError: code }, $inc: { errorCount: 1 } } } };
        });
        if (ops.length) await NotificationSubscription.bulkWrite(ops);
    }
    return result;
};

export const sendCampaign = async (campaignId) => {
    const settings = await getSettings('notifications');
    const campaign = await NotificationCampaign.findOneAndUpdate(
        { _id: campaignId, status: { $in: ['scheduled', 'draft'] }, active: true },
        { $set: { status: 'sending' } },
        { new: true }
    );
    if (!campaign) return null;
    if (!settings.enabled) {
        await NotificationCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'failed' }, $push: { errors: { code: 'disabled', message: 'Notifications are globally disabled', count: 1 } } });
        return null;
    }
    const filter = { active: true, permission: 'granted' };
    if (campaign.audience === 'customers') filter.user = { $ne: null };
    if (campaign.audience === 'guests') filter.user = null;
    const all = await NotificationSubscription.find(filter).select('token lastNotifiedAt').lean();
    // Frequency limit per browser.
    const cutoff = Date.now() - settings.minHoursBetweenNotifications * 3600 * 1000;
    const eligible = all.filter((s) => !s.lastNotifiedAt || new Date(s.lastNotifiedAt).getTime() < cutoff);
    try {
        const r = await sendToTokens(eligible, campaign);
        await NotificationCampaign.updateOne(
            { _id: campaign._id },
            {
                $set: {
                    status: 'sent',
                    sentAt: new Date(),
                    stats: { targeted: all.length, delivered: r.delivered, failed: r.failed, skipped: all.length - eligible.length, removedTokens: r.removed },
                    errors: Object.entries(r.errors).map(([code, count]) => ({ code, count, message: code })),
                },
            }
        );
    } catch (err) {
        await NotificationCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'failed' }, $push: { errors: { code: 'send_error', message: err.message, count: 1 } } });
        throw err;
    }
    return NotificationCampaign.findById(campaign._id);
};

export const sendTest = async ({ token, title, body, url }) => {
    const sub = await NotificationSubscription.findOne({ token, active: true }).lean();
    if (!sub) throw new Error('That browser is not subscribed. Enable notifications on the storefront in this browser first.');
    return sendToTokens([sub], { title, body, url });
};

export const runScheduledNotifications = async () => {
    const due = await NotificationCampaign.find({ status: 'scheduled', active: true, scheduledAt: { $lte: new Date() } }).select('_id').lean();
    for (const c of due) {
        try {
            await sendCampaign(c._id);
        } catch (err) {
            logger.error(`Notification campaign ${c._id} failed: ${err.message}`);
        }
    }
};

export const subscriptionStats = async () => {
    const [active, total, customers] = await Promise.all([
        NotificationSubscription.countDocuments({ active: true }),
        NotificationSubscription.countDocuments({}),
        NotificationSubscription.countDocuments({ active: true, user: { $ne: null } }),
    ]);
    return { active, total, inactive: total - active, customers, guests: active - customers };
};
