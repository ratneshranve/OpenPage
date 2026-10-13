import { Page, Redirect, WebhookEvent, Job, EmailMessage } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { slugify } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { dashboard as buildDashboard, reports as buildReports, parseRange } from '../../services/analytics.service.js';
import { getAllSettings, getSettings, updateSettings, isValidSection } from '../../services/settings.service.js';
import { buildSitemap, sitemapStatus } from '../../services/seo.service.js';
import { config, integrationStatus } from '../../config/env.js';
import { verifySmtp } from '../../services/email.service.js';
import { storageStatus } from '../../services/storage.service.js';
import { firebaseStatus, subscriptionStats } from '../../services/notification.service.js';
import { razorpayMode } from '../../services/razorpay.service.js';
import { sendCsv } from './csv.js';

export const dashboard = asyncHandler(async (req, res) => ok(res, await buildDashboard(parseRange(req.query))));

export const analytics = asyncHandler(async (req, res) => ok(res, await buildReports(parseRange(req.query))));

export const exportSalesReport = asyncHandler(async (req, res) => {
    const r = await buildReports(parseRange(req.query));
    await audit(req, 'reports.export', { details: { from: r.range.from, to: r.range.to } });
    sendCsv(res, `sales-by-product-${new Date().toISOString().slice(0, 10)}.csv`, [['Product', 'Units', 'Revenue', 'Discounts'], ...r.salesByProduct.map((p) => [p.title, p.units, p.revenue / 100, p.discounts / 100])]);
});

// ---- Settings sections (non-secret) ----
export const getAll = asyncHandler(async (_req, res) => ok(res, await getAllSettings()));

export const getSection = asyncHandler(async (req, res) => {
    if (!isValidSection(req.params.section)) throw ApiError.notFound('Unknown settings section');
    ok(res, await getSettings(req.params.section));
});

export const updateSection = asyncHandler(async (req, res) => {
    const { section } = req.params;
    if (!isValidSection(section)) throw ApiError.notFound('Unknown settings section');
    const value = await updateSettings(section, req.body, req.user._id);
    await audit(req, `settings.update.${section}`, { targetType: 'Setting', targetId: section, details: { keys: Object.keys(req.body || {}) } });
    ok(res, value, 'Settings saved.');
});

// ---- Pages (legal and content) ----
export const listPages = asyncHandler(async (req, res) => {
    const filter = req.query.type ? { type: req.query.type } : {};
    ok(res, await Page.find(filter).sort({ type: 1, title: 1 }).select('slug title type published updatedAt version').lean());
});

export const getPage = asyncHandler(async (req, res) => {
    const page = await Page.findById(req.params.id).lean();
    if (!page) throw ApiError.notFound('Page not found');
    ok(res, page);
});

const RESERVED = new Set(['ebooks', 'category', 'categories', 'cart', 'checkout', 'account', 'admin', 'login', 'register', 'support', 'faq', 'contact', 'download', 'order', 'api', 'media', 'unsubscribe', 'newsletter', 'verify-email', 'reset-password', 'forgot-password', 'cookie-preferences', 'sitemap.xml', 'robots.txt']);

export const createPage = asyncHandler(async (req, res) => {
    const slug = slugify(req.body.slug || req.body.title);
    if (RESERVED.has(slug)) throw ApiError.badRequest(`"${slug}" is reserved by the store. Choose another URL.`);
    const page = await Page.create({ ...req.body, slug, updatedBy: req.user._id });
    await audit(req, 'page.create', { targetType: 'Page', targetId: page._id, details: { slug } });
    created(res, page, 'Page saved.');
});

export const updatePage = asyncHandler(async (req, res) => {
    const page = await Page.findById(req.params.id);
    if (!page) throw ApiError.notFound('Page not found');
    const data = { ...req.body };
    if (data.slug) {
        data.slug = slugify(data.slug);
        if (RESERVED.has(data.slug)) throw ApiError.badRequest(`"${data.slug}" is reserved by the store.`);
    }
    if (data.body !== undefined && data.body !== page.body) page.version += 1;
    page.set({ ...data, updatedBy: req.user._id });
    await page.save();
    await audit(req, 'page.update', { targetType: 'Page', targetId: page._id, details: { slug: page.slug, version: page.version } });
    ok(res, page, 'Page saved.');
});

export const deletePage = asyncHandler(async (req, res) => {
    const page = await Page.findById(req.params.id);
    if (!page) throw ApiError.notFound('Page not found');
    if (page.type === 'legal') throw ApiError.badRequest('Legal pages cannot be deleted. Unpublish or edit them instead.');
    await page.deleteOne();
    await audit(req, 'page.delete', { targetType: 'Page', targetId: page._id, details: { slug: page.slug } });
    ok(res, null, 'Page deleted.');
});

// ---- SEO ----
export const seoStatus = asyncHandler(async (_req, res) => {
    ok(res, { sitemap: sitemapStatus(), robotsUrl: `${config.appBaseUrl}/robots.txt`, settings: await getSettings('seo') });
});

export const regenerateSitemap = asyncHandler(async (req, res) => {
    await buildSitemap({ force: true });
    await audit(req, 'seo.sitemap_regenerate');
    ok(res, sitemapStatus(), 'Sitemap regenerated.');
});

export const listRedirects = asyncHandler(async (_req, res) => ok(res, await Redirect.find({}).sort({ createdAt: -1 }).lean()));

const normPath = (p) => {
    const v = String(p || '').trim();
    if (!v.startsWith('/') || v.startsWith('//')) throw ApiError.badRequest('Paths must start with a single "/"');
    return v.replace(/\/+$/, '') || '/';
};

export const createRedirect = asyncHandler(async (req, res) => {
    const from = normPath(req.body.from);
    const to = /^https?:\/\//.test(req.body.to) ? req.body.to : normPath(req.body.to);
    if (from === to) throw ApiError.badRequest('A redirect cannot point to itself.');
    const r = await Redirect.create({ from, to, statusCode: req.body.statusCode || 301, active: req.body.active !== false });
    await audit(req, 'seo.redirect_create', { details: { from, to } });
    created(res, r, 'Redirect saved.');
});

export const updateRedirect = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.from) data.from = normPath(data.from);
    if (data.to && !/^https?:\/\//.test(data.to)) data.to = normPath(data.to);
    const r = await Redirect.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!r) throw ApiError.notFound('Redirect not found');
    await audit(req, 'seo.redirect_update', { details: { id: r._id } });
    ok(res, r, 'Redirect saved.');
});

export const deleteRedirect = asyncHandler(async (req, res) => {
    await Redirect.deleteOne({ _id: req.params.id });
    await audit(req, 'seo.redirect_delete', { details: { id: req.params.id } });
    ok(res, null, 'Redirect deleted.');
});

// ---- Integrations (status only; secrets are never returned) ----
const mask = (v) => (v ? `${v.slice(0, 4)}••••${v.slice(-2)}` : null);

export const integrations = asyncHandler(async (_req, res) => {
    const status = integrationStatus();
    const tracking = await getSettings('tracking');
    const [smtp, storage, webhookStats, lastWebhook, jobs, emailQueue, push] = await Promise.all([
        verifySmtp(),
        storageStatus(),
        WebhookEvent.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
        WebhookEvent.findOne({}).sort({ createdAt: -1 }).select('event status createdAt error').lean(),
        Job.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        EmailMessage.aggregate([{ $match: { status: { $in: ['queued', 'sending', 'failed'] } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
        subscriptionStats(),
    ]);
    ok(res, {
        razorpay: {
            configured: status.razorpay,
            mode: status.razorpay ? razorpayMode() : null,
            keyId: config.razorpay.keyId || null, // public key id
            keySecret: config.razorpay.keySecret ? 'set' : 'missing',
            webhookSecret: status.razorpayWebhook ? 'set' : 'missing',
            webhookUrl: `${config.apiBaseUrl}/api/v1/webhooks/razorpay`,
            recommendedEvents: ['payment.captured', 'payment.failed', 'payment.authorized', 'order.paid', 'refund.processed', 'refund.failed'],
            last7Days: Object.fromEntries(webhookStats.map((w) => [w._id, w.n])),
            lastEvent: lastWebhook,
        },
        smtp: { ...smtp, password: config.smtp.pass ? 'set' : 'missing', queue: Object.fromEntries(emailQueue.map((e) => [e._id, e.n])) },
        storage,
        firebase: { ...firebaseStatus(), projectId: config.firebase.projectId || null, clientEmail: mask(config.firebase.clientEmail), privateKey: config.firebase.privateKey ? 'set' : 'missing', subscriptions: push },
        metaPixel: { ...tracking.meta, envPixelId: config.metaPixel.pixelId || null },
        googleAds: { ...tracking.googleAds, envTagId: config.googleAds.tagId || null },
        adsense: { ...tracking.adsense, envClientId: config.adsense.clientId || null },
        consent: tracking.consent,
        jobs: { queue: Object.fromEntries(jobs.map((j) => [j._id, j.n])), automationEnabled: config.jobs.automationEnabled, workersEnabled: config.jobs.workersEnabled, emailRetryLimit: config.jobs.emailRetryLimit },
        environment: { nodeEnv: config.nodeEnv, frontendUrl: config.frontendUrl, apiBaseUrl: config.apiBaseUrl },
    });
});
