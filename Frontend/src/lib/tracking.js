/**
 * Consent-aware marketing tags. Nothing here loads until the visitor has granted the
 * relevant consent (advertising for Meta Pixel / Google Ads / AdSense).
 * Purchase events are only fired from the order page after the backend confirms payment,
 * once per order (deduplicated by order number both locally and on the server).
 */
let cfg = null;
let consent = { analytics: false, advertising: false };
const loaded = { meta: false, gtag: false, adsense: false };

const loadScript = (src, attrs = {}) =>
    new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.async = true;
        s.src = src;
        Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });

const initMeta = () => {
    if (window.fbq) {
        loaded.meta = true;
        return;
    }
    if (loaded.meta || !cfg?.meta?.enabled || !consent.advertising) return;
    loaded.meta = true;
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    if (cfg?.meta?.pixelId) {
        window.fbq('init', cfg.meta.pixelId);
        window.fbq('track', 'PageView');
    }
};

const initGtag = () => {
    if (loaded.gtag || !cfg?.googleAds?.enabled) return;
    if (!consent.advertising && !consent.analytics) return;
    loaded.gtag = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
    };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    window.gtag('consent', 'update', {
        ad_storage: consent.advertising ? 'granted' : 'denied',
        ad_user_data: consent.advertising ? 'granted' : 'denied',
        ad_personalization: consent.advertising ? 'granted' : 'denied',
        analytics_storage: consent.analytics ? 'granted' : 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', cfg.googleAds.tagId);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.googleAds.tagId)}`).catch(() => {});
};

export const initAdsense = () => {
    if (loaded.adsense || !cfg?.adsense?.enabled || !consent.advertising) return false;
    loaded.adsense = true;
    loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.adsense.clientId)}`, { crossorigin: 'anonymous' }).catch(() => {});
    return true;
};

export const configureTracking = (trackingConfig, consentState) => {
    cfg = trackingConfig;
    consent = consentState;
    initMeta();
    initGtag();
    if (window.gtag && loaded.gtag) {
        window.gtag('consent', 'update', {
            ad_storage: consent.advertising ? 'granted' : 'denied',
            ad_user_data: consent.advertising ? 'granted' : 'denied',
            ad_personalization: consent.advertising ? 'granted' : 'denied',
            analytics_storage: consent.analytics ? 'granted' : 'denied',
        });
    }
    if (window.fbq && consent?.advertising) window.fbq('consent', 'grant');
};

export const adsenseConfig = () => cfg?.adsense;

const metaEnabled = (event) => (loaded.meta || Boolean(window.fbq)) && (cfg?.meta?.events?.[event] !== false) && typeof window.fbq === 'function';

export const trackPageView = () => {
    if (metaEnabled('PageView')) window.fbq('track', 'PageView');
    if (loaded.gtag && window.gtag) window.gtag('event', 'page_view', { page_path: window.location.pathname });
};

export const trackViewContent = (product) => {
    if (metaEnabled('ViewContent')) window.fbq('track', 'ViewContent', { content_ids: [product._id], content_name: product.title, content_type: 'product', value: product.finalPrice / 100, currency: product.currency });
};

export const trackSearch = (q) => {
    if (q && metaEnabled('Search')) window.fbq('track', 'Search', { search_string: q });
};

export const trackAddToCart = (product) => {
    if (metaEnabled('AddToCart')) window.fbq('track', 'AddToCart', { content_ids: [product._id], content_name: product.title, content_type: 'product', value: product.finalPrice / 100, currency: product.currency });
};

export const trackInitiateCheckout = (quote) => {
    if (metaEnabled('InitiateCheckout')) window.fbq('track', 'InitiateCheckout', { content_ids: quote.items.map((i) => i.product), num_items: quote.items.length, value: quote.total / 100, currency: quote.currency });
    if (loaded.gtag && cfg.googleAds.trackCheckout && cfg.googleAds.checkoutLabel && window.gtag) {
        window.gtag('event', 'conversion', { send_to: `${cfg.googleAds.conversionId || cfg.googleAds.tagId}/${cfg.googleAds.checkoutLabel}`, value: quote.total / 100, currency: quote.currency });
    }
};

/** Fires once per order. Returns true if any tag received the event. */
export const trackPurchase = (order) => {
    const key = `op_tracked_${order.orderNumber}`;
    try {
        if (localStorage.getItem(key)) return false;
    } catch {
        /* storage unavailable */
    }
    let sent = false;
    if (metaEnabled('Purchase')) {
        // eventID lets Meta deduplicate against any server-side events for the same order.
        window.fbq('track', 'Purchase', { content_ids: order.items.map((i) => i.productId), content_type: 'product', value: order.total / 100, currency: order.currency, num_items: order.items.length }, { eventID: order.orderNumber });
        sent = true;
    }
    if (loaded.gtag && cfg.googleAds.purchaseLabel && window.gtag) {
        window.gtag('event', 'conversion', { send_to: `${cfg.googleAds.conversionId || cfg.googleAds.tagId}/${cfg.googleAds.purchaseLabel}`, value: order.total / 100, currency: order.currency, transaction_id: order.orderNumber });
        sent = true;
    }
    try {
        localStorage.setItem(key, '1');
    } catch {
        /* ignore */
    }
    return sent;
};
