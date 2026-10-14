import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Copy, CreditCard, Lock, Mail, Pencil, ShieldCheck, ShoppingCart, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo from '../components/layout/Seo';
import OrderSummary from '../components/shop/OrderSummary';
import CouponForm from '../components/shop/CouponForm';
import { Alert, Button, Checkbox, EmptyState, Input, Modal, PageLoader, cn } from '../components/ui';
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
    const [selectedMethod, setSelectedMethod] = useState('');
    const [upiOrder, setUpiOrder] = useState(null);
    const [utr, setUtr] = useState('');
    const [copied, setCopied] = useState(false);
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

    const paymentsConfig = config?.payments;
    const activeGateway = paymentsConfig?.activeGateway || 'manual_upi';
    const razorpayAvailable = Boolean(paymentsConfig?.razorpay?.enabled);
    const manualUpiAvailable = Boolean(paymentsConfig?.manualUpi?.enabled ?? true);
    const allowChoice = activeGateway === 'both' && razorpayAvailable && manualUpiAvailable;
    const defaultMethod = activeGateway === 'razorpay' && razorpayAvailable ? 'razorpay' : 'manual_upi';
    const activeMethod = allowChoice ? (selectedMethod || defaultMethod) : defaultMethod;

    const pay = async () => {
        setPayError('');
        setTermsError('');
        if (!verified) return setPayError('Please verify your email address before continuing to payment.');
        if (!terms) return setTermsError('Please accept the Terms and Conditions to continue.');
        setBusy('pay');
        let order;
        try {
            if (activeMethod === 'razorpay') {
                await loadRazorpay();
            }
            order = (await api.post('/checkout/create-order', { termsAccepted: true, marketingConsent: marketing, paymentMethod: activeMethod })).data.data;
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

        if (order.paymentMethod === 'manual_upi') {
            setBusy('');
            setUpiOrder(order);
            return;
        }

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
            api.post('/payments/failed', { razorpay_order_id: resp?.error?.metadata?.order_id || order.razorpay?.orderId, razorpay_payment_id: resp?.error?.metadata?.payment_id }).catch(() => {});
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
                                {allowChoice ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-ink">Payment method</label>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMethod('manual_upi')}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                                                    activeMethod === 'manual_upi'
                                                        ? 'border-brand bg-brand-pale text-ink shadow-sm ring-1 ring-brand'
                                                        : 'border-line bg-white hover:bg-surface text-ink-soft'
                                                )}
                                            >
                                                <Smartphone className="h-5 w-5 text-brand shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-sm">UPI (GPay / PhonePe / Paytm)</p>
                                                    <p className="text-xs text-muted">Scan QR or Pay to UPI ID</p>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMethod('razorpay')}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                                                    activeMethod === 'razorpay'
                                                        ? 'border-brand bg-brand-pale text-ink shadow-sm ring-1 ring-brand'
                                                        : 'border-line bg-white hover:bg-surface text-ink-soft'
                                                )}
                                            >
                                                <CreditCard className="h-5 w-5 text-accent shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-sm">Cards & Net Banking</p>
                                                    <p className="text-xs text-muted">Razorpay Gateway</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                ) : activeMethod === 'manual_upi' ? (
                                    <div className="rounded-xl border border-brand-tint bg-brand-pale/60 p-4">
                                        <div className="flex items-center gap-2.5">
                                            <Smartphone className="h-5 w-5 text-brand" />
                                            <span className="font-semibold text-sm text-ink">Pay with UPI (GPay, PhonePe, Paytm, BHIM)</span>
                                        </div>
                                        <p className="mt-1.5 text-xs text-muted leading-relaxed">
                                            You will be shown a QR code and UPI ID to pay from any UPI app. Once paid, simply enter your 12-digit UTR number to get immediate access.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-line bg-surface p-4">
                                        <div className="flex items-center gap-2.5">
                                            <Lock className="h-5 w-5 text-brand" />
                                            <span className="font-semibold text-sm text-ink">Secure Checkout with Razorpay</span>
                                        </div>
                                        <p className="mt-1.5 text-xs text-muted">Cards, Netbanking, Wallets and UPI.</p>
                                    </div>
                                )}

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
                                    <Lock className="h-4 w-4" /> {verified ? (activeMethod === 'manual_upi' ? `Continue to UPI Payment (${quote ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency }).format(quote.total / 100) : ''})` : `Pay ${quote ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: quote.currency }).format(quote.total / 100) : ''} securely`) : 'Verify your email to continue'}
                                </Button>
                                <p className="text-center text-xs text-muted">
                                    {activeMethod === 'manual_upi' ? 'Direct UPI transfer. Zero gateway fees. Verified instantly.' : 'Payments are processed by Razorpay. We never see your card details.'} See our <Link to="/privacy">Privacy Policy</Link>. Need help? <Link to="/support">Contact support</Link>.
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

            {upiOrder && (
                <Modal
                    open={Boolean(upiOrder)}
                    onClose={() => finish(upiOrder.orderNumber)}
                    title={`Scan & Pay via UPI · Order ${upiOrder.orderNumber}`}
                    size="md"
                >
                    <div className="space-y-4 text-center">
                        <div className="inline-block rounded-full bg-brand-pale px-4 py-1.5 text-sm font-bold text-brand">
                            Amount to Pay: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: upiOrder.currency }).format(upiOrder.amount / 100)}
                        </div>

                        <div>
                            <img
                                src={upiOrder.manualUpi?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiOrder.manualUpi?.upiUri || '')}`}
                                alt="UPI QR Code"
                                className="mx-auto h-48 w-48 rounded-xl border border-line bg-white p-2 shadow-sm"
                            />
                            <p className="mt-2 text-xs text-muted">Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app</p>
                        </div>

                        <div className="rounded-xl border border-line bg-surface p-3 text-left text-sm space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted font-medium">UPI ID / VPA:</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        navigator.clipboard.writeText(upiOrder.manualUpi?.upiId || '');
                                        setCopied(true);
                                        toast.success('UPI ID copied to clipboard!');
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? 'Copied' : 'Copy UPI ID'}
                                </Button>
                            </div>
                            <p className="font-mono text-sm font-bold text-ink">{upiOrder.manualUpi?.upiId}</p>
                            <p className="text-xs text-muted">Payee: <strong className="text-ink">{upiOrder.manualUpi?.payeeName}</strong></p>
                        </div>

                        {upiOrder.manualUpi?.upiUri && (
                            <a
                                href={upiOrder.manualUpi.upiUri}
                                className="flex sm:hidden items-center justify-center gap-2 rounded-lg bg-brand text-white py-3 px-4 font-semibold text-sm w-full shadow-sm"
                            >
                                <Smartphone className="h-4 w-4" /> Open in UPI App (Google Pay / PhonePe)
                            </a>
                        )}

                        <div className="border-t border-line pt-4 text-left space-y-3">
                            <Input
                                label="Enter 12-digit UPI Reference / UTR Number"
                                placeholder="e.g. 428901234567"
                                value={utr}
                                onChange={(e) => setUtr(e.target.value.replace(/\s+/g, ''))}
                                hint="Found in your UPI transaction receipt or bank SMS after paying."
                            />
                            <Button
                                className="w-full"
                                size="lg"
                                loading={busy === 'utr'}
                                disabled={!utr.trim()}
                                onClick={async () => {
                                    setBusy('utr');
                                    try {
                                        await api.post(`/checkout/order-status/${upiOrder.orderNumber}/submit-utr`, { utr: utr.trim() });
                                        toast.success('Payment reference submitted! Checking status...');
                                    } catch (err) {
                                        toast.error(errorMessage(err));
                                    } finally {
                                        setBusy('');
                                        finish(upiOrder.orderNumber);
                                    }
                                }}
                            >
                                Submit UTR & View Order
                            </Button>
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => finish(upiOrder.orderNumber)}
                                    className="text-xs text-muted hover:text-ink hover:underline"
                                >
                                    I will submit UTR later on the order page →
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
