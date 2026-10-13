import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Bell, ChevronRight, Cookie } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConsent } from '../../context/ConsentContext';
import { useConfig } from '../../context/ConfigContext';
import { adsenseConfig, initAdsense } from '../../lib/tracking';
import { enablePush, pushState } from '../../lib/notifications';
import { Button, Checkbox, Modal } from '../ui';

/** Renders admin-managed Markdown safely. */
export function Markdown({ children, className = 'prose-openpage' }) {
    const html = useMemo(() => DOMPurify.sanitize(marked.parse(children || '', { gfm: true, breaks: false })), [children]);
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Breadcrumbs({ items }) {
    return (
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-1">
                {items.map((c, i) => (
                    <li key={c.path} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                        {i === items.length - 1 ? (
                            <span aria-current="page" className="text-ink-soft">
                                {c.name}
                            </span>
                        ) : (
                            <Link to={c.path} className="text-muted no-underline hover:text-accent">
                                {c.name}
                            </Link>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

export function CookieBanner() {
    const { showBanner, acceptAll, rejectAll, saveCustom } = useConsent();
    const { config } = useConfig();
    const [custom, setCustom] = useState(false);
    const [choice, setChoice] = useState({ analytics: false, advertising: false });
    if (!showBanner) return null;
    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4" role="region" aria-label="Cookie consent">
                <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-xl md:flex-row md:items-center">
                    <Cookie className="hidden h-8 w-8 shrink-0 text-accent md:block" aria-hidden />
                    <p className="flex-1 text-sm leading-6 text-ink-soft">
                        {config.tracking.consent.bannerText}{' '}
                        <Link to="/privacy" className="link">
                            Privacy Policy
                        </Link>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCustom(true)}>
                            Customise
                        </Button>
                        <Button variant="outline" size="sm" onClick={rejectAll}>
                            Essential only
                        </Button>
                        <Button size="sm" variant="secondary" onClick={acceptAll}>
                            Accept all
                        </Button>
                    </div>
                </div>
            </div>
            <Modal
                open={custom}
                onClose={() => setCustom(false)}
                title="Cookie preferences"
                footer={
                    <Button
                        onClick={() => {
                            saveCustom(choice);
                            setCustom(false);
                        }}
                    >
                        Save preferences
                    </Button>
                }
            >
                <ConsentChoices value={choice} onChange={setChoice} />
            </Modal>
        </>
    );
}

export function ConsentChoices({ value, onChange }) {
    return (
        <div className="space-y-4">
            <Checkbox checked disabled label="Essential" description="Required for the store to work: sign-in, cart, secure checkout and fraud prevention." />
            <Checkbox checked={value.analytics} onChange={(e) => onChange({ ...value, analytics: e.target.checked })} label="Analytics" description="Helps us understand how the site is used so we can improve it." />
            <Checkbox checked={value.advertising} onChange={(e) => onChange({ ...value, advertising: e.target.checked })} label="Advertising" description="Meta Pixel, Google Ads measurement and, if enabled, Google AdSense ads." />
        </div>
    );
}

const NO_ADS = ['/cart', '/checkout', '/account', '/download', '/order', '/login', '/register', '/admin'];

/**
 * Optional AdSense unit. Never rendered on cart, checkout, account, download or order pages,
 * and only after advertising consent.
 */
export function AdSlot({ placement }) {
    const { consent } = useConsent();
    const { pathname } = useLocation();
    const ref = useRef(null);
    const ads = adsenseConfig();
    const slot = ads?.enabled && ads.placements?.find((p) => p.key === placement);
    const allowed = slot && consent.advertising && !NO_ADS.some((p) => pathname.startsWith(p));
    useEffect(() => {
        if (!allowed) return;
        initAdsense();
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            /* ad blocked */
        }
    }, [allowed, pathname]);
    if (!allowed) return null;
    return (
        <aside className="container-page my-10" aria-label="Advertisement">
            <p className="mb-1 text-center text-[11px] uppercase tracking-wider text-muted">Advertisement</p>
            <ins ref={ref} className="adsbygoogle block min-h-[90px]" data-ad-client={ads.clientId} data-ad-slot={slot.slot} data-ad-format="auto" data-full-width-responsive="true" />
        </aside>
    );
}

/** Explains the benefit first; the browser permission prompt appears only after a click. */
export function NotificationPrompt({ compact }) {
    const { config } = useConfig();
    const n = config?.notifications;
    const [state, setState] = useState(() => pushState());
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem('op_push_dismissed') === '1';
        } catch {
            return false;
        }
    });
    if (!n?.enabled || !n.firebase || state !== 'not_subscribed' || dismissed) return null;
    const enable = async () => {
        setLoading(true);
        try {
            await enablePush(n.firebase);
            setState('subscribed');
            toast.success('Notifications enabled.');
        } catch (err) {
            toast.error(err.message);
            setState(pushState());
        } finally {
            setLoading(false);
        }
    };
    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem('op_push_dismissed', '1');
        } catch {
            /* ignore */
        }
    };
    return (
        <div className={compact ? 'rounded-xl border border-line p-4' : 'rounded-2xl border border-accent-tint bg-accent-pale p-5'}>
            <div className="flex gap-3">
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div className="flex-1">
                    <p className="font-semibold">{n.promptTitle}</p>
                    <p className="mt-1 text-sm text-ink-soft">{n.promptText}</p>
                    <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="secondary" loading={loading} onClick={enable}>
                            Turn on notifications
                        </Button>
                        <Button size="sm" variant="ghost" onClick={dismiss}>
                            Not now
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
