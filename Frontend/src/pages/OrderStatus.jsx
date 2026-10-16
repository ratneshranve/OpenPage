import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, CheckCircle2, Clock, Copy, Library, Mail, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo from '../components/layout/Seo';
import { Alert, BookCover, Button, Input, PageLoader } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import { fetchOrderStatus, markTracked, clearPendingOrder } from '../lib/checkout';
import { api, errorMessage } from '../lib/api';
import { money, dateTime } from '../lib/format';
import { trackPurchase } from '../lib/tracking';
import { NotificationPrompt } from '../components/layout/Extras';

/**
 * Success / pending / failure page. The status shown always comes from the backend.
 * Supports automated Razorpay payments and Direct UPI verification.
 */
export default function OrderStatus() {
    const { orderNumber } = useParams();
    const { config } = useConfig();
    const [order, setOrder] = useState(null);
    const [error, setError] = useState('');
    const [polls, setPolls] = useState(0);
    const [utrInput, setUtrInput] = useState('');
    const [submittingUtr, setSubmittingUtr] = useState(false);
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);

    const load = useCallback(async () => {
        try {
            const o = await fetchOrderStatus(orderNumber);
            setOrder(o);
            setError('');
            if (o.trackPurchase) {
                trackPurchase(o);
                markTracked(o.orderNumber);
            }
            return o;
        } catch (err) {
            setError(err.response?.status === 404 ? 'We could not find this order in this browser. If you paid, check your email for the confirmation, or sign in to see your orders.' : errorMessage(err));
            return null;
        }
    }, [orderNumber]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (order && (order.status === 'paid' || order.status === 'partially_refunded')) {
            clearPendingOrder(order.orderNumber);
        }
    }, [order]);

    // Poll while payment or delivery is still in progress.
    useEffect(() => {
        if (!order) return undefined;
        const waiting = order.status === 'pending' || (order.status === 'paid' && order.deliveryStatus !== 'sent');
        if (!waiting || polls > 40) return undefined;
        timer.current = setTimeout(async () => {
            await load();
            setPolls((p) => p + 1);
        }, polls < 10 ? 3000 : 8000);
        return () => clearTimeout(timer.current);
    }, [order, polls, load]);

    if (!order && !error) return <PageLoader label="Checking your order…" />;
    if (error && !order) {
        return (
            <div className="container-page py-14">
                <Seo title="Order status" noindex />
                <Alert tone="info" title="Order not found" action={<div className="flex flex-wrap gap-2"><Button as={Link} to="/login" size="sm">Sign in</Button><Button as={Link} to="/download" size="sm" variant="outline">Request download link</Button></div>}>
                    {error}
                </Alert>
            </div>
        );
    }

    const paid = order.status === 'paid' || order.status === 'partially_refunded';
    const failed = order.status === 'failed' || order.status === 'cancelled';
    const pending = order.status === 'pending';
    const supportEmail = config?.general?.supportEmail;

    return (
        <div className="container-page max-w-3xl py-12">
            <Seo title={paid ? 'Order confirmed' : 'Order status'} noindex />
            <div className="card p-6 sm:p-8">
                {paid && (
                    <div className="text-center">
                        <CheckCircle2 className="mx-auto h-14 w-14 text-brand" aria-hidden />
                        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Thank you! Your payment is confirmed.</h1>
                        <p className="mt-2 text-muted">Order <strong className="text-ink">{order.orderNumber}</strong> · {dateTime(order.paidAt)}</p>
                    </div>
                )}
                {pending && order.paymentMethod === 'manual_upi' && (
                    <div className="space-y-6">
                        {order.manualPayment?.utr ? (
                            <div className="text-center">
                                <Clock className="mx-auto h-14 w-14 animate-pulse text-accent" aria-hidden />
                                <h1 className="mt-3 text-2xl font-bold">UPI Payment Verification in Progress</h1>
                                <p className="mt-2 text-muted">
                                    We received your payment reference: <strong className="font-mono text-ink text-base">{order.manualPayment.utr}</strong>
                                </p>
                                <div className="my-6 rounded-xl border border-line bg-surface/60 p-5 text-left text-sm space-y-2.5">
                                    <p className="font-semibold text-ink">What happens next?</p>
                                    <p className="text-muted leading-relaxed">
                                        1. We verify your UPI transaction with our bank account. This typically takes <strong>5 to 15 minutes</strong> during business hours.
                                    </p>
                                    <p className="text-muted leading-relaxed">
                                        2. Once approved, this page will instantly update to <strong>Confirmed</strong> with your eBook download button.
                                    </p>
                                    <p className="text-muted leading-relaxed">
                                        3. A direct secure download link is also emailed automatically to <strong className="text-ink">{order.email}</strong>.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-3">
                                    <Button variant="outline" size="sm" onClick={load}>
                                        <RefreshCw className="h-4 w-4" /> Check again
                                    </Button>
                                    <Button as="a" href={`https://wa.me/919770133148?text=Hi%20OpenPage,%20I%20have%20paid%20for%20order%20${order.orderNumber}%20with%20UTR%20${order.manualPayment.utr}`} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
                                        WhatsApp support (+91 9770133148)
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-4">
                                <Clock className="mx-auto h-12 w-12 text-accent" aria-hidden />
                                <h1 className="text-2xl font-bold">Complete your UPI Payment</h1>
                                <p className="text-sm text-muted">Scan the QR code or pay to the UPI ID below, then enter your 12-digit UTR reference number.</p>

                                <div>
                                    <img
                                        src={order.manualUpi?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(order.manualUpi?.upiUri || '')}`}
                                        alt="UPI QR Code"
                                        className="mx-auto h-48 w-48 rounded-xl border border-line bg-white p-2 shadow-sm"
                                    />
                                    <p className="mt-2 text-xs text-muted">Amount: <strong>{money(order.total, order.currency)}</strong></p>
                                </div>

                                <div className="max-w-md mx-auto rounded-xl border border-line bg-surface p-3 text-left text-sm space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted font-medium">UPI ID / VPA:</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(order.manualUpi?.upiId || '');
                                                setCopied(true);
                                                toast.success('UPI ID copied!');
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                        >
                                            {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                                            {copied ? 'Copied' : 'Copy UPI ID'}
                                        </Button>
                                    </div>
                                    <p className="font-mono text-sm font-bold text-ink">{order.manualUpi?.upiId}</p>
                                    <p className="text-xs text-muted">Payee: <strong className="text-ink">{order.manualUpi?.payeeName}</strong></p>
                                </div>

                                {order.manualUpi?.upiUri && (
                                    <div className="max-w-md mx-auto sm:hidden">
                                        <a
                                            href={order.manualUpi.upiUri}
                                            onClick={(e) => {
                                                const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
                                                const isDesktopPlatform = /Win32|Win64|Windows|MacIntel|Macintosh|Linux x86/i.test(navigator.platform || '');
                                                if (!isMobile || isDesktopPlatform) {
                                                    e.preventDefault();
                                                    toast('UPI "Open in UPI App" requires an actual mobile phone with UPI apps (GPay / PhonePe / Paytm). On PC or DevTools, please scan the QR code above or copy the UPI ID.', {
                                                        icon: '📱',
                                                        duration: 5500,
                                                    });
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 rounded-lg bg-brand text-white py-3 px-4 font-semibold text-sm w-full shadow-sm"
                                        >
                                            <Smartphone className="h-4 w-4" /> Open in UPI App (GPay / PhonePe)
                                        </a>
                                    </div>
                                )}

                                <div className="max-w-md mx-auto border-t border-line pt-4 text-left space-y-3">
                                    <Input
                                        label="Enter 12-digit UPI Reference / UTR Number"
                                        placeholder="e.g. 428901234567"
                                        value={utrInput}
                                        onChange={(e) => setUtrInput(e.target.value.replace(/\s+/g, ''))}
                                        hint="Found in your Google Pay, PhonePe, or Paytm receipt after paying."
                                    />
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        loading={submittingUtr}
                                        disabled={!utrInput.trim()}
                                        onClick={async () => {
                                            setSubmittingUtr(true);
                                            try {
                                                await api.post(`/checkout/order-status/${order.orderNumber}/submit-utr`, { utr: utrInput.trim() });
                                                toast.success('Payment reference submitted!');
                                                await load();
                                            } catch (err) {
                                                toast.error(errorMessage(err));
                                            } finally {
                                                setSubmittingUtr(false);
                                            }
                                        }}
                                    >
                                        Submit UTR Reference
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {pending && order.paymentMethod !== 'manual_upi' && (
                    <div className="text-center">
                        <Clock className="mx-auto h-14 w-14 animate-pulse text-accent" aria-hidden />
                        <h1 className="mt-3 text-2xl font-bold">Payment is being confirmed</h1>
                        <p className="mt-2 text-muted">
                            {order.paymentStatus === 'created'
                                ? 'We have not received a payment for this order yet. If you completed payment, it can take a minute to confirm.'
                                : 'We are waiting for final confirmation from the payment provider. This usually takes less than a minute. Please do not pay again.'}
                        </p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={load}>
                            <RefreshCw className="h-4 w-4" /> Check again
                        </Button>
                    </div>
                )}
                {failed && (
                    <div className="text-center">
                        <XCircle className="mx-auto h-14 w-14 text-danger" aria-hidden />
                        <h1 className="mt-3 text-2xl font-bold">{order.status === 'cancelled' ? 'This order was not completed' : 'Payment not completed'}</h1>
                        <p className="mt-2 text-muted">{order.failureReason || 'No payment was confirmed for this order.'} If any amount was debited, it is normally reversed automatically by your bank.</p>
                        <div className="mt-4 flex justify-center gap-2">
                            <Button as={Link} to="/cart">Return to cart</Button>
                            <Button as={Link} to="/support" variant="outline">Contact support</Button>
                        </div>
                    </div>
                )}
                {order.status === 'refunded' && (
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">This order has been refunded</h1>
                        <p className="mt-2 text-muted">Order {order.orderNumber}</p>
                    </div>
                )}

                {paid && (
                    <div className="mt-6">
                        {order.deliveryStatus === 'sent' ? (
                            <Alert tone="success" title="Download email sent">
                                Your download links have been sent to <strong>{order.email}</strong>. They are time-limited for security; you can request fresh links at any time.
                            </Alert>
                        ) : order.deliveryStatus === 'failed' ? (
                            <Alert tone="warning" title="We are having trouble sending your email">
                                Your purchase is safe. {order.hasAccount ? 'You can download it from your library now, or ' : ''}use the <Link to="/download">download page</Link> to request a new link, or contact {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : 'support'}.
                            </Alert>
                        ) : (
                            <Alert tone="info" title="Your download email is being processed">
                                Delivery has been initiated to <strong>{order.email}</strong>. It usually arrives within a few minutes. Check your spam folder if you do not see it.
                            </Alert>
                        )}
                    </div>
                )}

                <ul className="mt-6 divide-y divide-line border-y border-line">
                    {order.items.map((i) => (
                        <li key={i.productId} className="flex items-center gap-3 py-3">
                            <div className="w-12 shrink-0"><BookCover src={i.coverImage} title={i.title} className="rounded-md" /></div>
                            <p className="flex-1 text-sm font-medium">{i.title}</p>
                            <p className="text-sm font-semibold">{money(i.total, order.currency)}</p>
                        </li>
                    ))}
                </ul>
                <dl className="mt-4 space-y-1 text-sm">
                    {order.discountTotal > 0 && <div className="flex justify-between text-brand"><dt>Discount</dt><dd>-{money(order.discountTotal, order.currency)}</dd></div>}
                    {order.tax?.amount > 0 && <div className="flex justify-between text-muted"><dt>{order.tax.label}{order.tax.inclusive ? ' (included)' : ''}</dt><dd>{money(order.tax.amount, order.currency)}</dd></div>}
                    <div className="flex justify-between text-base font-bold"><dt>{paid ? 'Total paid' : 'Total'}</dt><dd>{money(order.total, order.currency)} {order.currency}</dd></div>
                    <div className="flex justify-between text-muted"><dt>Email</dt><dd className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {order.email}</dd></div>
                </dl>

                {paid && (
                    <div className="mt-6 rounded-xl bg-surface p-4 text-sm leading-6 text-ink-soft">
                        <h2 className="font-semibold text-ink">How to access your eBook</h2>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                            <li>Open the email from {config?.general?.siteName || 'OpenPage'} and click <strong>Download</strong>.</li>
                            <li>Save the file to your device. PDFs open in any browser or PDF reader.</li>
                            <li>Links expire for security. Request a new one any time from the <Link to="/download">download page</Link>{order.hasAccount ? ' or your library' : ''}.</li>
                        </ol>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {order.hasAccount ? (
                                <Button as={Link} to="/account/library" size="sm"><Library className="h-4 w-4" /> Go to my library</Button>
                            ) : (
                                <Button as={Link} to={`/login?email=${encodeURIComponent(order.email)}`} size="sm" variant="secondary">Sign in to view in your library</Button>
                            )}
                            <Button as={Link} to="/support" size="sm" variant="outline">Need help?</Button>
                        </div>
                    </div>
                )}
            </div>
            {paid && <div className="mt-6"><NotificationPrompt compact /></div>}
        </div>
    );
}
