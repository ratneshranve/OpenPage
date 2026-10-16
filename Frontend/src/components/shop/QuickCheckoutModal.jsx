import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, FileText, Lock, Mail, Phone, ShieldCheck, Smartphone, User, X, Zap, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, BookCover } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../lib/api';
import { money } from '../../lib/format';
import { getSessionToken, setSessionToken, rememberOrderToken, savePendingOrder, clearPendingOrder } from '../../lib/checkout';
import { getAttribution } from '../../lib/attribution';

const EMAIL_RX = /^\S+@\S+\.\S+$/;

export default function QuickCheckoutModal({ product, open, onClose, onSuccess }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState('details'); // 'details' | 'qr'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState(null);
    const [utr, setUtr] = useState('');
    const [submittingUtr, setSubmittingUtr] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setStep('details');
            setErrors({});
            setLoading(false);
            setOrder(null);
            setUtr('');
            setCopied(false);

            if (user?.name && !name) setName(user.name);
            if (user?.email && !email) setEmail(user.email);
            if (user?.phoneNumber && !phone) setPhone(user.phoneNumber);
        }
    }, [open, user]);

    if (!product) return null;

    const validateDetails = () => {
        const errs = {};
        if (!email.trim()) {
            errs.email = 'Please enter your email address.';
        } else if (!EMAIL_RX.test(email.trim())) {
            errs.email = 'Please enter a valid email address.';
        }

        if (!name.trim()) {
            errs.name = 'Please enter your full name.';
        }

        if (!phone.trim()) {
            errs.phone = 'Please enter your mobile number.';
        } else if (phone.replace(/\D/g, '').length < 10) {
            errs.phone = 'Please enter a valid 10-digit mobile number.';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleProceedToPay = async (e) => {
        e?.preventDefault();
        if (!validateDetails()) return;

        setLoading(true);
        try {
            // 1. Create checkout session for this specific product
            let token = getSessionToken();
            let sessionRes;
            try {
                sessionRes = await api.post('/checkout/sessions', {
                    productIds: [product._id],
                    email: email.trim(),
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    attribution: getAttribution(),
                });
                token = sessionRes.data.data.sessionToken;
                setSessionToken(token);
            } catch (err) {
                // If token exists, try patching current session
                sessionRes = await api.patch('/checkout/sessions/current', {
                    productIds: [product._id],
                    email: email.trim(),
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                });
            }

            // 2. Create the order with manual_upi
            const orderRes = await api.post('/checkout/create-order', {
                email: email.trim(),
                customerName: name.trim(),
                customerPhone: phone.trim(),
                paymentMethod: 'manual_upi',
                termsAccepted: true,
                marketingConsent: false,
            });

            const createdOrder = orderRes.data.data;
            rememberOrderToken(createdOrder.orderNumber, getSessionToken());
            savePendingOrder(createdOrder);
            setOrder(createdOrder);
            setStep('qr');
            toast.success('Order created! Please scan the QR code to pay.');
        } catch (err) {
            toast.error(errorMessage(err) || 'Unable to start payment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitUtr = async (e) => {
        e?.preventDefault();
        if (!utr.trim()) {
            toast.error('Please enter the 12-digit UTR / Reference number from your payment app.');
            return;
        }

        setSubmittingUtr(true);
        try {
            await api.post(`/checkout/order-status/${order.orderNumber}/submit-utr`, { utr: utr.trim() });
            toast.success('UTR submitted successfully! Taking you to your eBook download page...');
            clearPendingOrder(order.orderNumber);
            onClose?.();
            navigate(`/order/${order.orderNumber}`, { replace: true });
        } catch (err) {
            toast.error(errorMessage(err) || 'Failed to submit UTR. Please check and try again.');
        } finally {
            setSubmittingUtr(false);
        }
    };

    const handleFinishLater = () => {
        if (order?.orderNumber) {
            clearPendingOrder(order.orderNumber);
            onClose?.();
            navigate(`/order/${order.orderNumber}`);
        } else {
            onClose?.();
        }
    };

    const formattedPrice = money(product.finalPrice, product.currency);
    const originalPrice = product.originalPrice && product.originalPrice > product.finalPrice ? money(product.originalPrice, product.currency) : null;
    const discountPercent = product.originalPrice && product.originalPrice > product.finalPrice ? Math.round(((product.originalPrice - product.finalPrice) / product.originalPrice) * 100) : null;

    return (
        <Modal
            open={open}
            onClose={step === 'qr' ? handleFinishLater : onClose}
            title={step === 'details' ? '⚡ Instant Buy' : `Scan & Pay · Order ${order?.orderNumber}`}
            size="md"
        >
            {step === 'details' ? (
                <div className="space-y-4">
                    {/* Product Summary Card */}
                    <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface/70 p-3 shadow-xs">
                        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md shadow-xs ring-1 ring-line">
                            {product.coverImage?.url ? (
                                <img src={product.coverImage.url} alt={product.title} className="h-full w-full object-cover" />
                            ) : (
                                <BookCover title={product.title} className="h-full w-full" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="inline-block text-[11px] font-semibold tracking-wider text-brand uppercase">
                                PDF eBook · Instant Download
                            </span>
                            <h4 className="truncate text-sm font-bold text-ink" title={product.title}>
                                {product.title}
                            </h4>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-base font-extrabold text-brand">{formattedPrice}</span>
                                {originalPrice && (
                                    <span className="text-xs text-muted line-through">{originalPrice}</span>
                                )}
                                {discountPercent && (
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                                        {discountPercent}% OFF
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Customer Details Form */}
                    <form onSubmit={handleProceedToPay} className="space-y-3 pt-1">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none">
                                    <User className="h-4 w-4" />
                                </span>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                                    }}
                                    className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/30 transition ${
                                        errors.name ? 'border-red-400 ring-1 ring-red-400' : 'border-line hover:border-ink-soft/40 focus:border-brand'
                                    }`}
                                />
                            </div>
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none">
                                    <Mail className="h-4 w-4" />
                                </span>
                                <input
                                    type="email"
                                    required
                                    placeholder="your-email@example.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                                    }}
                                    className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/30 transition ${
                                        errors.email ? 'border-red-400 ring-1 ring-red-400' : 'border-line hover:border-ink-soft/40 focus:border-brand'
                                    }`}
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-muted">Your eBook download link & invoice will be sent here.</p>
                            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                                Mobile / WhatsApp Number <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted pointer-events-none">
                                    <Phone className="h-4 w-4" />
                                </span>
                                <input
                                    type="tel"
                                    required
                                    placeholder="e.g. 9876543210"
                                    value={phone}
                                    onChange={(e) => {
                                        setPhone(e.target.value);
                                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                                    }}
                                    className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/30 transition ${
                                        errors.phone ? 'border-red-400 ring-1 ring-red-400' : 'border-line hover:border-ink-soft/40 focus:border-brand'
                                    }`}
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-muted">For instant order delivery notifications.</p>
                            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                        </div>

                        {/* Pay Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-brand to-emerald-700 py-3.5 px-4 font-bold text-white shadow-md hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer text-base"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Generating QR Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-5 w-5 text-yellow-300 fill-yellow-300" />
                                        <span>Pay {formattedPrice} · Show QR Code</span>
                                        <ArrowRight className="h-4 w-4 ml-1" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Trust badges */}
                    <div className="pt-2 border-t border-line/60">
                        <ul className="grid grid-cols-2 gap-2 text-[11px] text-muted">
                            <li className="flex items-center gap-1.5 font-medium text-ink-soft">
                                <Zap className="h-3.5 w-3.5 text-brand shrink-0" /> Instant PDF download
                            </li>
                            <li className="flex items-center gap-1.5 font-medium text-ink-soft">
                                <Lock className="h-3.5 w-3.5 text-brand shrink-0" /> Direct UPI transfer
                            </li>
                            <li className="flex items-center gap-1.5 font-medium text-ink-soft">
                                <ShieldCheck className="h-3.5 w-3.5 text-brand shrink-0" /> Zero processing fee
                            </li>
                            <li className="flex items-center gap-1.5 font-medium text-ink-soft">
                                <Check className="h-3.5 w-3.5 text-brand shrink-0" /> 100% Genuine eBook
                            </li>
                        </ul>
                    </div>
                </div>
            ) : (
                /* STEP 2: QR CODE & PAYMENT */
                <div className="space-y-4 text-center">
                    {/* Amount Banner */}
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-2.5">
                        <span className="text-xs font-semibold text-emerald-800">Total Amount to Pay</span>
                        <div className="text-2xl font-black text-emerald-700">
                            {money(order?.amount || product.finalPrice, order?.currency || product.currency)}
                        </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="relative mx-auto flex flex-col items-center">
                        <div className="relative rounded-2xl border-2 border-line/80 bg-white p-3 shadow-md">
                            <img
                                src={
                                    order?.manualUpi?.qrCodeUrl ||
                                    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(
                                        order?.manualUpi?.upiUri || ''
                                    )}`
                                }
                                alt="UPI QR Code"
                                className="h-48 w-48 rounded-xl object-contain"
                            />
                            <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-brand">
                                <Zap className="h-3 w-3" /> Scan & Pay Instantly
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-muted max-w-xs">
                            Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app
                        </p>
                    </div>

                    {/* Tap to pay via UPI Intent on Mobile */}
                    {order?.manualUpi?.upiUri && (
                        <div className="space-y-1 sm:hidden">
                            <a
                                href={order.manualUpi.upiUri}
                                onClick={(e) => {
                                    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
                                    const isDesktopPlatform = /Win32|Win64|Windows|MacIntel|Macintosh|Linux x86/i.test(navigator.platform || '');
                                    if (!isMobile || isDesktopPlatform) {
                                        e.preventDefault();
                                        toast('UPI "Tap to Pay" requires an actual mobile phone with UPI apps (GPay / PhonePe / Paytm). On PC or DevTools, please scan the QR code above or copy the UPI ID below.', {
                                            icon: '📱',
                                            duration: 5500,
                                        });
                                    }
                                }}
                                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3.5 px-4 font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.98] transition w-full"
                            >
                                <Smartphone className="h-5 w-5" />
                                <span>Tap to Pay in UPI App (GPay / PhonePe)</span>
                            </a>
                            <p className="text-[11px] text-muted text-center">
                                Tap to open Google Pay, PhonePe, or Paytm directly on your phone
                            </p>
                        </div>
                    )}

                    {/* Copy UPI ID Box */}
                    <div className="rounded-xl border border-line bg-surface p-3 text-left text-sm space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted font-medium">UPI ID / VPA:</span>
                            <button
                                type="button"
                                onClick={() => {
                                    if (order?.manualUpi?.upiId) {
                                        navigator.clipboard.writeText(order.manualUpi.upiId);
                                        setCopied(true);
                                        toast.success('UPI ID copied to clipboard!');
                                        setTimeout(() => setCopied(false), 2000);
                                    }
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer"
                            >
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Copied!' : 'Copy UPI ID'}
                            </button>
                        </div>
                        <p className="font-mono text-sm font-bold text-ink select-all">{order?.manualUpi?.upiId}</p>
                        <p className="text-[11px] text-muted">
                            Payee: <strong className="text-ink">{order?.manualUpi?.payeeName}</strong>
                        </p>
                    </div>

                    {/* UTR Submission Form */}
                    <form onSubmit={handleSubmitUtr} className="border-t border-line pt-3 text-left space-y-2.5">
                        <label className="block text-xs font-bold text-ink">
                            Enter 12-digit UPI Reference / UTR Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                maxLength={24}
                                placeholder="e.g. 428901234567"
                                value={utr}
                                onChange={(e) => setUtr(e.target.value.replace(/\s+/g, ''))}
                                autoFocus
                                className="w-full rounded-xl border border-line bg-white py-2.5 px-3 text-sm font-mono tracking-wider text-ink placeholder:font-sans placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                            />
                        </div>
                        <p className="text-[11px] text-muted">
                            Found in your Google Pay / PhonePe / Paytm payment receipt after completing the transaction.
                        </p>

                        <button
                            type="submit"
                            disabled={submittingUtr || !utr.trim()}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover py-3 px-4 font-bold text-white text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                        >
                            {submittingUtr ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Verifying Payment...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>Submit UTR & Download eBook</span>
                                </>
                            )}
                        </button>

                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={handleFinishLater}
                                className="text-xs text-muted hover:text-ink underline cursor-pointer"
                            >
                                I will submit UTR later on the order page →
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Modal>
    );
}
