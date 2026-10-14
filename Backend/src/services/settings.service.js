import { Setting } from '../models/index.js';
import { config } from '../config/env.js';

/**
 * Default values for every admin-managed settings section. Saved values are deep-merged
 * over these so new keys added in code are always present.
 */
export const SETTINGS_DEFAULTS = {
    general: {
        siteName: 'OpenPage',
        tagline: 'Practical eBooks for modern work',
        logoUrl: '',
        faviconUrl: '',
        supportEmail: 'ranveratnesh@gmail.com',
        contactPhone: '+91 9770133148',
        businessName: 'Ratnesh Ranve',
        businessAddress: '47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India',
        supportHours: 'Monday to Saturday, 10:00 AM – 6:00 PM IST',
        responseTime: 'We usually reply within 24 hours.',
        governingLaw: 'India',
        social: { twitter: '', linkedin: '', instagram: '', facebook: '', youtube: '' },
        currency: 'INR',
        timezone: 'Asia/Kolkata',
    },
    homepage: {
        hero: {
            eyebrow: 'Instant digital delivery',
            title: 'Practical eBooks that help you work smarter',
            subtitle: 'Clear, actionable guides on AI automation, business operations, marketing and productivity. Pay securely and get your download link in minutes.',
            primaryCtaText: 'Browse eBooks',
            primaryCtaLink: '/ebooks',
            secondaryCtaText: 'How delivery works',
            secondaryCtaLink: '#how-it-works',
            image: '',
        },
        sections: { featured: true, bestsellers: true, recent: true, categories: true, banners: true, whyUs: true, howItWorks: true, testimonials: true, faq: true, newsletter: true },
        featuredProductIds: [],
        banners: [],
        whyUs: [
            { title: 'Written by practitioners', text: 'Every guide is built from real-world experience, not filler.' },
            { title: 'Instant, secure delivery', text: 'Your download link is emailed as soon as payment is confirmed.' },
            { title: 'Lifetime library access', text: 'Create a free account to re-download your purchases any time.' },
            { title: 'Secure payments', text: 'Checkout is processed by Razorpay. We never see your card details.' },
        ],
        howItWorks: [
            { title: 'Choose your eBook', text: 'Browse the catalogue and add titles to your cart.' },
            { title: 'Verify your email', text: 'We send a 6-digit code so your download goes to the right inbox.' },
            { title: 'Pay securely', text: 'Complete payment with UPI, cards, net banking or wallets via Razorpay.' },
            { title: 'Download instantly', text: 'Get a secure download link by email and in your library.' },
        ],
        faqs: [
            { question: 'How do I receive my eBook?', answer: 'After your payment is confirmed, we email a secure download link to the address you verified at checkout. If you have an account, the eBook also appears in your library.' },
            { question: 'Which formats are available?', answer: 'Each product page lists the file format (usually PDF). PDFs open on any phone, tablet or computer.' },
            { question: 'Do I need an account to buy?', answer: 'No. You only need to verify your email address. You can create an account later to access all your purchases in one place.' },
            { question: 'What if my download link expires?', answer: 'Download links are time-limited for security. You can request a fresh link from the download page or your library at any time.' },
            { question: 'Can I get a refund?', answer: 'Refund requests are reviewed individually under our Refund Policy, for example for inaccessible files or duplicate charges.' },
        ],
        newsletter: { title: 'Get new releases and genuine offers', text: 'Occasional emails about new eBooks and real discounts. Unsubscribe any time.' },
    },
    footer: {
        about: 'OpenPage publishes practical eBooks on AI automation, business operations, marketing and productivity.',
        columns: [
            { title: 'Shop', links: [{ label: 'All eBooks', href: '/ebooks' }, { label: 'Categories', href: '/categories' }] },
            { title: 'Help', links: [{ label: 'Support', href: '/support' }, { label: 'FAQ', href: '/faq' }, { label: 'Contact', href: '/contact' }] },
            { title: 'Legal', links: [{ label: 'Terms', href: '/terms' }, { label: 'Privacy', href: '/privacy' }, { label: 'Refund Policy', href: '/refund-policy' }, { label: 'Licensing', href: '/licensing' }, { label: 'Cookie preferences', href: '/cookie-preferences' }] },
        ],
        copyright: '',
    },
    seo: {
        defaultTitle: 'OpenPage | Practical eBooks for modern work',
        titleTemplate: '%s | OpenPage',
        defaultDescription: 'Buy practical eBooks on AI automation, business operations, marketing and productivity. Secure checkout and instant digital delivery.',
        defaultOgImage: '',
        twitterHandle: '',
        homepage: { title: '', description: '' },
        organization: { name: 'OpenPage', logo: '', sameAs: [] },
        robotsDisallow: ['/account', '/checkout', '/cart', '/download', '/admin', '/api', '/order', '/unsubscribe', '/reset-password', '/verify-email'],
        extraRobots: '',
        noindexPaths: [],
        canonicalHost: '',
        structuredData: { organization: true, website: true, products: true, breadcrumbs: true, reviews: true },
    },
    checkout: {
        verificationValidMinutes: 60,
        sessionTtlHours: 72,
        termsVersion: '2026-10',
        tax: { enabled: false, label: 'GST', ratePercent: 18, inclusive: true },
        pendingOrderReuseMinutes: 30,
    },
    downloads: {
        maxUsesPerLink: 5,
        maxDownloadsPerEntitlementPerDay: 20,
        libraryLinkTtlMinutes: 15,
    },
    notifications: {
        enabled: false,
        promptTitle: 'Get notified about new eBooks',
        promptText: 'We will only send notifications about new releases and genuine limited-time offers. You can turn them off at any time.',
        minHoursBetweenNotifications: 24,
    },
    tracking: {
        meta: { enabled: config.metaPixel.enabled, pixelId: config.metaPixel.pixelId, events: { PageView: true, ViewContent: true, Search: true, AddToCart: true, InitiateCheckout: true, Purchase: true } },
        googleAds: {
            enabled: config.googleAds.enabled,
            tagId: config.googleAds.tagId,
            conversionId: config.googleAds.conversionId,
            purchaseLabel: config.googleAds.conversionLabel,
            trackCheckout: false,
            checkoutLabel: '',
        },
        adsense: {
            enabled: config.adsense.enabled,
            clientId: config.adsense.clientId,
            placements: [
                { key: 'home_mid', label: 'Homepage, between sections', slot: '', enabled: false },
                { key: 'catalog_bottom', label: 'Catalogue, below results', slot: '', enabled: false },
                { key: 'product_bottom', label: 'Product page, below details', slot: '', enabled: false },
                { key: 'content_bottom', label: 'Content pages, below text', slot: '', enabled: false },
            ],
        },
        consent: {
            bannerEnabled: true,
            requireConsent: true,
            policyVersion: '2026-10',
            bannerText: 'We use essential cookies to run the store. With your permission we also use analytics and advertising cookies to measure and improve our marketing.',
        },
    },
    features: {
        reviews: true,
        newsletter: true,
        accounts: true,
        notifications: true,
        bestsellerMinSales: 5,
        bestsellerTopN: 6,
    },
    contact: {
        email: 'ranveratnesh@gmail.com',
        phone: '+91 9770133148',
        address: '47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India',
        intro: 'Questions about an order, a download or a product? Send us a message and we will get back to you within 24 hours.',
    },
};

const SECTIONS = Object.keys(SETTINGS_DEFAULTS);
const cache = new Map();
const CACHE_MS = 30 * 1000;

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

export const deepMerge = (base, override) => {
    if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
    }
    return out;
};

export const isValidSection = (section) => SECTIONS.includes(section);

export const getSettings = async (section) => {
    if (!isValidSection(section)) throw new Error(`Unknown settings section: ${section}`);
    const hit = cache.get(section);
    if (hit && hit.expires > Date.now()) return hit.value;
    const doc = await Setting.findOne({ key: section }).lean();
    const value = deepMerge(SETTINGS_DEFAULTS[section], doc?.value || {});
    cache.set(section, { value, expires: Date.now() + CACHE_MS });
    return value;
};

export const getAllSettings = async () => {
    const entries = await Promise.all(SECTIONS.map(async (s) => [s, await getSettings(s)]));
    return Object.fromEntries(entries);
};

export const updateSettings = async (section, value, userId) => {
    if (!isValidSection(section)) throw new Error(`Unknown settings section: ${section}`);
    // Only known top-level keys are stored, so arbitrary fields cannot be injected.
    const allowed = Object.fromEntries(Object.entries(value || {}).filter(([key]) => key in SETTINGS_DEFAULTS[section]));
    const current = await getSettings(section);
    const merged = deepMerge(current, allowed);
    await Setting.findOneAndUpdate({ key: section }, { $set: { value: merged, updatedBy: userId } }, { upsert: true });
    cache.delete(section);
    return merged;
};
