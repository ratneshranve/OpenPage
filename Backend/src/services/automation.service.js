import { config } from '../config/env.js';
import { Automation, AutomationRun, CheckoutSession, EmailMessage, Order, Subscriber, Suppression, User, EmailCampaign } from '../models/index.js';
import { queueEmail } from './email.service.js';
import { logger } from '../utils/logger.js';

/**
 * Marketing automations. They only ever queue *marketing* emails, which are checked against
 * the suppression list again at send time. Transactional emails (receipts, downloads) are
 * never affected by any setting here.
 */

const recentlyEmailed = async (email, hours) =>
    hours > 0 &&
    Boolean(await EmailMessage.exists({ to: email, category: 'marketing', status: { $in: ['queued', 'sending', 'sent'] }, createdAt: { $gte: new Date(Date.now() - hours * 3600 * 1000) } }));

const alreadySent = async (automation, email) =>
    (await EmailMessage.countDocuments({ automation: automation._id, to: email, status: { $in: ['queued', 'sending', 'sent'] } })) >= (automation.maxPerRecipient || 1);

const hasMarketingConsent = async (email, extra = false) => {
    if (extra) return true;
    if (await Subscriber.exists({ email, status: 'subscribed' })) return true;
    return Boolean(await User.exists({ email, marketingEmails: true }));
};

const runAbandoned = async (automation, run) => {
    const now = Date.now();
    const delayMs = automation.delayMinutes * 60000;
    const lookback = (automation.lookbackHours || 720) * 3600000;
    const filter = {
        emailVerifiedAt: { $ne: null },
        status: { $in: ['active', 'payment_pending'] },
        lastActivityAt: { $gte: new Date(now - lookback) },
    };

    if (automation.isRecurring) {
        // Recurring reminder: for sessions that completed initial steps, continue periodically until purchase
        filter.remindersSent = { $gte: automation.step - 1, $lt: 25 };
        filter.lastReminderAt = { $lte: new Date(now - delayMs) };
    } else {
        filter.remindersSent = automation.step - 1;
        // Step 1 waits from customer's last activity; later steps wait from previous reminder
        if (automation.step === 1) filter.lastActivityAt.$lte = new Date(now - delayMs);
        else filter.lastReminderAt = { $lte: new Date(now - delayMs) };
    }

    // Do NOT require marketing consent for abandoned checkout recovery
    if (automation.conditions?.requireMarketingConsent && automation.trigger !== 'checkout_abandoned') {
        filter.marketingConsent = true;
    }
    if (automation.audience === 'registered_only') filter.user = { $ne: null };
    if (automation.audience === 'guests_only') filter.user = null;

    const sessions = await CheckoutSession.find(filter).limit(200).lean();
    run.candidates = sessions.length;
    for (const s of sessions) {
        const email = s.email;

        // Check if customer already purchased or paid
        const hasPurchased = await Order.exists({
            email,
            status: { $in: ['paid', 'partially_refunded'] },
            $or: [{ paidAt: { $gte: s.createdAt } }, { status: 'paid' }],
        });

        if (hasPurchased) {
            // Customer purchased: convert session and stop further recovery emails
            await CheckoutSession.updateOne({ _id: s._id }, { $set: { status: 'converted' } });
            continue;
        }

        const skip =
            (await Suppression.exists({ email })) ||
            (automation.conditions?.minOrderValue && (s.cartSnapshot?.total || 0) < automation.conditions.minOrderValue) ||
            (!automation.isRecurring && (await alreadySent(automation, email))) ||
            (await recentlyEmailed(email, automation.frequencyCapHours));

        if (skip) {
            run.skipped += 1;
            if (!automation.isRecurring) {
                await CheckoutSession.updateOne({ _id: s._id }, { $set: { remindersSent: automation.step, lastReminderAt: new Date() } });
            }
            continue;
        }

        const nextReminderCount = (s.remindersSent || 0) + 1;
        await queueEmail({
            to: email,
            templateKey: automation.templateKey,
            type: 'abandoned_checkout',
            automation: automation._id,
            checkoutSession: s._id,
            data: { sessionId: String(s._id) },
            dedupeKey: `auto:${automation.key}:${s._id}:${nextReminderCount}`,
        });

        await CheckoutSession.updateOne({ _id: s._id }, { $set: { remindersSent: nextReminderCount, lastReminderAt: new Date() } });
        await Automation.updateOne({ _id: automation._id }, { $inc: { 'stats.queued': 1 } });
        run.queued += 1;
    }
};

const runOrderPaid = async (automation, run) => {
    const now = Date.now();
    const delayMs = automation.delayMinutes * 60000;
    const filter = {
        status: 'paid',
        paidAt: { $lte: new Date(now - delayMs), $gte: new Date(now - delayMs - automation.lookbackHours * 3600000) },
    };
    if (automation.conditions?.productIds?.length) filter['items.product'] = { $in: automation.conditions.productIds };
    if (automation.conditions?.minOrderValue) filter.total = { $gte: automation.conditions.minOrderValue };
    if (automation.audience === 'registered_only') filter.user = { $ne: null };
    if (automation.audience === 'guests_only') filter.user = null;

    const orders = await Order.find(filter).limit(200).lean();
    run.candidates = orders.length;
    for (const order of orders) {
        const email = order.email;
        const exists = await EmailMessage.exists({ dedupeKey: `auto:${automation.key}:${order._id}` });
        if (exists) continue;
        const skip =
            (await Suppression.exists({ email })) ||
            (automation.conditions?.requireMarketingConsent && !(await hasMarketingConsent(email, order.marketingConsent))) ||
            (await alreadySent(automation, email)) ||
            (await recentlyEmailed(email, automation.frequencyCapHours));
        if (skip) {
            run.skipped += 1;
            continue;
        }
        await queueEmail({
            to: email,
            templateKey: automation.templateKey,
            type: 'post_purchase',
            automation: automation._id,
            order: order._id,
            data: { orderId: String(order._id) },
            dedupeKey: `auto:${automation.key}:${order._id}`,
        });
        await Automation.updateOne({ _id: automation._id }, { $inc: { 'stats.queued': 1 } });
        run.queued += 1;
    }
};

let running = false;
export const runAutomations = async ({ only } = {}) => {
    if (!config.jobs.automationEnabled || running) return;
    running = true;
    try {
        const automations = await Automation.find(only ? { _id: only } : { enabled: true }).sort({ trigger: 1, step: 1 });
        for (const automation of automations) {
            const run = { automation: automation._id, startedAt: new Date(), candidates: 0, queued: 0, skipped: 0 };
            try {
                if (automation.trigger === 'checkout_abandoned') await runAbandoned(automation, run);
                else if (automation.trigger === 'order_paid') await runOrderPaid(automation, run);
            } catch (err) {
                run.error = err.message;
                logger.error(`Automation ${automation.key} failed: ${err.message}`);
            }
            run.finishedAt = new Date();
            await AutomationRun.create(run);
            await Automation.updateOne({ _id: automation._id }, { $set: { lastRunAt: run.finishedAt }, $inc: { 'stats.skipped': run.skipped } });
        }
    } finally {
        running = false;
    }
};

// ---- Email campaigns ----

const campaignAudience = async (audience) => {
    const emails = new Set();
    if (audience === 'newsletter' || audience === 'all_marketing') {
        (await Subscriber.find({ status: 'subscribed' }).select('email').lean()).forEach((s) => emails.add(s.email));
    }
    if (audience === 'consented_customers' || audience === 'all_marketing') {
        (await User.find({ marketingEmails: true, emailVerified: true, status: 'active' }).select('email').lean()).forEach((u) => emails.add(u.email));
    }
    const suppressed = new Set((await Suppression.find({ email: { $in: [...emails] } }).select('email').lean()).map((s) => s.email));
    return { recipients: [...emails].filter((e) => !suppressed.has(e)), suppressed: suppressed.size };
};

export const previewCampaignAudience = async (audience) => {
    const { recipients, suppressed } = await campaignAudience(audience);
    return { count: recipients.length, suppressed };
};

export const startCampaign = async (campaignId) => {
    const campaign = await EmailCampaign.findOneAndUpdate({ _id: campaignId, status: 'scheduled' }, { $set: { status: 'sending', startedAt: new Date() } }, { new: true });
    if (!campaign) return;
    const { recipients, suppressed } = await campaignAudience(campaign.audience);
    for (const to of recipients) {
        await queueEmail({ to, templateKey: 'campaign_default', type: 'campaign', campaign: campaign._id, dedupeKey: `campaign:${campaign._id}:${to}` });
    }
    await EmailCampaign.updateOne({ _id: campaign._id }, { $set: { status: 'sent', completedAt: new Date(), 'stats.recipients': recipients.length, 'stats.suppressed': suppressed } });
};

export const runScheduledCampaigns = async () => {
    const due = await EmailCampaign.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).select('_id').lean();
    for (const c of due) {
        try {
            await startCampaign(c._id);
        } catch (err) {
            logger.error(`Campaign ${c._id} failed to start: ${err.message}`);
        }
    }
};

export const pauseCampaign = async (campaign) => {
    await EmailMessage.updateMany({ campaign: campaign._id, status: 'queued' }, { $set: { status: 'cancelled', lastError: 'Campaign paused' } });
    campaign.status = 'paused';
    await campaign.save();
};

export const resumeCampaign = async (campaign) => {
    await EmailMessage.updateMany({ campaign: campaign._id, status: 'cancelled', lastError: 'Campaign paused' }, { $set: { status: 'queued', nextAttemptAt: new Date(), lastError: null } });
    campaign.status = campaign.startedAt ? 'sent' : 'scheduled';
    await campaign.save();
};
