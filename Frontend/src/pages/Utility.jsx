import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { ConsentChoices, NotificationPrompt } from '../components/layout/Extras';
import { Alert, Button, PageLoader } from '../components/ui';
import { useConsent } from '../context/ConsentContext';
import { post, errorMessage } from '../lib/api';

function OneShot({ title, run, successText }) {
    const [state, setState] = useState({ loading: true });
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        run()
            .then((r) => setState({ ok: r }))
            .catch((err) => setState({ error: errorMessage(err) }));
    }, [run]);
    return (
        <div className="container-page max-w-lg py-16">
            <Seo title={title} noindex />
            {state.loading && <PageLoader />}
            {state.ok && (
                <div className="card p-8 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
                    <h1 className="mt-3 text-xl font-bold">{state.ok.message}</h1>
                    <p className="mt-2 text-sm text-muted">{successText}</p>
                    <Button as={Link} to="/" variant="outline" className="mt-5">Back to the store</Button>
                </div>
            )}
            {state.error && <Alert tone="error" title={title}>{state.error}</Alert>}
        </div>
    );
}

function Unsubscribe() {
    const [params] = useSearchParams();
    const [confirmed, setConfirmed] = useState(false);
    if (!confirmed) {
        return (
            <div className="container-page max-w-lg py-16">
                <Seo title="Unsubscribe" noindex />
                <div className="card p-8 text-center">
                    <h1 className="text-xl font-bold">Unsubscribe from marketing emails?</h1>
                    <p className="mt-2 text-sm text-muted">You will still receive receipts, download links and other emails about your orders.</p>
                    <Button className="mt-5" onClick={() => setConfirmed(true)}>Unsubscribe</Button>
                </div>
            </div>
        );
    }
    return <OneShot title="Unsubscribe" run={() => post('/newsletter/unsubscribe', { e: params.get('e'), s: params.get('s') })} successText="You will no longer receive marketing emails. Order and download emails are not affected." />;
}

function NewsletterConfirm() {
    const [params] = useSearchParams();
    return <OneShot title="Confirm subscription" run={() => post('/newsletter/confirm', { token: params.get('token') })} successText="You will receive occasional emails about new eBooks and genuine offers. Every email has an unsubscribe link." />;
}

function CookiePreferences() {
    const { consent, saveCustom, withdraw } = useConsent();
    const [choice, setChoice] = useState(consent);
    return (
        <div className="container-page max-w-2xl py-10">
            <Seo title="Cookie preferences" />
            <h1 className="text-3xl font-bold">Cookie preferences</h1>
            <p className="mt-2 text-muted">Choose which optional technologies we may use. Essential cookies are always on because the store cannot work without them. See our <Link to="/privacy">Privacy Policy</Link>.</p>
            <div className="card mt-6 p-6">
                <ConsentChoices value={choice} onChange={setChoice} />
                <div className="mt-6 flex flex-wrap gap-2">
                    <Button
                        onClick={() => {
                            saveCustom(choice);
                            toast.success('Preferences saved.');
                        }}
                    >
                        Save preferences
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            withdraw();
                            setChoice({ analytics: false, advertising: false });
                            toast.success('Optional cookies turned off.');
                        }}
                    >
                        Withdraw consent
                    </Button>
                </div>
                <p className="mt-4 text-xs text-muted">Scripts that were already loaded stop receiving data after you withdraw consent; reload the page to fully remove them.</p>
            </div>
            <div className="mt-6">
                <NotificationPrompt compact />
            </div>
        </div>
    );
}

export default function Utility({ kind }) {
    if (kind === 'unsubscribe') return <Unsubscribe />;
    if (kind === 'newsletter') return <NewsletterConfirm />;
    return <CookiePreferences />;
}
