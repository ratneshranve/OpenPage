import mongoose from 'mongoose';
import { Product, Category, Review, Page, Offer } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginated, parsePagination } from '../utils/helpers.js';
import { decorateProductsWithOffers, activeOfferFilter } from '../services/pricing.service.js';
import { getSettings } from '../services/settings.service.js';
import { firebaseWebConfig } from '../services/notification.service.js';
import { sendPrivateFile } from '../services/storage.service.js';
import { isRazorpayConfigured } from '../services/razorpay.service.js';
import { config } from '../config/env.js';

const PUBLIC_LIST_FIELDS = 'title slug subtitle shortDescription author publisher category tags coverImage price compareAtPrice currency featured language format pageCount productType publishedAt salesCount ratingAverage ratingCount';

let bestsellerCache = { ids: new Set(), at: 0 };
const bestsellerIds = async () => {
    if (Date.now() - bestsellerCache.at < 5 * 60 * 1000) return bestsellerCache.ids;
    const features = await getSettings('features');
    const top = await Product.find({ status: 'published', salesCount: { $gte: Math.max(1, features.bestsellerMinSales) } })
        .sort({ salesCount: -1 })
        .limit(features.bestsellerTopN)
        .select('_id')
        .lean();
    bestsellerCache = { ids: new Set(top.map((p) => String(p._id))), at: Date.now() };
    return bestsellerCache.ids;
};

/** Public shape of a product. Private file references are never included. */
export const toPublicProduct = async (products) => {
    const best = await bestsellerIds();
    const decorated = await decorateProductsWithOffers(products);
    return decorated.map(({ file, fileHistory, sampleFile, salesCount, seo, ...p }) => ({
        ...p,
        // A "was" price is only shown when it is genuinely higher than what the customer pays.
        displayOriginalPrice: p.compareAtPrice && p.compareAtPrice > p.finalPrice ? p.compareAtPrice : p.finalPrice < p.price ? p.price : null,
        isBestseller: best.has(String(p._id)),
        hasSample: Boolean(sampleFile?.key),
        fileSize: file?.size,
        fileFormat: file?.format || p.format,
        version: file?.version,
        seo: seo ? { title: seo.title, description: seo.description, ogImage: seo.ogImage, ogTitle: seo.ogTitle, ogDescription: seo.ogDescription, canonicalUrl: seo.canonicalUrl, noindex: seo.noindex } : undefined,
    }));
};

export const listProducts = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 48 });
    const filter = { status: 'published' };
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (req.query.category) {
        const cat = await Category.findOne({ slug: String(req.query.category), visible: true }).select('_id').lean();
        if (!cat) return ok(res, paginated([], 0, { page, limit }));
        filter.category = cat._id;
    }
    if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
    if (req.query.featured === 'true') filter.featured = true;
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        filter.price = {};
        if (Number.isFinite(minPrice)) filter.price.$gte = Math.round(minPrice * 100);
        if (Number.isFinite(maxPrice)) filter.price.$lte = Math.round(maxPrice * 100);
    }
    if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ title: rx }, { author: rx }, { tags: rx }, { shortDescription: rx }, { 'seo.keywords': rx }, { subtitle: rx }];
        const cats = await Category.find({ name: rx }).select('_id').lean();
        if (cats.length) filter.$or.push({ category: { $in: cats.map((c) => c._id) } });
    }
    const sorts = {
        newest: { publishedAt: -1, _id: -1 },
        popular: { salesCount: -1, publishedAt: -1 },
        price_asc: { price: 1 },
        price_desc: { price: -1 },
        rating: { ratingAverage: -1, ratingCount: -1 },
        relevance: { featured: -1, salesCount: -1, publishedAt: -1 },
    };
    const sort = sorts[req.query.sort] || (q ? sorts.relevance : sorts.newest);
    let [items, total] = await Promise.all([Product.find(filter).sort(sort).skip(skip).limit(limit).select(`${PUBLIC_LIST_FIELDS} file.format file.size file.version sampleFile.key`).populate('category', 'name slug').lean(), Product.countDocuments(filter)]);
    if (q && !req.query.sort) {
        // Lightweight relevance: title matches first.
        const lower = q.toLowerCase();
        items = items.sort((a, b) => Number(b.title.toLowerCase().includes(lower)) - Number(a.title.toLowerCase().includes(lower)));
    }
    ok(res, paginated(await toPublicProduct(items), total, { page, limit }));
});

export const getProduct = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' }).populate('category', 'name slug').lean();
    if (!product) throw ApiError.notFound('This eBook could not be found or is no longer available.');
    const [publicProduct] = await toPublicProduct([product]);
    const features = await getSettings('features');
    const [related, reviews] = await Promise.all([
        Product.find({ _id: { $ne: product._id }, status: 'published', $or: [{ category: product.category?._id }, { tags: { $in: product.tags || [] } }] })
            .sort({ salesCount: -1 })
            .limit(4)
            .select(`${PUBLIC_LIST_FIELDS} file.format file.version`)
            .lean(),
        features.reviews ? Review.find({ product: product._id, status: 'approved' }).sort({ createdAt: -1 }).limit(20).select('displayName rating title body createdAt').lean() : [],
    ]);
    ok(res, { product: publicProduct, related: await toPublicProduct(related), reviews, reviewsEnabled: features.reviews });
});

export const downloadSample = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' }).select('sampleFile slug').lean();
    if (!product?.sampleFile?.key) throw ApiError.notFound('No sample is available for this eBook.');
    await sendPrivateFile(res, product.sampleFile.key, `${product.slug}-sample.pdf`, 'application/pdf');
});

export const listCategories = asyncHandler(async (_req, res) => {
    const categories = await Category.find({ visible: true }).sort({ order: 1, name: 1 }).lean();
    const counts = await Product.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
    const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    ok(res, categories.map((c) => ({ ...c, productCount: byId[String(c._id)] || 0 })));
});

export const getCategory = asyncHandler(async (req, res) => {
    const category = await Category.findOne({ slug: String(req.params.slug).toLowerCase(), visible: true }).lean();
    if (!category) throw ApiError.notFound('Category not found.');
    ok(res, category);
});

const publicOfferView = (o) => ({
    id: o._id,
    name: o.name,
    description: o.description,
    bannerText: o.bannerText,
    discountType: o.discountType,
    value: o.value,
    couponCode: o.couponCode || null,
    endsAt: o.endsAt,
    minOrderAmount: o.minOrderAmount,
    appliesTo: o.appliesTo,
    products: o.products,
});

export const activeOffers = asyncHandler(async (_req, res) => {
    // Only offers the admin chose to display publicly; audience-restricted offers stay private.
    const offers = await Offer.find({ ...activeOfferFilter(), showOnHomepage: true, audienceEmails: { $size: 0 } }).sort({ createdAt: -1 }).lean();
    ok(res, offers.map(publicOfferView));
});

const activeBanners = (banners = []) => {
    const now = Date.now();
    return banners.filter((b) => b.active !== false && (!b.startsAt || new Date(b.startsAt).getTime() <= now) && (!b.endsAt || new Date(b.endsAt).getTime() > now));
};

export const homepage = asyncHandler(async (_req, res) => {
    const [home, features] = await Promise.all([getSettings('homepage'), getSettings('features')]);
    const featuredIds = (home.featuredProductIds || []).filter((id) => mongoose.isValidObjectId(id));
    const fields = `${PUBLIC_LIST_FIELDS} file.format file.version`;
    const [featuredManual, featuredFlag, best, recent, categories, offers, testimonials] = await Promise.all([
        featuredIds.length ? Product.find({ _id: { $in: featuredIds }, status: 'published' }).select(fields).lean() : [],
        Product.find({ status: 'published', featured: true }).sort({ publishedAt: -1 }).limit(8).select(fields).lean(),
        bestsellerIds().then((ids) => Product.find({ _id: { $in: [...ids] } }).sort({ salesCount: -1 }).select(fields).lean()),
        Product.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(8).select(fields).lean(),
        Category.find({ visible: true }).sort({ order: 1 }).limit(12).lean(),
        Offer.find({ ...activeOfferFilter(), showOnHomepage: true, audienceEmails: { $size: 0 } }).lean(),
        features.reviews ? Review.find({ status: 'approved', featured: true }).sort({ createdAt: -1 }).limit(6).populate('product', 'title slug').select('displayName rating title body product createdAt').lean() : [],
    ]);
    const featured = featuredManual.length ? featuredIds.map((id) => featuredManual.find((p) => String(p._id) === id)).filter(Boolean) : featuredFlag;
    ok(res, {
        featured: await toPublicProduct(featured),
        bestsellers: await toPublicProduct(best),
        recent: await toPublicProduct(recent),
        categories,
        banners: activeBanners(home.banners),
        offers: offers.map(publicOfferView),
        testimonials,
    });
});

export const getPage = asyncHandler(async (req, res) => {
    const page = await Page.findOne({ slug: String(req.params.slug).toLowerCase(), published: true }).select('slug title body type seo updatedAt version').lean();
    if (!page) throw ApiError.notFound('Page not found.');
    ok(res, page);
});

/** Everything the storefront needs to render chrome, tracking and consent. No secrets. */
export const publicConfig = asyncHandler(async (_req, res) => {
    const [general, homepage, footer, seo, tracking, notifications, features, contact, checkout, payments] = await Promise.all(
        ['general', 'homepage', 'footer', 'seo', 'tracking', 'notifications', 'features', 'contact', 'checkout', 'payments'].map((s) => getSettings(s))
    );
    ok(res, {
        general,
        homepage: { hero: homepage.hero, sections: homepage.sections, whyUs: homepage.whyUs, howItWorks: homepage.howItWorks, faqs: homepage.faqs, newsletter: homepage.newsletter },
        footer,
        seo: { defaultTitle: seo.defaultTitle, titleTemplate: seo.titleTemplate, defaultDescription: seo.defaultDescription, defaultOgImage: seo.defaultOgImage, twitterHandle: seo.twitterHandle, homepage: seo.homepage, organization: seo.organization, structuredData: seo.structuredData, noindexPaths: seo.noindexPaths, robotsDisallow: seo.robotsDisallow },
        tracking: {
            meta: { enabled: tracking.meta.enabled && Boolean(tracking.meta.pixelId), pixelId: tracking.meta.pixelId, events: tracking.meta.events },
            googleAds: { enabled: tracking.googleAds.enabled && Boolean(tracking.googleAds.tagId), tagId: tracking.googleAds.tagId, conversionId: tracking.googleAds.conversionId, purchaseLabel: tracking.googleAds.purchaseLabel, trackCheckout: tracking.googleAds.trackCheckout, checkoutLabel: tracking.googleAds.checkoutLabel },
            adsense: { enabled: tracking.adsense.enabled && Boolean(tracking.adsense.clientId), clientId: tracking.adsense.clientId, placements: tracking.adsense.placements.filter((p) => p.enabled && p.slot) },
            consent: tracking.consent,
        },
        notifications: { enabled: notifications.enabled && features.notifications, promptTitle: notifications.promptTitle, promptText: notifications.promptText, firebase: notifications.enabled ? firebaseWebConfig() : null },
        features,
        contact,
        checkout: { termsVersion: checkout.termsVersion, tax: checkout.tax },
        payments: {
            activeGateway: payments.activeGateway || 'manual_upi',
            manualUpi: {
                enabled: payments.manualUpi?.enabled ?? true,
                upiId: payments.manualUpi?.upiId || 'ranveratnesh@okhdfcbank',
                accountHolderName: payments.manualUpi?.accountHolderName || general.siteName || 'OpenPage',
                qrCodeUrl: payments.manualUpi?.qrCodeUrl || '',
                instructions: payments.manualUpi?.instructions || '',
            },
            razorpay: {
                enabled: Boolean(payments.razorpay?.enabled && isRazorpayConfigured()),
                keyId: config.razorpay.keyId || '',
            },
        },
        otp: { resendCooldownSeconds: config.otp.resendCooldownSeconds, ttlSeconds: config.otp.ttlSeconds },
    });
});

export const featuredReviews = asyncHandler(async (_req, res) => {
    const reviews = await Review.find({ status: 'approved', featured: true }).sort({ createdAt: -1 }).limit(6).populate('product', 'title slug').lean();
    ok(res, reviews);
});
