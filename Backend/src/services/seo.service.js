import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';
import { Product, Category, Page, Redirect, Review } from '../models/index.js';
import { getSettings } from './settings.service.js';
import { escapeHtml } from '../emails/renderer.js';

const siteUrl = () => config.appBaseUrl || config.frontendUrl;
const abs = (p) => (p?.startsWith('http') ? p : `${siteUrl()}${p || '/'}`);
const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let sitemapCache = { xml: null, at: 0, count: 0 };

export const buildSitemap = async ({ force = false } = {}) => {
    if (!force && sitemapCache.xml && Date.now() - sitemapCache.at < 10 * 60 * 1000) return sitemapCache.xml;
    const seo = await getSettings('seo');
    const noindex = new Set(seo.noindexPaths || []);
    const [products, categories, pages] = await Promise.all([
        Product.find({ status: 'published', 'seo.noindex': { $ne: true } }).select('slug updatedAt').lean(),
        Category.find({ visible: true, 'seo.noindex': { $ne: true } }).select('slug updatedAt').lean(),
        Page.find({ published: true, 'seo.noindex': { $ne: true } }).select('slug updatedAt').lean(),
    ]);
    const urls = [
        { loc: '/', priority: '1.0' },
        { loc: '/ebooks', priority: '0.9' },
        { loc: '/categories', priority: '0.6' },
        { loc: '/support', priority: '0.4' },
        { loc: '/faq', priority: '0.4' },
        { loc: '/contact', priority: '0.3' },
        ...products.map((p) => ({ loc: `/ebooks/${p.slug}`, lastmod: p.updatedAt, priority: '0.8' })),
        ...categories.map((c) => ({ loc: `/category/${c.slug}`, lastmod: c.updatedAt, priority: '0.7' })),
        ...pages.map((p) => ({ loc: `/${p.slug}`, lastmod: p.updatedAt, priority: '0.3' })),
    ].filter((u) => !noindex.has(u.loc));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${xmlEscape(abs(u.loc))}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
        .join('\n')}\n</urlset>\n`;
    sitemapCache = { xml, at: Date.now(), count: urls.length };
    return xml;
};

export const sitemapStatus = () => ({ generatedAt: sitemapCache.at ? new Date(sitemapCache.at) : null, urlCount: sitemapCache.count, url: `${siteUrl()}/sitemap.xml` });

export const buildRobots = async () => {
    const seo = await getSettings('seo');
    const lines = ['User-agent: *', ...seo.robotsDisallow.map((p) => `Disallow: ${p}`), 'Allow: /', '', `Sitemap: ${siteUrl()}/sitemap.xml`];
    if (seo.extraRobots) lines.push('', seo.extraRobots);
    return `${lines.join('\n')}\n`;
};

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/** Organization / WebSite JSON-LD shared by every page. */
const baseJsonLd = (seo, general) => {
    const out = [];
    if (seo.structuredData.organization) {
        out.push({ '@context': 'https://schema.org', '@type': 'Organization', name: seo.organization.name || general.siteName, url: siteUrl(), logo: seo.organization.logo || general.logoUrl || undefined, sameAs: (seo.organization.sameAs || []).filter(Boolean) });
    }
    if (seo.structuredData.website) {
        out.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: general.siteName, url: siteUrl(), potentialAction: { '@type': 'SearchAction', target: `${siteUrl()}/ebooks?q={search_term_string}`, 'query-input': 'required name=search_term_string' } });
    }
    return out;
};

/**
 * Resolves title/description/canonical/JSON-LD for a public URL so crawlers receive
 * correct metadata in the initial HTML. Returns { status, redirect, meta }.
 */
export const resolveRouteMeta = async (urlPath) => {
    const [seo, general] = await Promise.all([getSettings('seo'), getSettings('general')]);
    const clean = urlPath.split('?')[0].replace(/\/+$/, '') || '/';

    const redirect = await Redirect.findOneAndUpdate({ from: clean, active: true }, { $inc: { hits: 1 } }).lean();
    if (redirect) return { redirect: { to: redirect.to, statusCode: redirect.statusCode } };

    const title = (t) => (t ? seo.titleTemplate.replace('%s', t) : seo.defaultTitle);
    const meta = {
        title: seo.defaultTitle,
        description: seo.defaultDescription,
        canonical: abs(clean),
        image: seo.defaultOgImage,
        type: 'website',
        noindex: seo.robotsDisallow.some((p) => clean === p || clean.startsWith(`${p}/`)) || (seo.noindexPaths || []).includes(clean),
        jsonLd: baseJsonLd(seo, general),
    };
    const crumbs = (items) =>
        seo.structuredData.breadcrumbs && meta.jsonLd.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })) });

    let m;
    if (clean === '/') {
        meta.title = seo.homepage.title || seo.defaultTitle;
        meta.description = seo.homepage.description || seo.defaultDescription;
    } else if (clean === '/ebooks') {
        meta.title = title('All eBooks');
        crumbs([{ name: 'Home', path: '/' }, { name: 'eBooks', path: '/ebooks' }]);
    } else if ((m = clean.match(/^\/ebooks\/([a-z0-9-]+)$/))) {
        const p = await Product.findOne({ slug: m[1], status: { $in: ['published', 'unpublished'] } }).populate('category', 'name slug').lean();
        if (!p) return { status: 404, meta: { ...meta, title: title('Page not found'), noindex: true } };
        meta.title = title(p.seo?.title || p.title);
        meta.description = truncate(p.seo?.description || p.shortDescription, 160);
        meta.canonical = p.seo?.canonicalUrl || abs(`/ebooks/${p.slug}`);
        meta.image = p.seo?.ogImage || p.coverImage?.url || meta.image;
        meta.type = 'product';
        meta.ogTitle = p.seo?.ogTitle;
        meta.ogDescription = p.seo?.ogDescription;
        meta.noindex = p.status !== 'published' || Boolean(p.seo?.noindex);
        if (seo.structuredData.products && p.status === 'published') {
            const ld = {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: p.title,
                description: truncate(p.shortDescription, 300),
                image: p.coverImage?.url ? [p.coverImage.url] : undefined,
                sku: String(p._id),
                brand: { '@type': 'Brand', name: p.publisher || general.siteName },
                offers: { '@type': 'Offer', url: meta.canonical, priceCurrency: p.currency, price: (p.price / 100).toFixed(2), availability: 'https://schema.org/InStock' },
            };
            // Only real, approved reviews are ever exposed as ratings.
            if (seo.structuredData.reviews && p.ratingCount > 0) {
                ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.ratingAverage.toFixed(1), reviewCount: p.ratingCount };
                const reviews = await Review.find({ product: p._id, status: 'approved' }).sort({ createdAt: -1 }).limit(3).lean();
                ld.review = reviews.map((r) => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: r.rating }, author: { '@type': 'Person', name: r.displayName || 'Verified buyer' }, reviewBody: truncate(r.body, 500) }));
            }
            meta.jsonLd.push(ld);
        }
        crumbs([{ name: 'Home', path: '/' }, { name: 'eBooks', path: '/ebooks' }, ...(p.category ? [{ name: p.category.name, path: `/category/${p.category.slug}` }] : []), { name: p.title, path: `/ebooks/${p.slug}` }]);
    } else if ((m = clean.match(/^\/category\/([a-z0-9-]+)$/))) {
        const c = await Category.findOne({ slug: m[1], visible: true }).lean();
        if (!c) return { status: 404, meta: { ...meta, title: title('Page not found'), noindex: true } };
        meta.title = title(c.seo?.title || `${c.name} eBooks`);
        meta.description = truncate(c.seo?.description || c.description, 160) || meta.description;
        meta.image = c.seo?.ogImage || c.image || meta.image;
        meta.noindex = Boolean(c.seo?.noindex);
        crumbs([{ name: 'Home', path: '/' }, { name: c.name, path: `/category/${c.slug}` }]);
    } else if ((m = clean.match(/^\/([a-z0-9-]+)$/))) {
        const staticTitles = { categories: 'Categories', support: 'Support', faq: 'Frequently asked questions', contact: 'Contact us', cart: 'Your cart', checkout: 'Checkout', login: 'Sign in', register: 'Create account', download: 'Download your eBook', 'cookie-preferences': 'Cookie preferences' };
        if (staticTitles[m[1]]) meta.title = title(staticTitles[m[1]]);
        else {
            const page = await Page.findOne({ slug: m[1], published: true }).lean();
            if (page) {
                meta.title = title(page.seo?.title || page.title);
                meta.description = page.seo?.description || meta.description;
                meta.noindex = meta.noindex || Boolean(page.seo?.noindex);
            } else if (!['account', 'admin', 'order'].includes(m[1])) return { status: 404, meta: { ...meta, title: title('Page not found'), noindex: true } };
        }
    }
    return { status: 200, meta };
};

const metaTags = (meta, seo) => {
    const t = escapeHtml(meta.title);
    const d = escapeHtml(meta.description || '');
    const tags = [
        `<title>${t}</title>`,
        `<meta name="description" content="${d}">`,
        `<link rel="canonical" href="${escapeHtml(meta.canonical)}">`,
        `<meta property="og:title" content="${escapeHtml(meta.ogTitle || meta.title)}">`,
        `<meta property="og:description" content="${escapeHtml(meta.ogDescription || meta.description || '')}">`,
        `<meta property="og:type" content="${meta.type}">`,
        `<meta property="og:url" content="${escapeHtml(meta.canonical)}">`,
        `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}">`,
    ];
    if (meta.image) tags.push(`<meta property="og:image" content="${escapeHtml(abs(meta.image))}">`, `<meta name="twitter:image" content="${escapeHtml(abs(meta.image))}">`);
    if (seo.twitterHandle) tags.push(`<meta name="twitter:site" content="${escapeHtml(seo.twitterHandle)}">`);
    if (meta.noindex) tags.push('<meta name="robots" content="noindex, nofollow">');
    for (const ld of meta.jsonLd || []) tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
    // data-ssr-meta lets the client remove these once React renders its own metadata.
    return tags.map((t) => t.replace(/^<(\w+)/, '<$1 data-ssr-meta')).join('\n    ');
};

let indexTemplate = null;
const distDir = () => path.resolve(process.cwd(), '..', 'Frontend', 'dist');

/** Serves the built SPA with route-specific meta tags injected (used when SERVE_FRONTEND=true). */
export const renderSpa = async (req, res, next) => {
    try {
        if (!indexTemplate || !config.isProduction) indexTemplate = fs.readFileSync(path.join(distDir(), 'index.html'), 'utf8');
        const result = await resolveRouteMeta(req.path);
        if (result.redirect) return res.redirect(result.redirect.statusCode, result.redirect.to);
        const seo = await getSettings('seo');
        const html = indexTemplate.replace(/<title>[\s\S]*?<\/title>/, '').replace('<!--app-head-->', metaTags(result.meta, seo));
        if (result.meta.noindex) res.set('X-Robots-Tag', 'noindex, nofollow');
        res.status(result.status || 200).type('html').send(html);
    } catch (err) {
        next(err);
    }
};

export { distDir };
