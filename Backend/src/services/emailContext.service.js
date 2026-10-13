import { config } from '../config/env.js';
import { Order, Entitlement, User, Subscriber, CheckoutSession, EmailCampaign, Product, ActionToken } from '../models/index.js';
import { formatMoney, hmac, randomToken, sha256, addMinutes } from '../utils/helpers.js';
import { issueDownloadToken } from './download.service.js';

const ttlText = (minutes) => (minutes % 1440 === 0 ? `${minutes / 1440} day(s)` : minutes % 60 === 0 ? `${minutes / 60} hour(s)` : `${minutes} minutes`);

const orderSummary = (order) => ({
    orderNumber: order.orderNumber,
    items: order.items.map((i) => ({ title: i.title, totalFormatted: formatMoney(i.total, order.currency), slug: i.slug })),
    totalFormatted: formatMoney(order.total, order.currency),
    discountFormatted: order.discountTotal ? formatMoney(order.discountTotal, order.currency) : '',
    taxFormatted: order.tax?.amount ? `${formatMoney(order.tax.amount, order.currency)}${order.tax.inclusive ? ' (included)' : ''}` : '',
    taxLabel: order.tax?.label || 'Tax',
    paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '',
    orderUrl: `${config.frontendUrl}/account/orders/${order.orderNumber}`,
});

const deliveryContext = async (msg, issuedFor) => {
    const order = await Order.findById(msg.data?.orderId || msg.order).lean();
    if (!order || order.status !== 'paid' && order.status !== 'partially_refunded') return { skip: 'order not in a deliverable state' };
    const filter = { order: order._id, status: 'active' };
    if (msg.data?.entitlementIds?.length) filter._id = { $in: msg.data.entitlementIds };
    const entitlements = await Entitlement.find(filter).lean();
    if (!entitlements.length) return { skip: 'no active entitlements' };
    const downloads = [];
    for (const ent of entitlements) {
        const { url } = await issueDownloadToken(ent, { issuedFor });
        const item = order.items.find((i) => String(i.product) === String(ent.product));
        downloads.push({ title: ent.productTitle, url, format: item?.format || 'PDF', version: ent.fileVersion || '1.0' });
    }
    const user = order.user ? await User.findById(order.user).lean() : await User.findOne({ email: order.email, emailVerified: true }).lean();
    return {
        ...orderSummary(order),
        customerName: user?.name || '',
        downloads,
        hasAccount: Boolean(user),
        libraryUrl: `${config.frontendUrl}/account/library`,
        downloadHelpUrl: `${config.frontendUrl}/download`,
        linkTtlText: ttlText(config.downloadLinkTtlMinutes),
    };
};

const actionLink = async (userId, purpose, ttlMinutes, path) => {
    const token = randomToken(32);
    await ActionToken.create({ user: userId, purpose, tokenHash: sha256(token), expiresAt: addMinutes(new Date(), ttlMinutes) });
    return `${config.frontendUrl}${path}?token=${token}`;
};

export const checkoutResumeUrl = (sessionId) => `${config.frontendUrl}/checkout/resume?sid=${sessionId}&sig=${hmac(config.sessionSecret, `resume:${sessionId}`).slice(0, 32)}`;

const builders = {
    order_delivery: (msg) => deliveryContext(msg, 'email'),
    ebook_delivery: (msg) => deliveryContext(msg, 'admin_resend'),
    download_link_regenerated: (msg) => deliveryContext(msg, 'regenerate'),

    account_verification: async (msg) => {
        const user = await User.findById(msg.data?.userId).lean();
        if (!user || user.emailVerified) return { skip: 'already verified' };
        return { customerName: user.name, verifyUrl: await actionLink(user._id, 'verify_email', 24 * 60, '/verify-email') };
    },
    password_reset: async (msg) => {
        const user = await User.findById(msg.data?.userId).lean();
        if (!user || user.status !== 'active') return { skip: 'user unavailable' };
        return { customerName: user.name, resetUrl: await actionLink(user._id, 'reset_password', 60, '/reset-password') };
    },
    newsletter_confirmation: async (msg) => {
        const sub = await Subscriber.findById(msg.data?.subscriberId);
        if (!sub || sub.status === 'subscribed') return { skip: 'already confirmed' };
        const token = randomToken(24);
        sub.confirmTokenHash = sha256(token);
        await sub.save();
        return { confirmUrl: `${config.frontendUrl}/newsletter/confirm?token=${token}` };
    },
    abandoned_checkout: async (msg) => {
        const session = await CheckoutSession.findById(msg.checkoutSession || msg.data?.sessionId).populate('items.product', 'title slug status').lean();
        if (!session || session.status === 'converted') return { skip: 'checkout converted' };
        const paid = await Order.exists({ email: msg.to, status: 'paid', paidAt: { $gte: session.createdAt } });
        if (paid) return { skip: 'customer purchased' };
        const items = session.items.filter((i) => i.product?.status === 'published').map((i) => ({ title: i.product.title }));
        if (!items.length) return { skip: 'products no longer available' };
        return { items, checkoutUrl: checkoutResumeUrl(session._id), totalFormatted: session.cartSnapshot?.total ? formatMoney(session.cartSnapshot.total) : '' };
    },
    post_purchase: async (msg) => {
        const order = await Order.findById(msg.order || msg.data?.orderId).lean();
        if (!order || order.status !== 'paid') return { skip: 'order not paid or refunded' };
        const purchased = order.items.map((i) => i.product);
        const sourceProducts = await Product.find({ _id: { $in: purchased } }).select('category tags').lean();
        const recs = await Product.find({
            _id: { $nin: purchased },
            status: 'published',
            $or: [{ category: { $in: sourceProducts.map((p) => p.category).filter(Boolean) } }, { tags: { $in: sourceProducts.flatMap((p) => p.tags || []) } }],
        })
            .sort({ salesCount: -1 })
            .limit(3)
            .select('title slug shortDescription')
            .lean();
        if (msg.templateKey === 'post_purchase_recommendations' && !recs.length) return { skip: 'no relevant recommendations' };
        return {
            ...orderSummary(order),
            libraryUrl: `${config.frontendUrl}/account/library`,
            reviewUrl: `${config.frontendUrl}/account/library?review=1`,
            recommendations: recs.map((p) => ({ title: p.title, shortDescription: p.shortDescription, url: `${config.frontendUrl}/ebooks/${p.slug}` })),
        };
    },
    payment_failed: async (msg) => {
        const order = await Order.findById(msg.order).select('status').lean();
        return order && order.status === 'failed' ? {} : { skip: 'order no longer failed' };
    },
    payment_pending: async (msg) => {
        const order = await Order.findById(msg.order).select('status').lean();
        return order && order.status === 'pending' ? {} : { skip: 'order no longer pending' };
    },
    campaign: async (msg) => {
        const campaign = await EmailCampaign.findById(msg.campaign).lean();
        if (!campaign || ['paused', 'cancelled'].includes(campaign.status)) return { skip: 'campaign paused or cancelled' };
        return { __template: { html: campaign.html, subject: campaign.subject, preheader: campaign.preheader || '' } };
    },
};

export const buildEmailContext = async (msg) => {
    const builder = builders[msg.type];
    return builder ? builder(msg) : null;
};
