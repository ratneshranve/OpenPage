import { useLocation } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';

const siteOrigin = () => (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '');

/**
 * Per-page metadata using React 19's built-in <title>/<meta>/<link> hoisting.
 * When the API serves the app (SERVE_FRONTEND=true), the same metadata is also rendered
 * server-side for crawlers that do not execute JavaScript.
 */
export default function Seo({ title, description, image, canonical, noindex, type = 'website', jsonLd, ogTitle, ogDescription }) {
    const { config } = useConfig();
    const { pathname } = useLocation();
    const seo = config?.seo;
    const fullTitle = title ? (seo?.titleTemplate || '%s | OpenPage').replace('%s', title) : seo?.defaultTitle || 'OpenPage';
    const desc = description || seo?.defaultDescription || '';
    const url = canonical || `${siteOrigin()}${pathname}`;
    const img = image || seo?.defaultOgImage;
    const blocked = noindex || seo?.robotsDisallow?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || seo?.noindexPaths?.includes(pathname);
    const absImg = img && (img.startsWith('http') ? img : `${siteOrigin()}${img}`);

    return (
        <>
            <title>{fullTitle}</title>
            <meta name="description" content={desc} />
            <link rel="canonical" href={url} />
            <meta property="og:title" content={ogTitle || fullTitle} />
            <meta property="og:description" content={ogDescription || desc} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:site_name" content={config?.general?.siteName || 'OpenPage'} />
            {absImg && <meta property="og:image" content={absImg} />}
            <meta name="twitter:card" content={absImg ? 'summary_large_image' : 'summary'} />
            {seo?.twitterHandle && <meta name="twitter:site" content={seo.twitterHandle} />}
            {blocked && <meta name="robots" content="noindex, nofollow" />}
            {(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).map((ld, i) => (
                <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
            ))}
        </>
    );
}

export const breadcrumbLd = (items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${siteOrigin()}${c.path}` })),
});

export { siteOrigin };
