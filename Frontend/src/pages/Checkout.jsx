import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, Mail, Pencil, ShieldCheck, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo from '../components/layout/Seo';
import OrderSummary from '../components/shop/OrderSummary';
import CouponForm from '../components/shop/CouponForm';
import { Alert, Button, Checkbox, EmptyState, Input, PageLoader } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { api, errorCode, errorDetails, errorMessage } from '../lib/api';
import { getAttribution } from '../lib/attribution';
import { getSessionToken, loadRazorpay, rememberOrderToken, setSessionToken } from '../lib/checkout';
import { trackInitiateCheckout } from '../lib/tracking';

const EMAIL_RX = /^\S+@\S+\.\S+$/;

export default function Checkout() {
    const { items, coupon, setCoupon, removeMany, clear } = useCart();
    const { user } = useAuth();
    const { config } = useConfig();
    const navigate = useNavigate();

    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [busy, setBusy] = useState('');
    const [terms, setTerms] = useState(false);
    const [termsError, setTermsError] = useState('');
    const [marketing, setMarketing] = useState(false);
    const [payError, setPayError] = useState('');
    const tracked = useRef(false);
    const codeRef = useRef(null);
    const userPrefilled = useRef(false);

    const ids = items.map((i) => i.id);
    const idsKey = ids.join(',');

    const applySession = useCallback(
        (s) => {
            setSession(s);
            if (s.quote?.invalidItems?.length) {
                removeMany(s.quote.invalidItems.map((i) => i.productId));
                toast('Some unavailable items were removed from your cart.', { icon: 'ℹ️' });
            }
            if (!userPrefilled.current && s.email) {
                userPrefilled.current = true;
                setEmail(s.email);
            }
            if (!tracked.current && s.quote?.items?.length) {
                tracked.current = true;
                trackInitiateCheckout(s.quote);
            }
        },
        [removeMany]
    );

    // Create or sync the server-side checkout session with the cart.
    useEffect(() => {
        if (!idsKey) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setPageError('');
            try {
                let s = null;
                if (getSessionToken()) {
                    try {
                        s = (await api.patch('/checkout/sessions/current', { productIds: idsKey.split(','), couponCode: coupon || null })).data.data;
                    } catch (err) {
                        if (err.response?.status !== 404) throw err;
                        setSessionToken(null);
                    }
                }
                if (!s) {
                    s = (await api.post('/checkout/sessions', { productIds: idsKey.split(','), couponCode: coupon || null, attribution: getAttribution() })).data.data;
                    setSessionToken(s.sessionToken);
                }
                if (!cancelled) applySession(s);
            } catch (err) {
                if (!cancelled) setPageError(errorMessage(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!userPrefilled.current && user?.email) {
            userPrefilled.current = true;
            setEmail(user.email);
        }
    }, [user?.email]);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const verified = session?.emailVerified && session.email === email.trim().toLowerCase();

    const sendCode = async () => {
        setEmailError('');
        setCodeError('');
        if (!EMAIL_RX.test(email.trim())) return setEmailError('Enter a valid email address.');
        setBusy('send');
        try {
            const r = await api.post('/checkout/otp/send', { email: email.trim() });
            setCodeSent(true);
            setCode('');
            setCooldown(r.data.data.cooldownSeconds || 60);
            toast.success('Email verification code sent.');
            setTimeout(() => codeRef.current?.focus(), 50);
        } catch (err) {
            const retry = errorDetails(err)?.retryAfter;
            if (retry) {
                setCooldown(retry);
                setCodeSent(true);
            }
            setEmailError(errorMessage(err));
        } finally {
            setBusy('');
        }
    };

    const verifyCode = async (e) => {
        e?.preventDefault();
        setCodeError('');
        if (!/^\d{6}$/.test(code)) return setCodeError('Enter the 6-digit code from your email.');
        setBusy('verify');
        try {
            const r = await api.post('/checkout/otp/verify', { email: email.trim(), code });
            applySession(r.data.data.session);
            setCodeSent(false);
            toast.success('Your email has been verified.');
        } catch (err) {
            const c = errorCode(err);
            setCodeError(errorMessage(err));
            if (c === 'OTP_EXPIRED') toast.error('This verification code has expired.');
            if (c === 'OTP_LOCKED' || c === 'OTP_EXPIRED') setCode('');
        } finally {
            setBusy('');
        }
    };

    const changeEmail = () => {
        setSession((s) => ({ ...s, emailVerified: false }));
        setCodeSent(false);
        setCode('');
    };

    const applyCoupon = async (c) => {
        setBusy('coupon');
        try {
            const r = await api.patch('/checkout/sessions/current', { couponCode: c });
            const q = r.data.data.quote;
            if (q.coupon?.valid) {
                setCoupon(c);
                applySession(r.data.data);
                toast.success('Offer applied successfully.');
            } else {
                toast.error(q.coupon?.message || 'This coupon code is not valid.');
                const reset = await api.patch('/checkout/sessions/current', { couponCode: null });
                applySession(reset.data.data);
            }
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy('');
        }
    };

    const removeCoupon = async () => {
        setCoupon('');
        try {
            const r = await api.patch('/checkout/sessions/current', { couponCode: null });
            applySession(r.data.data);
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    const finish = (orderNumber) => {
        rememberOrderToken(orderNumber, getSessionToken());
        clear();
        navigate(`/order/${orderNumber}`, { replace: true });
    };

    const pay = async () => {
        setPayError('');
        setTermsError('');
        if (!verified) return setPayError('Please verify your email address before continuing to payment.');
        if (!terms) return setTermsError('Please accept the Terms and Conditions to continue.');
        setBusy('pay');
        let order;
        try {
            await loadRazorpay();
            order = (await api.post('/checkout/create-order', { termsAccepted: true, marketingConsent: marketing })).data.data;
        } catch (err) {
            const c = errorCode(err);
            const d = errorDetails(err);
            setBusy('');
            if (c === 'ALREADY_PAID' || c === 'PAYMENT_PENDING') {
                toast(errorMessage(err), { icon: 'ℹ️' });
                return finish(d.orderNumber);
            }
            if (c === 'CART_CHANGED') {
                removeMany((d?.invalidItems || []).map((i) => i.productId));
            }
            if (c === 'COUPON_INVALID') {
                setCoupon('');
                await api.patch('/checkout/sessions/current', { couponCode: null }).then((r) => applySession(r.data.data)).catch(() => {});
            }
            if (c === 'EMAIL_NOT_VERIFIED' || c === 'SESSION_EXPIRED') changeEmail();
            setPayError(errorMessage(err));
            return toast.error('Unable to process your payment. Please try again.');
        }

        rememberOrderToken(order.orderNumber, getSessionToken());
        const rzp = new window.Razorpay({
            key: order.razorpay.keyId,
            order_id: order.razorpay.orderId,
            amount: order.razorpay.amount,
            currency: order.razorpay.currency,
            name: order.merchantName,
            description: `Order ${order.orderNumber}`,
            prefill: { email: order.prefill.email },
            readonly: { email: true },
            theme: { color: '#15803d' },
            notes: { orderNumber: order.orderNumber },
            handler: async (resp) => {
                toast.loading('Payment is being confirmed.', { id: 'pay' });
                try {
                    const r = await api.post('/payments/verify', resp);
                    toast.success(r.data.data.status === 'paid' ? 'Payment successful. Your eBook is ready.' : 'Payment is being confirmed.', { id: 'pay' });
                } catch {
                    // The webhook will still confirm the payment; the order page polls for it.
                    toast('Payment received. We are confirming it now.', { id: 'pay', icon: '⏳' });
                }
                finish(order.orderNumber);
            },
            modal: {
                ondismiss: () => {
                    setBusy('');
                    toast('Payment cancelled. You can try again when ready.', { icon: 'ℹ️' });
                },
                confirm_close: true,
            },
        });
        rzp.on('payment.failed', (resp) => {
            const reason = resp?.error?.description || 'The payment did not go through.';
            setPayError(`${reason} No order has been completed. You can try again or use a different payment method.`);
            api.post('/payments/failed', { razorpay_order_id: resp?.error?.metadata?.order_id || order.razorpay.orderId, razorpay_payment_id: resp?.error?.metadata?.payment_id }).catch(() => {});
        });
        rzp.open();
    };

    if (!items.length && !loading) {
        return (
            <div className="container-page py-12">
                <Seo title="Checkout" noindex />
                <EmptyState icon={ShoppingCart} title="Your cart is empty" action={<Button as={Link} to="/ebooks">Browse eBooks</Button>} />
            </div>
        );
    }
    if (loading && !session) return <PageLoader label="Preparing secure checkout…" />;

    const quote = session?.quote;

    return (
        <div className="container-page py-10">
            <Seo title="Checkout" noindex />
            <h1 className="text-3xl font-bold">Secure checkout</h1>
            {pageError && (
                <Alert tone="error" className="mt-6" title="Checkout could not be started" action={<Button size="sm" variant="outline" onClick={() => window.location.reload()}>Try again</Button>}>
                    {pageError}
                </Alert>
            )}
            {session && (
                <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
                    <div className="space-y-6">
                        {/* Step 1: email verification */}
                        <section className="card p-6" aria-labelledby="step-email">
                            <div className="flex items-center gap-3">
                                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${verified ? 'bg-brand text-white' : 'bg-accent-pale text-accent'}`}>{verified ? <CheckCircle2 className="h-5 w-5" /> : 1}</span>
                                <h2 id="step-email" className="text-lg font-semibold">Verify your email</h2>
                            </div>
                            <p className="mt-2 text-sm text-muted">Your download link and receipt are sent here. We verify it with a one-time code so your eBook reaches the right inbox.</p>

                            {verified ? (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-tint bg-brand-pale p-4">
                                    <p className="flex items-center gap-2 text-sm">
                                        <ShieldCheck className="h-5 w-5 text-brand" /> <span className="font-medium">{session.email}</span> <span className="text-muted">verified</span>
                                    </p>
                                    <Button variant="ghost" size="sm" onClick={changeEmail}>
                                        <Pencil className="h-4 w-4" /> Change
                                    </Button>
                                </div>
                            ) : (
                                <div className="mt-4 space-y-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                        <Input
                                            className="flex-1"
                                            label="Email address"
                                            type="email"
                                            autoComplete="email"
                                            inputMode="email"
                                            value={email}
                                            onChange={(e) => {
                                                userPrefilled.current = true;
                                                setEmail(e.target.value);
                                                setEmailError('');
                                            }}
                                            error={emailError}
                                            required
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendCode())}
                                        />
                                        <Button variant="secondary" className="sm:mt-[30px]" onClick={sendCode} loading={busy === 'send'} disabled={cooldown > 0}>
                                            <Mail className="h-4 w-4" />
                                            {cooldown > 0 ? `Resend in ${cooldown}s` : codeSent ? 'Resend code' : 'Send code'}
                                        </Button>
                                    </div>
                                    {codeSent && (
                                        <form onSubmit={verifyCode} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
                                            <Input
                                                ref={codeRef}
                                                label="6-digit code"
                                                hint={`We sent a code to ${email.trim()}. It expires in ${Math.round((config?.otp?.ttlSeconds || 300) / 60)} minutes. Check your spam folder if you cannot find it.`}
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                value={code}
                                                onChange={(e) => {
                                                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                                    setCodeError('');
                                                }}
                                                error={codeError}
                                                className="flex-1 [&_input]:tracking-[0.4em] [&_input]:text-lg"
                                            />
                                            <Button type="submit" className="sm:mt-[30px]" loading={busy === 'verify'}>
                                                Verify
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Step 2: confirm and pay */}
                        <section className={`card p-6 ${verified ? '' : 'opacity-60'}`} aria-labelledby="step-pay">
                            <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-pale text-sm font-bold text-accent">2</span>
                                <h2 id="step-pay" className="text-lg font-semibold">Review and pay</h2>
                            </div>
                            <div className="mt-4 space-y-4">
                                <Checkbox
                                    checked={terms}
                                    onChange={(e) => {
                                        setTerms(e.target.checked);
                                        setTermsError('');
                                    }}
                                    disabled={!verified}
                                    error={termsError}
                                    label={
                                        <>
                                            I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link> and understand this is a digital product delivered by email. See the <Link to="/refund-policy" target="_blank">Refund Policy</Link>.
                                        </>
                                    }
                                />
                                <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} disabled={!verified} label="Email me about new eBooks and genuine offers (optional). Unsubscribe any time." />
                                {payError && <Alert tone="error" title="Payment not completed">{payError}</Alert>}
                                <Button size="lg" className="w-full" onClick={pay} loading={busy === 'pay'} disabled={!verified || !quote?.items?.length}>
                                    <Lock className="h-4 w-4" /> {verified ? `Pay ${quote ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency }).format(quote.total / 100) : ''} securely` : 'Verify your email to continue'}
                                </Button>
                                <p className="text-center text-xs text-muted">
                                    Payments are processed by Razorpay. We never see your card details. See our <Link to="/privacy">Privacy Policy</Link>. Need help? <Link to="/support">Contact support</Link>.
                                </p>
                            </div>
                        </section>
                    </div>

                    <aside className="lg:sticky lg:top-24 lg:self-start">
                        <div className="card space-y-4 p-5">
                            <h2 className="font-semibold">Order summary</h2>
                            <OrderSummary quote={quote} compact />
                            <CouponForm applied={session.couponCode && quote?.coupon?.valid ? session.couponCode : ''} coupon={quote?.coupon} onApply={applyCoupon} onRemove={removeCoupon} loading={busy === 'coupon'} />
                            {quote?.coupon?.pendingVerification && <p className="text-xs text-muted">{quote.coupon.message}</p>}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
