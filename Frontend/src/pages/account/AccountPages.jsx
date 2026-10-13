import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpen, Download, Library, MailPlus, Receipt, Star } from 'lucide-react';
import { Alert, Badge, BookCover, Button, EmptyState, Input, Modal, PageLoader, Pagination, Select, StatusBadge, Textarea, Toggle } from '../../components/ui';
import { NotificationPrompt } from '../../components/layout/Extras';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { get, patch, post, errorMessage } from '../../lib/api';
import { date, dateTime, money } from '../../lib/format';
import { disablePush, pushState } from '../../lib/notifications';

const useLoad = (fn, deps) => {
    const [state, setState] = useState({ loading: true });
    const load = useCallback(() => {
        setState((s) => ({ ...s, loading: true }));
        return fn()
            .then((data) => setState({ data }))
            .catch((err) => setState({ error: errorMessage(err) }));
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        load();
    }, [load]);
    return { ...state, reload: load };
};

function Overview() {
    const { data, error, loading } = useLoad(() => get('/users/me'), []);
    if (loading) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <Link to="/account/library" className="card flex items-center gap-4 p-5 no-underline hover:border-accent">
                    <Library className="h-8 w-8 text-brand" />
                    <div>
                        <p className="text-2xl font-bold text-ink">{data.stats.library}</p>
                        <p className="text-sm text-muted">eBooks in your library</p>
                    </div>
                </Link>
                <Link to="/account/orders" className="card flex items-center gap-4 p-5 no-underline hover:border-accent">
                    <Receipt className="h-8 w-8 text-accent" />
                    <div>
                        <p className="text-2xl font-bold text-ink">{data.stats.orders}</p>
                        <p className="text-sm text-muted">Completed orders</p>
                    </div>
                </Link>
            </div>
            <ClaimPurchase />
            <NotificationPrompt compact />
        </div>
    );
}

function ClaimPurchase() {
    const { user } = useAuth();
    const [orderNumber, setOrderNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const r = await post('/users/me/claim-purchase', { orderNumber });
            toast.success(r.message);
            setOrderNumber('');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="card p-5">
            <h2 className="font-semibold">Bought as a guest?</h2>
            <p className="mt-1 text-sm text-muted">
                Purchases made with <strong>{user.email}</strong> are added automatically once your email is confirmed. You can also add one by order number.
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
                <Input className="flex-1" label="Order number" placeholder="OP-XXXXXXXX" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} error={error} />
                <Button type="submit" variant="outline" className="sm:mt-[30px]" loading={loading} disabled={!orderNumber || !user.emailVerified}>
                    Add to library
                </Button>
            </form>
        </div>
    );
}

function LibraryPage() {
    const { config } = useConfig();
    const [params] = useSearchParams();
    const { data, error, loading, reload } = useLoad(() => get('/users/me/library'), []);
    const [busy, setBusy] = useState('');
    const [reviewing, setReviewing] = useState(null);

    const download = async (item) => {
        setBusy(`d${item.id}`);
        try {
            const r = await post(`/downloads/${item.id}`);
            window.location.href = r.data.url;
            setTimeout(reload, 2000);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy('');
        }
    };
    const regenerate = async (item) => {
        setBusy(`r${item.id}`);
        try {
            const r = await post(`/downloads/${item.id}/regenerate`);
            toast.success(r.message);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy('');
        }
    };

    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (!data.length) {
        return (
            <EmptyState icon={BookOpen} title="Your library is empty" action={<Button as={Link} to="/ebooks">Browse eBooks</Button>}>
                Purchases made with your confirmed email address appear here automatically.
            </EmptyState>
        );
    }
    return (
        <div>
            <h2 className="mb-4 text-lg font-semibold">My library</h2>
            {params.get('review') && config?.features?.reviews && <Alert tone="info" className="mb-4">Choose an eBook below and select “Write a review”. Honest feedback helps other readers.</Alert>}
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.map((item) => (
                    <li key={item.id} className="card flex flex-col p-4">
                        <div className="flex gap-3">
                            <div className="w-16 shrink-0"><BookCover src={item.coverImage} title={item.title} className="rounded-md" /></div>
                            <div className="min-w-0">
                                <p className="font-semibold leading-snug">{item.slug ? <Link to={`/ebooks/${item.slug}`} className="text-ink no-underline hover:text-accent">{item.title}</Link> : item.title}</p>
                                <p className="mt-0.5 text-xs text-muted">{item.format} · Version {item.purchasedVersion}</p>
                                <p className="text-xs text-muted">Purchased {date(item.grantedAt)} · {item.orderNumber}</p>
                                {item.latestVersion && item.latestVersion !== item.purchasedVersion && <Badge tone="blue" className="mt-1">Newer edition available</Badge>}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => download(item)} loading={busy === `d${item.id}`}>
                                <Download className="h-4 w-4" /> Download
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => regenerate(item)} loading={busy === `r${item.id}`} title="Email me a new download link">
                                <MailPlus className="h-4 w-4" /> Email link
                            </Button>
                            {config?.features?.reviews &&
                                (item.review ? (
                                    <span className="self-center text-xs text-muted">Review {item.review.status === 'approved' ? 'published' : item.review.status}</span>
                                ) : (
                                    <Button size="sm" variant="ghost" onClick={() => setReviewing(item)}>
                                        <Star className="h-4 w-4" /> Write a review
                                    </Button>
                                ))}
                        </div>
                    </li>
                ))}
            </ul>
            <ReviewModal item={reviewing} onClose={() => setReviewing(null)} onDone={reload} />
        </div>
    );
}

function ReviewModal({ item, onClose, onDone }) {
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const submit = async () => {
        setError('');
        if (body.trim().length < 10) return setError('Please write at least a sentence.');
        setLoading(true);
        try {
            const r = await post(`/users/me/library/${item.id}/review`, { rating, title: title || undefined, body });
            toast.success(r.message);
            onClose();
            onDone();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };
    return (
        <Modal open={Boolean(item)} onClose={onClose} title={`Review: ${item?.title || ''}`} footer={<Button onClick={submit} loading={loading}>Submit review</Button>}>
            <div className="space-y-4">
                <div>
                    <p className="label">Rating</p>
                    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
                                <Star className={`h-7 w-7 ${n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                            </button>
                        ))}
                    </div>
                </div>
                <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                <Textarea label="Your review" value={body} onChange={(e) => setBody(e.target.value)} error={error} rows={5} maxLength={3000} />
                <p className="text-xs text-muted">Reviews are checked before publishing. We publish positive and critical reviews alike.</p>
            </div>
        </Modal>
    );
}

function Orders() {
    const [page, setPage] = useState(1);
    const { data, error, loading } = useLoad(() => get('/users/me/orders', { page }), [page]);
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (!data.items.length) return <EmptyState icon={Receipt} title="No orders yet" action={<Button as={Link} to="/ebooks">Browse eBooks</Button>} />;
    return (
        <div>
            <h2 className="mb-4 text-lg font-semibold">Order history</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line">
                {data.items.map((o) => (
                    <li key={o._id}>
                        <Link to={`/account/orders/${o.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 p-4 no-underline hover:bg-surface">
                            <div className="min-w-0">
                                <p className="font-semibold text-ink">{o.orderNumber}</p>
                                <p className="truncate text-sm text-muted">{o.items.map((i) => i.title).join(', ')}</p>
                                <p className="text-xs text-muted">{dateTime(o.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={o.status} />
                                <span className="font-semibold text-ink">{money(o.total, o.currency)}</span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
            <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />
        </div>
    );
}

const REFUND_REASONS = [
    { value: 'inaccessible_file', label: 'I cannot open or access the file' },
    { value: 'defective_file', label: 'The file is damaged or incomplete' },
    { value: 'duplicate_charge', label: 'I was charged more than once' },
    { value: 'not_as_described', label: 'The product is not as described' },
    { value: 'other', label: 'Other' },
];

function OrderDetail() {
    const { orderNumber } = useParams();
    const { data, error, loading, reload } = useLoad(() => get(`/users/me/orders/${orderNumber}`), [orderNumber]);
    const [refundOpen, setRefundOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [category, setCategory] = useState('inaccessible_file');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const { order, refunds } = data;
    const openRefund = refunds.find((r) => ['requested', 'under_review', 'approved', 'processing'].includes(r.status));
    const canRequest = ['paid', 'partially_refunded'].includes(order.status) && !openRefund;

    const submitRefund = async () => {
        setFormError('');
        if (reason.trim().length < 10) return setFormError('Please describe the issue in at least a sentence.');
        setSubmitting(true);
        try {
            const r = await post(`/users/me/orders/${order.orderNumber}/refund-request`, { reason, category });
            toast.success(r.message);
            setRefundOpen(false);
            reload();
        } catch (err) {
            setFormError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Link to="/account/orders" className="text-sm">← All orders</Link>
                    <h2 className="mt-1 text-xl font-bold">Order {order.orderNumber}</h2>
                    <p className="text-sm text-muted">Placed {dateTime(order.createdAt)}{order.paidAt && ` · Paid ${dateTime(order.paidAt)}`}</p>
                </div>
                <div className="flex gap-2">
                    <StatusBadge status={order.status} />
                    {order.refundStatus !== 'none' && <Badge tone="yellow">Refund: {order.refundStatus}</Badge>}
                </div>
            </div>
            <div className="card p-5">
                <ul className="divide-y divide-line">
                    {order.items.map((i) => (
                        <li key={String(i.product)} className="flex items-center gap-3 py-3">
                            <div className="w-12 shrink-0"><BookCover src={i.coverImage} title={i.title} className="rounded-md" /></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">{i.title}</p>
                                {i.discount > 0 && <p className="text-xs text-brand">Saved {money(i.discount, order.currency)}</p>}
                            </div>
                            <p className="text-sm font-semibold">{money(i.total, order.currency)}</p>
                        </li>
                    ))}
                </ul>
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(order.subtotal, order.currency)}</dd></div>
                    {order.discountTotal > 0 && <div className="flex justify-between text-brand"><dt>Discount{order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt><dd>-{money(order.discountTotal, order.currency)}</dd></div>}
                    {order.tax?.amount > 0 && <div className="flex justify-between text-muted"><dt>{order.tax.label}{order.tax.inclusive ? ' (included)' : ''}</dt><dd>{money(order.tax.amount, order.currency)}</dd></div>}
                    <div className="flex justify-between font-bold"><dt>Total</dt><dd>{money(order.total, order.currency)}</dd></div>
                    {order.refundedAmount > 0 && <div className="flex justify-between text-muted"><dt>Refunded</dt><dd>{money(order.refundedAmount, order.currency)}</dd></div>}
                </dl>
            </div>
            {['paid', 'partially_refunded'].includes(order.status) && (
                <div className="flex flex-wrap gap-2">
                    <Button as={Link} to="/account/library"><Library className="h-4 w-4" /> Open library</Button>
                </div>
            )}
            {refunds.length > 0 && (
                <div className="card p-5">
                    <h3 className="font-semibold">Refund requests</h3>
                    <ul className="mt-3 space-y-2 text-sm">
                        {refunds.map((r) => (
                            <li key={r.refundNumber} className="flex flex-wrap items-center justify-between gap-2">
                                <span>{r.refundNumber} · {date(r.createdAt)}</span>
                                <span className="flex items-center gap-2">{r.amount ? money(r.amount, order.currency) : ''} <StatusBadge status={r.status} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {canRequest && (
                <div className="rounded-2xl bg-surface p-5 text-sm">
                    <p className="font-semibold">Problem with this order?</p>
                    <p className="mt-1 text-muted">For download issues, try <Link to="/download">requesting a new link</Link> first. Otherwise you can request a refund, reviewed under our <Link to="/refund-policy">Refund Policy</Link>.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setRefundOpen(true)}>Request a refund</Button>
                </div>
            )}
            <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Request a refund" footer={<Button onClick={submitRefund} loading={submitting}>Submit request</Button>}>
                <div className="space-y-4">
                    <Select label="Reason" options={REFUND_REASONS} value={category} onChange={(e) => setCategory(e.target.value)} />
                    <Textarea label="Tell us what happened" rows={5} value={reason} onChange={(e) => setReason(e.target.value)} error={formError} maxLength={2000} />
                    <p className="text-xs text-muted">Our team reviews every request and replies by email. Refunds are never automatic.</p>
                </div>
            </Modal>
        </div>
    );
}

function Preferences() {
    const { user, setUser } = useAuth();
    const { config } = useConfig();
    const [saving, setSaving] = useState('');
    const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
    const [pwError, setPwError] = useState('');
    const [name, setName] = useState(user.name || '');
    const push = pushState();

    const save = async (key, value) => {
        setSaving(key);
        try {
            const r = await patch('/users/me/preferences', { [key]: value });
            setUser(r.data.user);
            if (key === 'notificationsEnabled' && !value && push === 'subscribed') await disablePush().catch(() => {});
            toast.success(r.message);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setSaving('');
        }
    };
    const saveName = async (e) => {
        e.preventDefault();
        setSaving('name');
        try {
            const r = await patch('/users/me', { name });
            setUser(r.data.user);
            toast.success(r.message);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setSaving('');
        }
    };
    const changePassword = async (e) => {
        e.preventDefault();
        setPwError('');
        if (pw.newPassword.length < 10 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) return setPwError('Use at least 10 characters with a letter and a number.');
        setSaving('pw');
        try {
            const r = await post('/auth/change-password', pw);
            toast.success(r.message);
            setPw({ currentPassword: '', newPassword: '' });
        } catch (err) {
            setPwError(errorMessage(err));
        } finally {
            setSaving('');
        }
    };
    const logoutAll = async () => {
        try {
            await post('/auth/logout-all');
            setUser(null);
            toast.success('Signed out of all devices.');
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };

    return (
        <div className="space-y-6">
            <section className="card p-5">
                <h2 className="font-semibold">Profile</h2>
                <form onSubmit={saveName} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <Input className="flex-1" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                    <Button type="submit" variant="outline" className="sm:mt-[30px]" loading={saving === 'name'}>Save</Button>
                </form>
                <p className="mt-3 text-sm text-muted">Email: {user.email} {user.emailVerified ? <Badge tone="green">Confirmed</Badge> : <Badge tone="yellow">Not confirmed</Badge>}</p>
            </section>
            <section className="card space-y-5 p-5">
                <h2 className="font-semibold">Communication preferences</h2>
                <Toggle checked={user.marketingEmails} disabled={saving === 'marketingEmails'} onChange={(v) => save('marketingEmails', v)} label="Marketing emails" description="New releases and genuine offers. Receipts and download emails are always sent." />
                {config?.notifications?.enabled && (
                    <>
                        <Toggle checked={user.notificationsEnabled && push !== 'denied'} disabled={saving === 'notificationsEnabled'} onChange={(v) => save('notificationsEnabled', v)} label="Browser notifications" description={push === 'denied' ? 'Blocked in your browser settings.' : 'Allow notifications about launches and offers on your subscribed browsers.'} />
                        {push === 'not_subscribed' && <NotificationPrompt compact />}
                    </>
                )}
            </section>
            <section className="card p-5">
                <h2 className="font-semibold">Change password</h2>
                <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
                    <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
                    <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={pwError} />
                    <div className="sm:col-span-2">
                        <Button type="submit" variant="outline" loading={saving === 'pw'} disabled={!pw.currentPassword || !pw.newPassword}>Update password</Button>
                    </div>
                </form>
            </section>
            <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                    <h2 className="font-semibold">Sign out everywhere</h2>
                    <p className="text-sm text-muted">Ends your session on all devices and browsers.</p>
                </div>
                <Button variant="outline-danger" onClick={logoutAll}>Sign out of all devices</Button>
            </section>
        </div>
    );
}

function SupportRequests() {
    const { data, error, loading } = useLoad(() => get('/users/me/support'), []);
    if (loading) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Support requests</h2>
                <Button as={Link} to="/support" size="sm">New request</Button>
            </div>
            {!data.length ? (
                <EmptyState title="No support requests">Need help? <Link to="/support">Contact us</Link>.</EmptyState>
            ) : (
                <ul className="space-y-3">
                    {data.map((t) => (
                        <li key={t.ticketNumber} className="card p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold">{t.subject || t.category} <span className="text-sm font-normal text-muted">· {t.ticketNumber}</span></p>
                                <StatusBadge status={t.status} />
                            </div>
                            <ul className="mt-3 space-y-2">
                                {t.replies.map((r, i) => (
                                    <li key={i} className={`rounded-lg p-3 text-sm ${r.from === 'admin' ? 'bg-accent-pale' : 'bg-surface'}`}>
                                        <p className="text-xs text-muted">{r.from === 'admin' ? 'OpenPage support' : 'You'} · {dateTime(r.at)}</p>
                                        <p className="mt-1 whitespace-pre-line">{r.message}</p>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function AccountPages({ page }) {
    if (page === 'library') return <LibraryPage />;
    if (page === 'orders') return <Orders />;
    if (page === 'order') return <OrderDetail />;
    if (page === 'preferences') return <Preferences />;
    if (page === 'support') return <SupportRequests />;
    return <Overview />;
}
