/** First-touch marketing attribution kept for the browser session and attached to checkouts. */
const KEY = 'op_attribution';

export const captureAttribution = () => {
    try {
        if (sessionStorage.getItem(KEY)) return;
        const p = new URLSearchParams(window.location.search);
        const data = {
            source: p.get('utm_source') || undefined,
            medium: p.get('utm_medium') || undefined,
            campaign: p.get('utm_campaign') || undefined,
            term: p.get('utm_term') || undefined,
            content: p.get('utm_content') || undefined,
            gclid: p.get('gclid') || undefined,
            fbclid: p.get('fbclid') || undefined,
            referrer: document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : undefined,
            landingPage: window.location.pathname,
        };
        if (!data.source && data.gclid) Object.assign(data, { source: 'google', medium: 'cpc' });
        if (!data.source && data.fbclid) Object.assign(data, { source: 'facebook', medium: 'paid_social' });
        if (!data.source && data.referrer) {
            try {
                Object.assign(data, { source: new URL(data.referrer).hostname, medium: 'referral' });
            } catch {
                /* ignore */
            }
        }
        sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch {
        /* storage unavailable */
    }
};

export const getAttribution = () => {
    try {
        const data = JSON.parse(sessionStorage.getItem(KEY) || '{}');
        return Object.fromEntries(Object.entries(data).filter(([, v]) => v));
    } catch {
        return {};
    }
};
