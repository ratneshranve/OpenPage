import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CheckCircle2, MailCheck } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Alert, Button, Checkbox, Input, PageLoader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { post, errorMessage } from '../lib/api';

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');
const password = z.string().min(10, 'Use at least 10 characters').regex(/[A-Za-z]/, 'Include at least one letter').regex(/[0-9]/, 'Include at least one number');

const schemas = {
    login: z.object({ email, password: z.string().min(1, 'Enter your password') }),
    register: z.object({ name: z.string().trim().min(1, 'Enter your name').max(120), email, password, marketingEmails: z.boolean().optional() }),
    forgot: z.object({ email }),
    reset: z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' }),
};

const TITLES = { login: 'Sign in', register: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password', verify: 'Verify your email' };

function Shell({ mode, children, footer }) {
    return (
        <div className="container-page flex justify-center py-12 sm:py-16">
            <Seo title={TITLES[mode]} noindex />
            <div className="w-full max-w-md">
                <h1 className="text-center text-2xl font-bold">{TITLES[mode]}</h1>
                <div className="card mt-6 p-6 sm:p-8">{children}</div>
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
        <Shell mode="verify">
            {state.loading && <PageLoader label="Verifying…" />}
            {state.ok && (
                <div className="text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
                    <p className="mt-3 font-semibold">{state.message}</p>
                    <p className="mt-1 text-sm text-muted">Purchases made with this email now appear in your library.</p>
                    <Button as={Link} to="/account/library" className="mt-5">Open my library</Button>
                </div>
            )}
            {state.error && <Alert tone="error" title="Verification failed" action={<Button as={Link} to="/account" size="sm" variant="outline">Go to account</Button>}>{state.error}</Alert>}
        </Shell>
    );
}

export default function Auth({ mode }) {
    if (mode === 'verify') return <VerifyEmail />;
    return <AuthForm key={mode} mode={mode} />;
}

function AuthForm({ mode }) {
    const { login, register: signUp, user } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [serverError, setServerError] = useState('');
    const [done, setDone] = useState('');
    const next = params.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({ resolver: zodResolver(schemas[mode]), defaultValues: { email: params.get('email') || '', marketingEmails: false } });

    useEffect(() => {
        if (user && (mode === 'login' || mode === 'register')) navigate(user.role === 'admin' && !next ? '/admin' : safeNext, { replace: true });
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = async (values) => {
        setServerError('');
        try {
            if (mode === 'login') {
                await login(values.email, values.password);
                toast.success('Signed in.');
            } else if (mode === 'register') {
                const r = await signUp({ name: values.name, email: values.email, password: values.password, marketingEmails: Boolean(values.marketingEmails) });
                toast.success(r.message);
            } else if (mode === 'forgot') {
                const r = await post('/auth/forgot-password', { email: values.email });
                setDone(r.message);
            } else if (mode === 'reset') {
                const r = await post('/auth/reset-password', { token: params.get('token'), password: values.password });
                toast.success(r.message);
                navigate('/login', { replace: true });
            }
        } catch (err) {
            setServerError(errorMessage(err));
        }
    };

    if (done) {
        return (
            <Shell mode={mode}>
                <div className="text-center">
                    <MailCheck className="mx-auto h-12 w-12 text-accent" />
                    <p className="mt-3 text-sm text-ink-soft">{done}</p>
                    <Button as={Link} to="/login" variant="outline" className="mt-5">Back to sign in</Button>
                </div>
            </Shell>
        );
    }

    return (
        <Shell
            mode={mode}
            footer={
                mode === 'login' ? (
                    <>New to OpenPage? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></>
                ) : mode === 'register' ? (
                    <>Already have an account? <Link to="/login">Sign in</Link></>
                ) : (
                    <Link to="/login">Back to sign in</Link>
                )
            }
        >
            {mode === 'register' && <p className="mb-5 text-sm text-muted">An account is optional for buying. It gives you a personal library of all your purchases.</p>}
            {mode === 'forgot' && <p className="mb-5 text-sm text-muted">Enter your account email and we will send you a link to reset your password.</p>}
            {serverError && <Alert tone="error" className="mb-5">{serverError}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {mode === 'register' && <Input label="Name" autoComplete="name" {...register('name')} error={errors.name?.message} required />}
                {mode !== 'reset' && <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} required />}
                {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                    <Input
                        label={mode === 'reset' ? 'New password' : 'Password'}
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        hint={mode !== 'login' ? 'At least 10 characters, with a letter and a number.' : undefined}
                        {...register('password')}
                        error={errors.password?.message}
                        required
                    />
                )}
                {mode === 'reset' && <Input label="Confirm password" type="password" autoComplete="new-password" {...register('confirm')} error={errors.confirm?.message} required />}
                {mode === 'register' && <Checkbox {...register('marketingEmails')} label="Email me about new eBooks and genuine offers (optional)." />}
                {mode === 'login' && (
                    <div className="text-right">
                        <Link to="/forgot-password" className="text-sm">Forgot password?</Link>
                    </div>
                )}
                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                    {{ login: 'Sign in', register: 'Create account', forgot: 'Send reset link', reset: 'Update password' }[mode]}
                </Button>
                {mode === 'register' && (
                    <p className="text-center text-xs text-muted">
                        By creating an account you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
                    </p>
                )}
            </form>
        </Shell>
    );
}
