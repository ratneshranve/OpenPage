import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download as DownloadIcon, FileWarning, LifeBuoy, MailCheck } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Alert, BookCover, Button, Input, PageLoader } from '../components/ui';
import { get, post, errorMessage } from '../lib/api';
import { dateTime } from '../lib/format';

const REASONS = {
    expired: 'This download link has expired. Links are time-limited to keep your purchase secure.',
    used_up: 'This download link has reached its download limit.',
    replaced: 'A newer download link has been issued, so this one no longer works.',
    access_revoked: 'Access to this purchase is no longer active. Please contact support if you think this is a mistake.',
    not_found: 'This download link is not valid. It may have been copied incompletely.',
};

function RequestLink({ intro }) {
    const [email, setEmail] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState('');
    const [error, setError] = useState('');
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter the email address you used at checkout.');
        setLoading(true);
        try {
            const r = await post('/downloads/request-link', { email, orderNumber: orderNumber || undefined });
            setSent(r.message);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };
    if (sent) return <Alert tone="success" title="Check your inbox">{sent}</Alert>;
    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            {intro && <p className="text-sm text-ink-soft">{intro}</p>}
            <Input label="Email used at checkout" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
            <Input label="Order number (optional)" placeholder="OP-XXXXXXXX" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} hint="Speeds things up if you have several orders." />
            <Button type="submit" loading={loading} className="w-full">
                <MailCheck className="h-4 w-4" /> Email me fresh download links
            </Button>
        </form>
    );
}

export default function Download() {
    const { token } = useParams();
    const [params] = useSearchParams();
    const [info, setInfo] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;
        get(`/downloads/token/${encodeURIComponent(token)}`)
            .then(setInfo)
            .catch((err) => setError(errorMessage(err)));
    }, [token]);

    if (!token) {
        return (
            <div className="container-page max-w-lg py-12">
                <Seo title="Download your eBook" noindex />
                <h1 className="text-2xl font-bold">Get your download links</h1>
                <p className="mt-2 text-muted">Lost your email or your link expired? We will send new secure links to the email address you used at checkout.</p>
                <div className="card mt-6 p-6">
                    <RequestLink />
                </div>
                <Troubleshooting />
            </div>
        );
    }
    if (!info && !error) return <PageLoader label="Checking your download link…" />;

    return (
        <div className="container-page max-w-lg py-12">
            <Seo title="Download your eBook" noindex />
            <div className="card p-6">
                {info?.productTitle && (
                    <div className="mb-5 flex items-center gap-4">
                        <div className="w-16 shrink-0"><BookCover src={info.coverImage?.url || info.coverImage} title={info.productTitle} className="rounded-md" /></div>
                        <div>
                            <h1 className="text-lg font-bold">{info.productTitle}</h1>
                            <p className="text-sm text-muted">{info.format} · Version {info.version}</p>
                        </div>
                    </div>
                )}
                {info?.valid ? (
                    <>
                        {params.get('error') && <Alert tone="warning" className="mb-4">The previous download attempt did not complete. Please try again.</Alert>}
                        <Button as="a" href={info.fileUrl} size="lg" className="w-full" download>
                            <DownloadIcon className="h-5 w-5" /> Download now
                        </Button>
                        <p className="mt-3 text-center text-xs text-muted">
                            Link valid until {dateTime(info.expiresAt)} · {info.usesLeft} download{info.usesLeft === 1 ? '' : 's'} left
                        </p>
                    </>
                ) : (
                    <>
                        <Alert tone="warning" title="This link can no longer be used" className="mb-5">
                            {REASONS[info?.reason] || error || REASONS.not_found}
                        </Alert>
                        {info?.reason !== 'access_revoked' && <RequestLink intro="Request a fresh link below. Your purchase is safe." />}
                    </>
                )}
            </div>
            <Troubleshooting />
        </div>
    );
}

function Troubleshooting() {
    return (
        <section className="mt-8 rounded-2xl bg-surface p-5 text-sm leading-6 text-ink-soft">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><FileWarning className="h-4 w-4" /> Download troubleshooting</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Check your spam or promotions folder for the email from us.</li>
                <li>On a phone, the file is saved to your Downloads or Files app.</li>
                <li>PDFs open in any browser, Adobe Acrobat Reader, or Apple Books.</li>
                <li>If the file will not open, try downloading it again on a stable connection.</li>
                <li>With an account, all purchases are always in your <Link to="/account/library">library</Link>.</li>
            </ul>
            <p className="mt-3 flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-accent" /> Still stuck? <Link to="/support">Contact support</Link> with your order number.</p>
        </section>
    );
}
