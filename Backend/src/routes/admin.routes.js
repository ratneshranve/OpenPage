import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ebookUpload, imageUpload } from '../middleware/upload.js';
import * as products from '../controllers/admin/products.controller.js';
import * as orders from '../controllers/admin/orders.controller.js';
import * as people from '../controllers/admin/people.controller.js';
import * as marketing from '../controllers/admin/marketing.controller.js';
import * as site from '../controllers/admin/site.controller.js';

const router = Router();
// Every admin route is protected server-side, independent of what the UI shows.
router.use(requireAdmin);
router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const money = z.number().int('Amounts are in paise').min(0);
const optStr = (max) => z.string().trim().max(max).optional().or(z.literal(''));
const url = z.string().trim().max(1000).refine((v) => !v || /^(https?:\/\/|\/)/.test(v), 'Must be a URL or a path starting with /').optional().or(z.literal(''));
const dateish = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/), z.null()]).optional().transform((v) => (v ? new Date(v) : v));
const seo = z.object({ title: optStr(70), description: optStr(170), primaryKeyword: optStr(100), keywords: z.array(z.string().max(60)).max(30).optional(), canonicalUrl: url, ogTitle: optStr(120), ogDescription: optStr(300), ogImage: url, noindex: z.boolean().optional() }).partial();
const image = z.object({ url: z.string().max(1000), alt: z.string().max(200).optional().default('') });

// ---- Dashboard & analytics ----
router.get('/dashboard', site.dashboard);
router.get('/analytics', site.analytics);
router.get('/analytics/export', site.exportSalesReport);

// ---- Products ----
const productBody = z.object({
    title: z.string().trim().min(2).max(200),
    slug: optStr(120),
    subtitle: optStr(200),
    shortDescription: optStr(400),
    description: z.string().max(50000).optional(),
    author: optStr(120),
    publisher: optStr(120),
    category: id.optional().nullable(),
    tags: z.array(z.string().trim().toLowerCase().max(40)).max(30).optional(),
    keyBenefits: z.array(z.string().max(300)).max(20).optional(),
    audience: z.array(z.string().max(300)).max(20).optional(),
    tableOfContents: z.array(z.string().max(300)).max(200).optional(),
    faqs: z.array(z.object({ question: z.string().max(300), answer: z.string().max(3000) })).max(30).optional(),
    coverImage: image.optional().nullable(),
    previewImages: z.array(image).max(20).optional(),
    productType: z.enum(['ebook', 'template', 'checklist', 'guide', 'other']).optional(),
    price: money.min(100, 'Price must be at least ₹1'),
    compareAtPrice: money.optional().nullable(),
    currency: z.string().length(3).toUpperCase().optional(),
    featured: z.boolean().optional(),
    language: optStr(40),
    format: optStr(20),
    pageCount: z.number().int().min(0).max(100000).optional().nullable(),
    license: z.string().max(5000).optional(),
    publishedAt: dateish,
    seo: seo.optional(),
});
router.get('/products', products.listProducts);
router.post('/products', validate(productBody), products.createProduct);
router.get('/products/:id', products.getProduct);
router.patch('/products/:id', validate(productBody.partial()), products.updateProduct);
router.post('/products/:id/status', validate(z.object({ status: z.enum(['draft', 'published', 'unpublished', 'archived']) })), products.setProductStatus);
router.post('/products/:id/file', ebookUpload.single('file'), products.uploadEbook);
router.post('/products/:id/sample', ebookUpload.single('file'), products.uploadSample);
router.get('/products/:id/sales', products.productSales);
router.post('/media/images', imageUpload.array('images', 10), products.uploadImages);

// ---- Categories ----
const categoryBody = z.object({ name: z.string().trim().min(1).max(80), slug: optStr(120), description: z.string().max(5000).optional(), image: url, icon: optStr(60), order: z.number().int().optional(), visible: z.boolean().optional(), seo: seo.optional() });
router.get('/categories', products.listCategories);
router.post('/categories', validate(categoryBody), products.createCategory);
router.patch('/categories/:id', validate(categoryBody.partial()), products.updateCategory);
router.delete('/categories/:id', products.deleteCategory);
router.post('/categories/reorder', validate(z.object({ ids: z.array(id).max(500) })), products.reorderCategories);
router.post('/categories/:id/assign', validate(z.object({ productIds: z.array(id).max(500) })), products.assignProducts);

// ---- Reviews ----
router.get('/reviews', products.listReviews);
router.patch('/reviews/:id', validate(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), featured: z.boolean().optional() })), products.moderateReview);

// ---- Orders & payments ----
router.get('/orders', orders.listOrders);
router.get('/orders/export', orders.exportOrders);
router.get('/orders/:id', orders.getOrder);
router.post('/orders/:id/notes', validate(z.object({ text: z.string().trim().min(1).max(2000) })), orders.addNote);
router.post('/orders/:id/resend-delivery', orders.resendDelivery);
router.post('/orders/:id/reconcile', orders.reconcile);
router.post('/orders/:id/approve-manual', validate(z.object({ note: optStr(1000) }).partial().optional()), orders.approveManualPayment);
router.post('/orders/:id/reject-manual', validate(z.object({ reason: optStr(1000) }).partial().optional()), orders.rejectManualPayment);
router.post('/orders/:id/refunds', validate(z.object({ reason: z.string().trim().min(3).max(2000), category: z.enum(['inaccessible_file', 'defective_file', 'duplicate_charge', 'not_as_described', 'other']).default('other') })), orders.createRefundForOrder);
router.patch('/entitlements/:entitlementId', validate(z.object({ status: z.enum(['active', 'revoked']), reason: optStr(300) })), orders.setEntitlementStatus);
router.get('/payments', orders.listPayments);
router.get('/payments/webhooks', orders.listWebhookEvents);

// ---- Manual refunds ----
router.get('/refunds', orders.listRefunds);
router.get('/refunds/:id', orders.getRefund);
router.post(
    '/refunds/:id/decision',
    validate(z.object({ decision: z.enum(['under_review', 'approved', 'rejected']), decisionReason: optStr(2000), eligibilityNotes: optStr(4000), amount: money.min(1).optional(), revokeAccess: z.boolean().optional(), notifyCustomer: z.boolean().optional().default(true) })),
    orders.decide
);
router.post('/refunds/:id/initiate', validate(z.object({ confirm: z.literal(true, { errorMap: () => ({ message: 'Confirm the refund to continue' }) }) })), orders.initiate);
router.post('/refunds/:id/sync', orders.syncRefund);

// ---- Customers ----
router.get('/customers', people.listCustomers);
router.get('/customers/guests', people.listGuestBuyers);
router.get('/customers/:id', people.getCustomer);
router.post('/customers/:id/status', validate(z.object({ status: z.enum(['active', 'suspended']), reason: optStr(300) })), people.setCustomerStatus);
router.post('/customers/:id/recovery', validate(z.object({ action: z.enum(['send_password_reset', 'revoke_sessions', 'resend_verification']) })), people.customerRecovery);

// ---- Offers & coupons ----
const offerBody = z.object({
    name: z.string().trim().min(2).max(120),
    description: optStr(1000),
    discountType: z.enum(['percentage', 'fixed', 'bundle']),
    value: z.number().min(0),
    appliesTo: z.enum(['all', 'products', 'categories']).default('all'),
    products: z.array(id).max(200).optional(),
    categories: z.array(id).max(100).optional(),
    couponCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'Use 3 to 40 letters, numbers, - or _').optional().or(z.literal('')).nullable(),
    startsAt: dateish,
    endsAt: dateish,
    timezone: optStr(60),
    minOrderAmount: money.optional(),
    maxDiscountAmount: money.optional().nullable(),
    redemptionLimit: z.number().int().min(1).optional().nullable(),
    perCustomerLimit: z.number().int().min(1).optional().nullable(),
    firstPurchaseOnly: z.boolean().optional(),
    audienceEmails: z.array(z.string().trim().toLowerCase().email()).max(5000).optional(),
    stackable: z.boolean().optional(),
    active: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
    bannerText: optStr(200),
    promoteViaEmail: z.boolean().optional(),
    promoteViaNotification: z.boolean().optional(),
});
for (const base of ['/offers', '/coupons']) {
    router.get(base, (req, _res, next) => {
        if (base === '/coupons') req.query.type = 'coupon';
        next();
    }, marketing.listOffers);
    router.post(base, validate(offerBody), marketing.createOffer);
    router.patch(`${base}/:id`, validate(offerBody.partial()), marketing.updateOffer);
    router.post(`${base}/:id/state`, validate(z.object({ action: z.enum(['activate', 'deactivate', 'pause', 'resume']) })), marketing.setOfferState);
    router.delete(`${base}/:id`, marketing.deleteOffer);
    router.get(`${base}/:id/redemptions`, marketing.offerRedemptions);
}

// ---- Email templates, logs, SMTP ----
router.get('/email-templates', marketing.listTemplates);
router.get('/email-templates/:key', marketing.getTemplate);
router.patch('/email-templates/:key', validate(z.object({ name: optStr(120), subject: z.string().min(1).max(300).optional(), preheader: optStr(300), html: z.string().min(1).max(100000).optional(), description: optStr(500) })), marketing.updateTemplate);
router.post('/email-templates/:key/reset', marketing.resetTemplate);
router.post('/email-templates/:key/preview', validate(z.object({ subject: z.string().max(300).optional(), html: z.string().max(100000).optional(), preheader: z.string().max(300).optional() })), marketing.previewTemplate);
router.post('/email/test', validate(z.object({ to: z.string().email().optional(), templateKey: z.string().max(60).optional() })), marketing.sendTestEmail);
router.get('/email/smtp-status', marketing.smtpStatus);
router.get('/email-logs', marketing.listEmailLogs);
router.get('/email-logs/:id/preview', marketing.previewEmailLog);
router.post('/email-logs/:id/retry', marketing.retryEmail);
router.post('/email-logs/:id/cancel', marketing.cancelEmail);

// ---- Automations ----
router.get('/automations', marketing.listAutomations);
router.patch(
    '/automations/:id',
    validate(
        z.object({
            name: optStr(120),
            description: optStr(500),
            enabled: z.boolean(),
            delayMinutes: z.number().int().min(5).max(60 * 24 * 60),
            templateKey: z.string().max(60),
            audience: z.enum(['all_eligible', 'registered_only', 'guests_only']),
            maxPerRecipient: z.number().int().min(1).max(10),
            frequencyCapHours: z.number().int().min(0).max(24 * 30),
            lookbackHours: z.number().int().min(1).max(24 * 60),
            conditions: z.object({ requireMarketingConsent: z.boolean(), minOrderValue: money, excludeRecentPurchasersDays: z.number().int().min(0), productIds: z.array(id) }).partial(),
        }).partial()
    ),
    marketing.updateAutomation
);
router.post('/automations/:id/run', marketing.runAutomationNow);
router.get('/automations/:id/runs', marketing.automationRuns);

// ---- Email campaigns ----
const campaignBody = z.object({ name: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(200), preheader: optStr(200), html: z.string().min(1).max(100000), audience: z.enum(['newsletter', 'consented_customers', 'all_marketing']), offer: id.optional().nullable() });
router.get('/campaigns', marketing.listCampaigns);
router.get('/campaigns/audience', marketing.campaignAudience);
router.post('/campaigns', validate(campaignBody), marketing.createCampaign);
router.get('/campaigns/:id', marketing.getCampaign);
router.patch('/campaigns/:id', validate(campaignBody.partial()), marketing.updateCampaign);
router.post('/campaigns/:id/action', validate(z.object({ action: z.enum(['schedule', 'pause', 'resume', 'cancel', 'unschedule']), scheduledAt: z.string().optional() })), marketing.campaignAction);
router.post('/campaigns/:id/test', validate(z.object({ to: z.string().email().optional() })), marketing.campaignTest);

// ---- Subscribers ----
router.get('/subscribers', people.listSubscribers);
router.get('/subscribers/export', people.exportSubscribers);
router.post('/subscribers/:id/unsubscribe', people.unsubscribeSubscriber);
router.get('/suppressions', people.listSuppressions);
router.post('/suppressions', validate(z.object({ email: z.string().email(), reason: z.enum(['unsubscribed', 'bounced', 'complaint', 'manual']).optional() })), people.addSuppression);
router.delete('/suppressions/:id', people.removeSuppression);

// ---- Notifications ----
const notificationBody = z.object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(240),
    url: z.string().trim().max(500).default('/'),
    imageUrl: url,
    type: z.enum(['launch', 'offer', 'price_drop', 'announcement', 'reminder']).optional(),
    audience: z.enum(['all', 'customers', 'guests']).optional(),
    offer: id.optional().nullable(),
    product: id.optional().nullable(),
    active: z.boolean().optional(),
    scheduledAt: dateish,
});
router.get('/notifications', marketing.notificationOverview);
router.get('/notifications/campaigns', marketing.listNotificationCampaigns);
router.post('/notifications/campaigns', validate(notificationBody), marketing.createNotificationCampaign);
router.patch('/notifications/campaigns/:id', validate(notificationBody.partial()), marketing.updateNotificationCampaign);
router.post('/notifications/campaigns/:id/send', marketing.sendNotificationCampaign);
router.post('/notifications/test', validate(z.object({ token: z.string().min(20).max(4096), title: z.string().max(80).default('Test notification'), body: z.string().max(240).default('Notifications are working.'), url: z.string().max(500).default('/') })), marketing.testNotification);
router.get('/notifications/subscriptions', marketing.listNotificationSubscriptions);

// ---- Settings, content, legal, SEO ----
router.get('/settings', site.getAll);
router.get('/settings/:section', site.getSection);
router.put('/settings/:section', validate(z.record(z.any())), site.updateSection);
// Aliases matching the admin areas in the specification.
router.get('/content', site.getAll);
router.put('/content/:section', validate(z.record(z.any())), site.updateSection);

const pageBody = z.object({ title: z.string().trim().min(1).max(200), slug: optStr(120), type: z.enum(['legal', 'content']).optional(), body: z.string().max(200000).optional(), published: z.boolean().optional(), seo: z.object({ title: optStr(70), description: optStr(170), noindex: z.boolean().optional() }).partial().optional() });
for (const base of ['/pages', '/legal-pages']) {
    router.get(base, (req, _res, next) => {
        if (base === '/legal-pages') req.query.type = 'legal';
        next();
    }, site.listPages);
    router.post(base, validate(pageBody), site.createPage);
    router.get(`${base}/:id`, site.getPage);
    router.patch(`${base}/:id`, validate(pageBody.partial()), site.updatePage);
    router.delete(`${base}/:id`, site.deletePage);
}

router.get('/seo', site.seoStatus);
router.post('/seo/sitemap', site.regenerateSitemap);
router.get('/seo/redirects', site.listRedirects);
router.post('/seo/redirects', validate(z.object({ from: z.string().max(500), to: z.string().max(1000), statusCode: z.union([z.literal(301), z.literal(302)]).optional(), active: z.boolean().optional() })), site.createRedirect);
router.patch('/seo/redirects/:id', validate(z.object({ from: z.string().max(500), to: z.string().max(1000), statusCode: z.union([z.literal(301), z.literal(302)]), active: z.boolean() }).partial()), site.updateRedirect);
router.delete('/seo/redirects/:id', site.deleteRedirect);

// ---- Support ----
router.get('/support', people.listTickets);
router.get('/support/:id', people.getTicket);
router.post('/support/:id/reply', validate(z.object({ message: z.string().trim().min(1).max(5000), status: z.enum(['open', 'pending', 'resolved', 'closed']).optional() })), people.replyTicket);
router.patch('/support/:id', validate(z.object({ status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(), priority: z.enum(['low', 'normal', 'high']).optional(), note: optStr(2000) })), people.updateTicket);

// ---- Integrations, audit, admin account ----
router.get('/integrations', site.integrations);
router.get('/audit-logs', people.listAuditLogs);
router.get('/account/sessions', people.adminSessions);
router.patch('/account', validate(z.object({ name: z.string().trim().min(1).max(120) })), people.updateAdminProfile);

export default router;
