import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Mail, KeyRound, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Alert, Button, Input, PageLoader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { post, errorMessage } from '../lib/api';

const EMAIL_RX = /^\S+@\S+\.\S+$/;

function Shell({ children, footer }) {
    return (
        <div className="container-page flex justify-center py-12 sm:py-16">
            <Seo title="Sign in" noindex />
            <div className="w-full max-w-md">
                <div className="text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-3">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Sign in with Email</h1>
                    <p className="mt-2 text-sm text-muted">
                        No password needed. We will send a secure 6-digit code to your email.
                    </p>
                </div>
                <div className="card mt-6 p-6 sm:p-8 shadow-sm">{children}</div>
                {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
            </div>
        </div>
    );
}

function VerifyEmail() {
    const [params] = useSearchParams();
    const { refresh } = useAuth();
    const [state, setState] = useState({ loading: true });
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        post('/auth/verify-email', { token: params.get('token') })
            .then((r) => {
                setState({ ok: true, message: r.message });
                refresh();
            })
            .catch((err) => setState({ error: errorMessage(err) }));
    }, [params, refresh]);

    return (
        <div className="container-page flex justify-center py-12 sm:py-16">
            <Seo title="Verify your email" noindex />
            <div className="w-full max-w-md">
                <div className="card p-6 sm:p-8">
                    {state.loading && <PageLoader label="Verifying…" />}
                    {state.ok && (
                        <div className="text-center">
                            <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
                            <p className="mt-3 font-semibold">{state.message}</p>
                            <p className="mt-1 text-sm text-muted">Purchases made with this email now appear in your library.</p>
                            <Button as={Link} to="/account/library" className="mt-5">Open my library</Button>
                        </div>
                    )}
                    {state.error && (
                        <Alert tone="error" title="Verification failed" action={<Button as={Link} to="/account" size="sm" variant="outline">Go to account</Button>}>
                            {state.error}
                        </Alert>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Auth({ mode }) {
    const navigate = useNavigate();

    // Redirect any register/forgot/reset links directly to unified login
    useEffect(() => {
        if (mode === 'register' || mode === 'forgot' || mode === 'reset') {
            navigate('/login', { replace: true });
        }
    }, [mode, navigate]);

    if (mode === 'verify') return <VerifyEmail />;
    return <OtpLoginForm />;
}

function OtpLoginForm() {
    const { sendLoginOtp, loginWithOtp, user } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [email, setEmail] = useState(() => params.get('email') || '');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');
    const codeRef = useRef(null);

    const next = params.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';

    useEffect(() => {
        if (user) {
            navigate(user.role === 'admin' && !next ? '/admin' : safeNext, { replace: true });
        }
    }, [user, navigate, next, safeNext]);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        setServerError('');
        const trimmed = email.trim();
        if (!trimmed) return setServerError('Enter your email address.');
        if (!EMAIL_RX.test(trimmed)) return setServerError('Enter a valid email address.');

        setSubmitting(true);
        try {
            const res = await sendLoginOtp(trimmed);
            setCodeSent(true);
            setCooldown(res?.data?.cooldownSeconds || 60);
            toast.success('6-digit code sent to your email.');
            setTimeout(() => codeRef.current?.focus(), 100);
        } catch (err) {
            setServerError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e?.preventDefault();
        setServerError('');
        const trimmedCode = code.trim();
        if (!/^\d{6}$/.test(trimmedCode)) {
            return setServerError('Please enter the 6-digit code received on your email.');
        }

        setSubmitting(true);
        try {
            await loginWithOtp(email.trim(), trimmedCode);
            toast.success('Signed in successfully.');
        } catch (err) {
            setServerError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Shell
            footer={
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <span>Secure passwordless sign in. Accounts are created automatically on first login.</span>
                </div>
            }
        >
            {serverError && <Alert tone="error" className="mb-5">{serverError}</Alert>}

            {!codeSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
                    <Input
                        label="Email address"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        hint="We will send a one-time code to this address."
                    />

                    <Button type="submit" className="w-full" size="lg" loading={submitting}>
                        Continue with Email <ArrowRight className="h-4 w-4" />
                    </Button>

                    <p className="text-center text-xs text-muted pt-2">
                        By continuing, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
                    </p>
                </form>
            ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                    <div className="rounded-xl border border-line bg-surface/50 p-3.5 text-sm flex items-center justify-between">
                        <div className="truncate">
                            <span className="text-xs text-muted block">Code sent to</span>
                            <span className="font-semibold text-ink truncate">{email}</span>
                        </div>
                        <button
                            type="button"
                            className="text-xs font-semibold text-accent hover:underline shrink-0 ml-2"
                            onClick={() => {
                                setCodeSent(false);
                                setCode('');
                                setServerError('');
                            }}
                        >
                            Change
                        </button>
                    </div>

                    <div>
                        <label htmlFor="otp-input" className="block text-sm font-medium text-ink mb-1">
                            Enter 6-digit code
                        </label>
                        <input
                            id="otp-input"
                            ref={codeRef}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="······"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="input h-14 text-center font-mono text-2xl tracking-[0.5em] font-bold"
                            autoFocus
                        />
                    </div>

                    <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={code.length !== 6}>
                        Verify & Sign in
                    </Button>

                    <div className="pt-2 text-center text-sm">
                        {cooldown > 0 ? (
                            <span className="text-muted">Resend code in {cooldown}s</span>
                        ) : (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline text-sm"
                                onClick={handleSendOtp}
                                disabled={submitting}
                            >
                                <RefreshCw className="h-3.5 w-3.5" /> Resend verification code
                            </button>
                        )}
                    </div>
                </form>
            )}
        </Shell>
    );
}
