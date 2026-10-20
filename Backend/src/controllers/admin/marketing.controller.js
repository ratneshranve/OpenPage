import { Offer, OfferRedemption, EmailTemplate, EmailMessage, Automation, AutomationRun, EmailCampaign, NotificationCampaign, NotificationSubscription, Order } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, paginated, parsePagination } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { activeOfferFilter } from '../../services/pricing.service.js';
import { DEFAULT_TEMPLATES } from '../../emails/defaultTemplates.js';
import { renderEmail, queueEmail, verifySmtp, sendNow } from '../../services/email.service.js';
import { runAutomations, previewCampaignAudience, startCampaign, pauseCampaign, resumeCampaign } from '../../services/automation.service.js';
import { sendCampaign, sendTest, subscriptionStats, firebaseStatus } from '../../services/notification.service.js';
import { getSettings } from '../../services/settings.service.js';

// ---- Offers & coupons ----
const offerState = (o, now = Date.now()) => {
    if (!o.active) return 'inactive';
    if (o.paused) return 'paused';
    if (o.startsAt && new Date(o.startsAt).getTime() > now) return 'scheduled';
    if (o.endsAt && new Date(o.endsAt).getTime() <= now) return 'expired';
    if (o.redemptionLimit && o.redemptionCount >= o.redemptionLimit) return 'exhausted';
    return 'live';
};

export const listOffers = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.type === 'coupon') filter.couponCode = { $exists: true, $ne: null };
    if (req.query.type === 'automatic') filter.$or = [{ couponCode: null }, { couponCode: { $exists: false } }];
    if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q)), 'i');
    const offers = await Offer.find(filter).sort({ createdAt: -1 }).populate('products', 'title').populate('categories', 'name').lean();
    ok(res, offers.map((o) => ({ ...o, state: offerState(o) })));
});

const validateOffer = (data) => {
    if (data.discountType === 'percentage' && (data.value <= 0 || data.value > 100)) throw ApiError.badRequest('Percentage must be between 1 and 100.');
    if (data.discountType === 'bundle' && (data.products?.length || 0) < 2) throw ApiError.badRequest('A bundle needs at least two products.');
    if (data.discountType === 'bundle') data.appliesTo = 'products';
    if (data.appliesTo === 'products' && !data.products?.length) throw ApiError.badRequest('Choose at least one product.');
    if (data.appliesTo === 'categories' && !data.categories?.length) throw ApiError.badRequest('Choose at least one category.');
    if (data.startsAt && data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) throw ApiError.badRequest('The end date must be after the start date.');
    if (data.couponCode === '') data.couponCode = undefined;
    return data;
};

export const createOffer = asyncHandler(async (req, res) => {
    const offer = await Offer.create(validateOffer({ ...req.body }));
    await audit(req, 'offer.create', { targetType: 'Offer', targetId: offer._id, details: { name: offer.name, code: offer.couponCode } });
    created(res, offer, 'Offer saved.');
});

export const updateOffer = asyncHandler(async (req, res) => {
    const offer = await Offer.findById(req.params.id);
    if (!offer) throw ApiError.notFound('Offer not found');
    const data = validateOffer({ ...offer.toObject(), ...req.body });
    offer.set(req.body);
    if (data.couponCode === undefined) offer.couponCode = undefined;
    offer.appliesTo = data.appliesTo;
    await offer.save();
    // Completed orders keep the price snapshot they were charged; nothing is recalculated.
    await audit(req, 'offer.update', { targetType: 'Offer', targetId: offer._id, details: { changed: Object.keys(req.body) } });
    ok(res, offer, 'Offer saved.');
});

export const setOfferState = asyncHandler(async (req, res) => {
    const offer = await Offer.findById(req.params.id);
    if (!offer) throw ApiError.notFound('Offer not found');
    const { action } = req.body;
    if (action === 'activate') Object.assign(offer, { active: true, paused: false });
    else if (action === 'deactivate') offer.active = false;
    else if (action === 'pause') offer.paused = true;
    else if (action === 'resume') offer.paused = false;
    else throw ApiError.badRequest('Unknown action');
    await offer.save();
    await audit(req, `offer.${action}`, { targetType: 'Offer', targetId: offer._id });
    ok(res, { ...offer.toObject(), state: offerState(offer) }, action === 'activate' ? 'Offer activated.' : `Offer ${action}d.`);
});

export const deleteOffer = asyncHandler(async (req, res) => {
    if (await OfferRedemption.exists({ offer: req.params.id })) throw ApiError.conflict('This offer has been used in orders. Deactivate it instead so reports stay accurate.');
    await Offer.deleteOne({ _id: req.params.id });
    await audit(req, 'offer.delete', { targetType: 'Offer', targetId: req.params.id });
    ok(res, null, 'Offer deleted.');
});

export const offerRedemptions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total, [summary]] = await Promise.all([
        OfferRedemption.find({ offer: req.params.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber status total currency paidAt').lean(),
        OfferRedemption.countDocuments({ offer: req.params.id }),
        OfferRedemption.aggregate([{ $match: { offer: (await Offer.findById(req.params.id).select('_id'))?._id } }, { $group: { _id: null, uses: { $sum: 1 }, discount: { $sum: '$discount' }, revenue: { $sum: '$orderTotal' } } }]),
    ]);
    ok(res, { ...paginated(items, total, { page, limit }), summary: summary || { uses: 0, discount: 0, revenue: 0 } });
});

export const liveOffersCount = async () => Offer.countDocuments(activeOfferFilter());

// ---- Email templates ----
export const listTemplates = asyncHandler(async (_req, res) => {
    ok(res, await EmailTemplate.find({}).sort({ category: 1, name: 1 }).select('key name category subject updatedAt isSystem description').lean());
});

export const getTemplate = asyncHandler(async (req, res) => {
    const tpl = await EmailTemplate.findOne({ key: req.params.key }).lean();
    if (!tpl) throw ApiError.notFound('Template not found');
    ok(res, tpl);
});

export const updateTemplate = asyncHandler(async (req, res) => {
    const tpl = await EmailTemplate.findOneAndUpdate({ key: req.params.key }, { $set: { ...req.body, updatedBy: req.user._id } }, { new: true });
    if (!tpl) throw ApiError.notFound('Template not found');
    await audit(req, 'email_template.update', { targetType: 'EmailTemplate', targetId: tpl.key });
    ok(res, tpl, 'Template saved.');
});

export const resetTemplate = asyncHandler(async (req, res) => {
    const def = DEFAULT_TEMPLATES.find((t) => t.key === req.params.key);
    if (!def) throw ApiError.notFound('No default exists for this template');
    const tpl = await EmailTemplate.findOneAndUpdate({ key: def.key }, { $set: { ...def, updatedBy: req.user._id } }, { new: true, upsert: true });
    await audit(req, 'email_template.reset', { targetType: 'EmailTemplate', targetId: def.key });
    ok(res, tpl, 'Template restored to default.');
});

const SAMPLE_DATA = {
    code: '123456',
    expiresInMinutes: 5,
    orderNumber: 'OP-SAMPLE01',
    customerName: 'Alex',
    items: [{ title: 'Sample eBook: AI Automation Playbook', totalFormatted: '₹499.00' }],
    downloads: [{ title: 'Sample eBook: AI Automation Playbook', url: '#', format: 'PDF', version: '1.0' }],
    totalFormatted: '₹499.00',
    discountFormatted: '₹100.00',
    paidAt: new Date().toLocaleString('en-IN'),
    hasAccount: true,
    libraryUrl: '#',
    downloadHelpUrl: '#',
    linkTtlText: '1 hour(s)',
    retryUrl: '#',
    statusUrl: '#',
    refundNumber: 'RF-SAMPLE01',
    statusLabel: 'Approved',
    amountFormatted: '₹499.00',
    message: 'This is a sample message.',
    verifyUrl: '#',
    resetUrl: '#',
    confirmUrl: '#',
    checkoutUrl: '#',
    reviewUrl: '#',
    ticketNumber: 'ST-SAMPLE1',
    subject: 'Download issue',
    responseTime: 'We usually reply within 1 business day.',
    recommendations: [{ title: 'Another useful eBook', shortDescription: 'A short description.', url: '#' }],
    content: '<p>Your campaign content appears here.</p>',
};

export const previewTemplate = asyncHandler(async (req, res) => {
    const base = (await EmailTemplate.findOne({ key: req.params.key }).lean()) || DEFAULT_TEMPLATES.find((t) => t.key === req.params.key);
    if (!base) throw ApiError.notFound('Template not found');
    const template = { ...base, ...(req.body.subject ? { subject: req.body.subject } : {}), ...(req.body.html ? { html: req.body.html } : {}), ...(req.body.preheader !== undefined ? { preheader: req.body.preheader } : {}) };
    const rendered = await renderEmail({ template, to: req.user.email, data: SAMPLE_DATA });
    ok(res, { subject: rendered.subject, html: rendered.html });
});

export const sendTestEmail = asyncHandler(async (req, res) => {
    const to = req.body.to || req.user.email;
    const key = req.body.templateKey || 'test_email';
    const result = await sendNow({ to, templateKey: key, type: 'test_email', data: SAMPLE_DATA });
    await audit(req, 'email.test_send', { details: { to, key, ok: result.ok } });
    if (!result.ok) throw new ApiError(502, `Email could not be sent: ${result.error}`);
    ok(res, null, `Test email sent to ${to}.`);
});

export const smtpStatus = asyncHandler(async (_req, res) => ok(res, await verifySmtp()));

// ---- Email logs ----
export const listEmailLogs = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
    const filter = {};
    for (const key of ['status', 'category', 'type', 'templateKey']) if (req.query[key]) filter[key] = req.query[key];
    if (req.query.q) filter.to = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
    const [items, total, counts] = await Promise.all([
        EmailMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-data').populate('order', 'orderNumber').lean(),
        EmailMessage.countDocuments(filter),
        EmailMessage.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    ok(res, { ...paginated(items, total, { page, limit }), last7Days: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

export const previewEmailLog = asyncHandler(async (req, res) => {
    const msg = await EmailMessage.findById(req.params.id).populate('order').lean();
    if (!msg) throw ApiError.notFound('Email log not found');
    let subject = msg.subject;
    let html = msg.bodyHtml;
    let text = msg.bodyText;

    if (!html && msg.templateKey) {
        try {
            const { getTemplate, renderEmail } = await import('../../services/email.service.js');
            const template = await getTemplate(msg.templateKey);
            if (template) {
                const { buildEmailContext } = await import('../../services/emailContext.service.js');
                const dynamic = await buildEmailContext(msg);
                const { __template, ...dynamicData } = dynamic || {};
                const data = { ...(msg.data || {}), ...dynamicData };
                const tpl = { ...template, ...(msg.subject ? { subject: msg.subject } : {}), ...(__template || {}) };
                const rendered = await renderEmail({ template: tpl, to: msg.to, data, category: msg.category });
                subject = subject || rendered.subject;
                html = rendered.html;
                text = rendered.text;
            }
        } catch {
            // fallback if context cannot be fully rebuilt
        }
    }

    ok(res, { subject, html, text });
});

export const retryEmail = asyncHandler(async (req, res) => {
    const msg = await EmailMessage.findOneAndUpdate({ _id: req.params.id, status: { $in: ['failed', 'cancelled'] }, sensitive: { $ne: true } }, { $set: { status: 'queued', nextAttemptAt: new Date(), maxAttempts: 3, attempts: 0 } }, { new: true });
    if (!msg) throw ApiError.badRequest('Only failed or cancelled emails can be retried. OTP emails cannot be re-sent from here.');
    await audit(req, 'email.retry', { targetType: 'EmailMessage', targetId: msg._id });
    ok(res, null, 'Email queued for another attempt.');
});

export const cancelEmail = asyncHandler(async (req, res) => {
    const msg = await EmailMessage.findOneAndUpdate({ _id: req.params.id, status: 'queued' }, { $set: { status: 'cancelled', lastError: 'Cancelled by admin' } });
    if (!msg) throw ApiError.badRequest('Only queued emails can be cancelled.');
    await audit(req, 'email.cancel', { targetType: 'EmailMessage', targetId: msg._id });
    ok(res, null, 'Email cancelled.');
});

// ---- Automations ----
export const listAutomations = asyncHandler(async (_req, res) => {
    const autos = await Automation.find({}).sort({ trigger: 1, step: 1, delayMinutes: 1 }).lean();
    ok(res, autos);
});

export const updateAutomation = asyncHandler(async (req, res) => {
    const auto = await Automation.findById(req.params.id);
    if (!auto) throw ApiError.notFound('Automation not found');
    if (req.body.templateKey && !(await EmailTemplate.exists({ key: req.body.templateKey }))) throw ApiError.badRequest('Template not found');
    auto.set(req.body);
    await auto.save();
    await audit(req, 'automation.update', { targetType: 'Automation', targetId: auto._id, details: req.body });
    ok(res, auto, 'Automation saved.');
});

export const runAutomationNow = asyncHandler(async (req, res) => {
    const auto = await Automation.findById(req.params.id);
    if (!auto) throw ApiError.notFound('Automation not found');
    if (!auto.enabled) throw ApiError.badRequest('Enable the automation before running it.');
    await runAutomations({ only: auto._id });
    await audit(req, 'automation.run', { targetType: 'Automation', targetId: auto._id });
    ok(res, await AutomationRun.findOne({ automation: auto._id }).sort({ createdAt: -1 }).lean(), 'Automation run complete.');
});

export const automationRuns = asyncHandler(async (req, res) => {
    ok(res, await AutomationRun.find({ automation: req.params.id }).sort({ createdAt: -1 }).limit(50).lean());
});

// ---- Email campaigns ----
export const listCampaigns = asyncHandler(async (_req, res) => {
    ok(res, await EmailCampaign.find({}).sort({ createdAt: -1 }).populate('offer', 'name couponCode').lean());
});

const campaignRevenue = async (campaign) => {
    const [r] = await Order.aggregate([{ $match: { status: 'paid', 'attribution.campaign': `email-${campaign._id}` } }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } }]);
    return r || { orders: 0, revenue: 0 };
};

export const getCampaign = asyncHandler(async (req, res) => {
    const c = await EmailCampaign.findById(req.params.id).lean();
    if (!c) throw ApiError.notFound('Campaign not found');
    const statuses = await EmailMessage.aggregate([{ $match: { campaign: c._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    ok(res, { campaign: c, delivery: Object.fromEntries(statuses.map((s) => [s._id, s.n])), attributed: await campaignRevenue(c), utmHint: `?utm_source=email&utm_medium=campaign&utm_campaign=email-${c._id}` });
});

export const createCampaign = asyncHandler(async (req, res) => {
    const c = await EmailCampaign.create({ ...req.body, status: 'draft', createdBy: req.user._id });
    await audit(req, 'campaign.create', { targetType: 'EmailCampaign', targetId: c._id });
    created(res, c, 'Campaign saved.');
});

export const updateCampaign = asyncHandler(async (req, res) => {
    const c = await EmailCampaign.findById(req.params.id);
    if (!c) throw ApiError.notFound('Campaign not found');
    if (!['draft', 'scheduled'].includes(c.status)) throw ApiError.badRequest('Only draft or scheduled campaigns can be edited.');
    c.set(req.body);
    await c.save();
    await audit(req, 'campaign.update', { targetType: 'EmailCampaign', targetId: c._id });
    ok(res, c, 'Campaign saved.');
});

export const campaignAction = asyncHandler(async (req, res) => {
    const c = await EmailCampaign.findById(req.params.id);
    if (!c) throw ApiError.notFound('Campaign not found');
    const { action, scheduledAt } = req.body;
    if (action === 'schedule') {
        if (!['draft', 'scheduled'].includes(c.status)) throw ApiError.badRequest('This campaign has already been sent.');
        c.status = 'scheduled';
        c.scheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
        await c.save();
        if (c.scheduledAt <= new Date()) await startCampaign(c._id);
    } else if (action === 'pause') await pauseCampaign(c);
    else if (action === 'resume') await resumeCampaign(c);
    else if (action === 'cancel') {
        await EmailMessage.updateMany({ campaign: c._id, status: 'queued' }, { $set: { status: 'cancelled', lastError: 'Campaign cancelled' } });
        c.status = 'cancelled';
        await c.save();
    } else if (action === 'unschedule') {
        if (c.status !== 'scheduled') throw ApiError.badRequest('Only scheduled campaigns can be unscheduled.');
        c.status = 'draft';
        await c.save();
    } else throw ApiError.badRequest('Unknown action');
    await audit(req, `campaign.${action}`, { targetType: 'EmailCampaign', targetId: c._id });
    ok(res, await EmailCampaign.findById(c._id).lean(), 'Campaign updated.');
});

export const campaignAudience = asyncHandler(async (req, res) => ok(res, await previewCampaignAudience(req.query.audience || 'newsletter')));

export const campaignTest = asyncHandler(async (req, res) => {
    const c = await EmailCampaign.findById(req.params.id);
    if (!c) throw ApiError.notFound('Campaign not found');
    await queueEmail({ to: req.body.to || req.user.email, templateKey: 'campaign_default', type: 'campaign', campaign: c._id, categoryOverride: 'transactional', subject: `[TEST] ${c.subject}` });
    ok(res, null, 'Test email queued.');
});

// ---- Notifications ----
export const notificationOverview = asyncHandler(async (_req, res) => {
    const [stats, settings, recentErrors] = await Promise.all([
        subscriptionStats(),
        getSettings('notifications'),
        NotificationSubscription.aggregate([{ $match: { lastError: { $ne: null } } }, { $group: { _id: '$lastError', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
    ]);
    ok(res, { stats, settings, firebase: firebaseStatus(), recentErrors });
});

export const listNotificationCampaigns = asyncHandler(async (_req, res) => {
    ok(res, await NotificationCampaign.find({}).sort({ createdAt: -1 }).populate('offer', 'name').populate('product', 'title slug').lean());
});

export const createNotificationCampaign = asyncHandler(async (req, res) => {
    const c = await NotificationCampaign.create({ ...req.body, status: req.body.scheduledAt ? 'scheduled' : 'draft', createdBy: req.user._id });
    await audit(req, 'notification_campaign.create', { targetType: 'NotificationCampaign', targetId: c._id });
    created(res, c, 'Notification campaign saved.');
});

export const updateNotificationCampaign = asyncHandler(async (req, res) => {
    const c = await NotificationCampaign.findById(req.params.id);
    if (!c) throw ApiError.notFound('Campaign not found');
    if (['sending', 'sent'].includes(c.status)) throw ApiError.badRequest('Sent campaigns cannot be edited.');
    c.set(req.body);
    if (req.body.scheduledAt !== undefined) c.status = req.body.scheduledAt ? 'scheduled' : 'draft';
    await c.save();
    await audit(req, 'notification_campaign.update', { targetType: 'NotificationCampaign', targetId: c._id });
    ok(res, c, 'Notification campaign saved.');
});

export const sendNotificationCampaign = asyncHandler(async (req, res) => {
    const result = await sendCampaign(req.params.id);
    await audit(req, 'notification_campaign.send', { targetType: 'NotificationCampaign', targetId: req.params.id });
    if (!result) throw ApiError.badRequest('Campaign could not be sent. Check that it is active, not already sent, and that notifications are globally enabled.');
    ok(res, result, 'Notification campaign sent.');
});

export const testNotification = asyncHandler(async (req, res) => {
    try {
        const r = await sendTest(req.body);
        ok(res, r, r.delivered ? 'Test notification delivered.' : 'Test notification could not be delivered.');
    } catch (err) {
        throw ApiError.badRequest(err.message);
    }
});

export const listNotificationSubscriptions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = req.query.active ? { active: req.query.active === 'true' } : {};
    const [items, total] = await Promise.all([
        NotificationSubscription.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).select('-token').populate('user', 'email').lean(),
        NotificationSubscription.countDocuments(filter),
    ]);
    ok(res, paginated(items, total, { page, limit }));
});
