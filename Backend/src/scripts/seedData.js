import { Automation, Category, Page } from '../models/index.js';
import { ensureDefaultTemplates } from '../services/email.service.js';
import { LEGAL_PAGES } from './legalContent.js';
import { logger } from '../utils/logger.js';

/**
 * Marketing automations are created disabled. The admin reviews the consent rules and
 * enables them deliberately.
 */
export const DEFAULT_AUTOMATIONS = [
    {
        key: 'abandoned_checkout_1',
        name: 'Abandoned checkout: first reminder',
        description: 'Reminds customers who verified their email and opted in to marketing, but did not complete payment.',
        trigger: 'checkout_abandoned',
        step: 1,
        delayMinutes: 120,
        templateKey: 'abandoned_checkout_1',
        conditions: { requireMarketingConsent: true },
        maxPerRecipient: 1,
        frequencyCapHours: 24,
        lookbackHours: 72,
    },
    {
        key: 'abandoned_checkout_2',
        name: 'Abandoned checkout: second reminder',
        description: 'Optional final reminder about 24 hours after the first one.',
        trigger: 'checkout_abandoned',
        step: 2,
        delayMinutes: 24 * 60,
        templateKey: 'abandoned_checkout_2',
        conditions: { requireMarketingConsent: true },
        maxPerRecipient: 1,
        frequencyCapHours: 20,
        lookbackHours: 96,
    },
    {
        key: 'post_purchase_getting_started',
        name: 'Post-purchase: getting started',
        description: 'Helpful tips one day after purchase, for customers who opted in to emails.',
        trigger: 'order_paid',
        delayMinutes: 24 * 60,
        templateKey: 'post_purchase_getting_started',
        conditions: { requireMarketingConsent: true },
        maxPerRecipient: 3,
        frequencyCapHours: 24,
        lookbackHours: 48,
    },
    {
        key: 'post_purchase_recommendations',
        name: 'Post-purchase: related eBooks',
        description: 'Recommends related titles three days after purchase.',
        trigger: 'order_paid',
        delayMinutes: 3 * 24 * 60,
        templateKey: 'post_purchase_recommendations',
        conditions: { requireMarketingConsent: true },
        maxPerRecipient: 3,
        frequencyCapHours: 48,
        lookbackHours: 48,
    },
    {
        key: 'post_purchase_review_request',
        name: 'Post-purchase: review request',
        description: 'Asks for an honest review a week after purchase.',
        trigger: 'order_paid',
        delayMinutes: 7 * 24 * 60,
        templateKey: 'review_request',
        conditions: { requireMarketingConsent: true },
        maxPerRecipient: 2,
        frequencyCapHours: 48,
        lookbackHours: 72,
    },
];

const DEFAULT_CATEGORIES = [
    { name: 'AI Automation', slug: 'ai-automation', description: 'Practical guides to automating everyday work with AI tools and workflows.', order: 1 },
    { name: 'Business Operations', slug: 'business-operations', description: 'Systems, processes and playbooks for running a lean, reliable business.', order: 2 },
    { name: 'Marketing', slug: 'marketing', description: 'Actionable marketing strategy, content and growth guides.', order: 3 },
    { name: 'Productivity', slug: 'productivity', description: 'Focus, planning and personal systems for getting meaningful work done.', order: 4 },
];

/** Idempotent: inserts only what is missing, never overwrites admin edits. */
export const ensureSeedData = async () => {
    await ensureDefaultTemplates();
    for (const a of DEFAULT_AUTOMATIONS) {
        await Automation.updateOne({ key: a.key }, { $setOnInsert: { ...a, enabled: false } }, { upsert: true });
    }
    for (const p of LEGAL_PAGES) {
        await Page.updateOne({ slug: p.slug }, { $setOnInsert: { ...p, published: true } }, { upsert: true });
    }
    if (!(await Category.estimatedDocumentCount())) {
        await Category.insertMany(DEFAULT_CATEGORIES);
        logger.info('Seeded default categories');
    }
};
