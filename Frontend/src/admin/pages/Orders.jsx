import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, MailPlus, RefreshCw, RotateCcw, StickyNote } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, Modal, PageLoader, Select, StatusBadge, Tabs, Textarea } from '../../components/ui';
import { DataTable, FilterSelect, KeyValue, MoneyInput, PageHeader, Panel, SearchInput, downloadCsv, useAction, useAdminData } from '../components/kit';
import { api } from '../../lib/api';
import { dateTime, money } from '../../lib/format';

const opts = (list, all = 'All') => [{ value: '', label: all }, ...list.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))];

function OrdersList() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const filters = Object.fromEntries(['q', 'status', 'deliveryStatus', 'refundStatus', 'from', 'to', 'page'].map((k) => [k, params.get(k) || '']));
    const set = (k, v) => {
        const next = new URLSearchParams(params);
        v ? next.set(k, v) : next.delete(k);
        if (k !== 'page') next.delete('page');
        setParams(next);
    };
    const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data, loading, error } = useAdminData('/admin/orders', query);
    return (
        <div>
            <PageHeader title="Orders" actions={<Button variant="outline" onClick={() => downloadCsv('/admin/orders/export', query, 'orders.csv')}><Download className="h-4 w-4" /> Export CSV</Button>} />
            <div className="mb-4 flex flex-wrap gap-2">
                <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Order ID, email, product, Razorpay ID" className="w-full sm:w-80" />
                <FilterSelect label="Order status" value={filters.status} onChange={(v) => set('status', v)} options={opts(['pending', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded'], 'All statuses')} />
                <FilterSelect label="Delivery" value={filters.deliveryStatus} onChange={(v) => set('deliveryStatus', v)} options={opts(['not_started', 'queued', 'sent', 'failed'], 'Any delivery')} />
                <FilterSelect label="Refund" value={filters.refundStatus} onChange={(v) => set('refundStatus', v)} options={opts(['none', 'requested', 'processing', 'partial', 'refunded', 'failed'], 'Any refund')} />
                <input type="date" aria-label="From" value={filters.from} onChange={(e) => set('from', e.target.value)} className="input h-10 w-auto text-sm" />
                <input type="date" aria-label="To" value={filters.to} onChange={(e) => set('to', e.target.value)} className="input h-10 w-auto text-sm" />
            </div>
            <DataTable
                loading={loading}
                error={error}
                rows={data?.items}
                pagination={data?.pagination}
                onPage={(p) => set('page', String(p))}
                onRowClick={(r) => navigate(`/admin/orders/${r._id}`)}
                empty="No orders match these filters."
                columns={[
                    { key: 'orderNumber', label: 'Order', render: (r) => <span className="font-medium">{r.orderNumber}</span> },
                    { key: 'email', label: 'Customer' },
                    { key: 'items', label: 'Products', className: 'max-w-xs', render: (r) => <span className="line-clamp-2">{r.items.map((i) => i.title).join(', ')}</span> },
                    { key: 'total', label: 'Total', render: (r) => <>{money(r.total, r.currency)}{r.coupon?.code && <Badge tone="green" className="ml-1">{r.coupon.code}</Badge>}</> },
                    { key: 'status', label: 'Payment', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'deliveryStatus', label: 'Delivery', render: (r) => <StatusBadge status={r.deliveryStatus} /> },
                    { key: 'refundStatus', label: 'Refund', render: (r) => (r.refundStatus === 'none' ? '—' : <StatusBadge status={r.refundStatus} />) },
                    { key: 'createdAt', label: 'Created', render: (r) => dateTime(r.createdAt) },
                ]}
            />
        </div>
    );
}

function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, loading, error, reload } = useAdminData(`/admin/orders/${id}`);
    const { busy, run } = useAction();
    const [tab, setTab] = useState('payments');
    const [note, setNote] = useState('');
    const [refundOpen, setRefundOpen] = useState(false);
    const [refund, setRefund] = useState({ reason: '', category: 'other' });
    const [revoke, setRevoke] = useState(null);

    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const { order, payments, webhooks, emails, downloads, entitlements, refunds, audit } = data;
    const paid = ['paid', 'partially_refunded'].includes(order.status);
    const act = async (key, fn) => {
        const r = await run(key, fn);
        if (r) reload();
        return r;
    };

    return (
        <div className="space-y-6">
            <PageHeader
                back={{ to: '/admin/orders', label: 'Orders' }}
                title={`Order ${order.orderNumber}`}
                description={<span className="flex flex-wrap gap-2"><StatusBadge status={order.status} /> <StatusBadge status={order.deliveryStatus} /> {order.refundStatus !== 'none' && <StatusBadge status={order.refundStatus} />}</span>}
                actions={
                    <>
                        {order.status === 'pending' || order.status === 'failed' || order.status === 'cancelled' ? (
                            <Button variant="outline" loading={busy === 'rec'} onClick={() => act('rec', () => api.post(`/admin/orders/${order._id}/reconcile`).then((x) => x.data))}><RefreshCw className="h-4 w-4" /> Reconcile with Razorpay</Button>
                        ) : null}
                        {paid && <Button variant="outline" loading={busy === 'resend'} onClick={() => act('resend', () => api.post(`/admin/orders/${order._id}/resend-delivery`).then((x) => x.data))}><MailPlus className="h-4 w-4" /> Resend delivery email</Button>}
                        {paid && <Button variant="outline-danger" onClick={() => setRefundOpen(true)}><RotateCcw className="h-4 w-4" /> Create refund request</Button>}
                    </>
                }
            />
            {order.status === 'pending' && <Alert tone="info">Orders can only become paid when Razorpay confirms a captured payment (via webhook, checkout callback or reconciliation). There is no manual “mark as paid”.</Alert>}
            <div className="grid gap-6 lg:grid-cols-3">
                <Panel title="Summary" className="lg:col-span-2">
                    <KeyValue
                        items={[
                            ['Customer email', order.email],
                            ['Account', order.user ? <Link key="u" to={`/admin/customers/${order.user._id}`}>{order.user.name || order.user.email}</Link> : 'Guest'],
                            ['Created', dateTime(order.createdAt)],
                            ['Paid at', dateTime(order.paidAt)],
                            ['Razorpay order', order.razorpay?.orderId],
                            ['Razorpay payment', order.razorpay?.paymentId],
                            ['Method', order.razorpay?.method],
                            ['Terms accepted', `${dateTime(order.termsAcceptedAt)} (v${order.termsVersion || '—'})`],
                            ['Marketing consent', order.marketingConsent ? 'Yes' : 'No'],
                            ['Source', [order.attribution?.source, order.attribution?.medium, order.attribution?.campaign].filter(Boolean).join(' / ') || '—'],
                            order.failureReason && ['Failure reason', order.failureReason],
                        ]}
                    />
                    <h3 className="mt-6 text-sm font-semibold">Line items (price snapshot at purchase)</h3>
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Product</th><th>Version</th><th className="text-right">Unit</th><th className="text-right">Discount</th><th className="text-right">Total</th></tr></thead>
                            <tbody className="divide-y divide-line">
                                {order.items.map((i) => (
                                    <tr key={String(i.product)}><td className="py-2">{i.title}</td><td>{i.fileVersion}</td><td className="text-right">{money(i.unitPrice, order.currency)}</td><td className="text-right text-brand">{i.discount ? `-${money(i.discount, order.currency)}` : '—'}</td><td className="text-right font-medium">{money(i.total, order.currency)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(order.subtotal, order.currency)}</dd></div>
                        {order.discountTotal > 0 && <div className="flex justify-between text-brand"><dt>Discounts {order.coupon?.code && `(${order.coupon.code})`}</dt><dd>-{money(order.discountTotal, order.currency)}</dd></div>}
                        {order.tax?.amount > 0 && <div className="flex justify-between text-muted"><dt>{order.tax.label}{order.tax.inclusive ? ' (incl.)' : ''}</dt><dd>{money(order.tax.amount, order.currency)}</dd></div>}
                        <div className="flex justify-between font-bold"><dt>Total</dt><dd>{money(order.total, order.currency)}</dd></div>
                        {order.refundedAmount > 0 && <div className="flex justify-between text-danger"><dt>Refunded</dt><dd>-{money(order.refundedAmount, order.currency)}</dd></div>}
                    </dl>
                </Panel>
                <Panel title="Internal notes" actions={<StickyNote className="h-4 w-4 text-muted" />}>
                    <ul className="mb-3 space-y-2 text-sm">
                        {(order.notes || []).map((n, i) => (
                            <li key={i} className="rounded-lg bg-surface p-2"><p>{n.text}</p><p className="text-xs text-muted">{n.by?.email} · {dateTime(n.at)}</p></li>
                        ))}
                        {!order.notes?.length && <li className="text-muted">No notes yet.</li>}
                    </ul>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note visible to admins only" />
                    <Button size="sm" className="mt-2" disabled={!note.trim()} loading={busy === 'note'} onClick={async () => { if (await act('note', () => api.post(`/admin/orders/${order._id}/notes`, { text: note }).then((x) => x.data))) setNote(''); }}>Add note</Button>
                </Panel>
            </div>

            <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: 'payments', label: 'Payments', count: payments.length },
                    { value: 'webhooks', label: 'Webhook events', count: webhooks.length },
                    { value: 'emails', label: 'Emails', count: emails.length },
                    { value: 'access', label: 'Access & downloads', count: entitlements.length },
                    { value: 'refunds', label: 'Refunds', count: refunds.length },
                    { value: 'audit', label: 'Audit', count: audit.length },
                ]}
            />
            {tab === 'payments' && (
                <DataTable rows={payments} empty="No payment attempts recorded." columns={[
                    { key: 'razorpayPaymentId', label: 'Payment ID', render: (r) => r.razorpayPaymentId || '(order created)' },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'amount', label: 'Amount', render: (r) => money(r.amount, r.currency) },
                    { key: 'method', label: 'Method' },
                    { key: 'verified', label: 'Verified via', render: (r) => (r.verifiedVia || []).join(', ') + (r.signatureVerified ? ' · signature ✓' : '') },
                    { key: 'fee', label: 'Gateway fee', render: (r) => (r.fee != null ? money(r.fee) : '—') },
                    { key: 'error', label: 'Error', render: (r) => r.errorDescription || '—' },
                    { key: 'updatedAt', label: 'Updated', render: (r) => dateTime(r.updatedAt) },
                ]} />
            )}
            {tab === 'webhooks' && (
                <DataTable rows={webhooks} empty="No webhook events received for this order." columns={[
                    { key: 'event', label: 'Event' },
                    { key: 'status', label: 'Processing', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'eventId', label: 'Event ID', className: 'text-xs' },
                    { key: 'error', label: 'Error' },
                    { key: 'createdAt', label: 'Received', render: (r) => dateTime(r.createdAt) },
                ]} />
            )}
            {tab === 'emails' && (
                <DataTable rows={emails} empty="No emails for this order." columns={[
                    { key: 'type', label: 'Type' },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'subject', label: 'Subject' },
                    { key: 'attempts', label: 'Attempts' },
                    { key: 'lastError', label: 'Last error' },
                    { key: 'sentAt', label: 'Sent', render: (r) => dateTime(r.sentAt) },
                ]} />
            )}
            {tab === 'access' && (
                <div className="space-y-6">
                    <DataTable rows={entitlements} empty="No access granted (order not paid)." columns={[
                        { key: 'productTitle', label: 'Product' },
                        { key: 'fileVersion', label: 'Version' },
                        { key: 'status', label: 'Access', render: (r) => <StatusBadge status={r.status} /> },
                        { key: 'downloadCount', label: 'Downloads' },
                        { key: 'lastDownloadAt', label: 'Last download', render: (r) => dateTime(r.lastDownloadAt) },
                        { key: 'act', label: '', render: (r) => (r.status === 'active' ? <Button size="sm" variant="outline-danger" onClick={() => setRevoke(r)}>Revoke</Button> : <Button size="sm" variant="outline" onClick={() => act('restore', () => api.patch(`/admin/entitlements/${r._id}`, { status: 'active' }).then((x) => x.data))}>Restore</Button>) },
                    ]} />
                    <Panel title="Download activity">
                        <DataTable rows={downloads} empty="No download attempts yet." columns={[
                            { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
                            { key: 'outcome', label: 'Outcome', render: (r) => <StatusBadge status={r.outcome === 'served' ? 'sent' : 'failed'} /> },
                            { key: 'reason', label: 'Reason' },
                            { key: 'via', label: 'Link type' },
                            { key: 'ip', label: 'IP' },
                        ]} />
                    </Panel>
                </div>
            )}
            {tab === 'refunds' && (
                <DataTable rows={refunds} onRowClick={(r) => navigate(`/admin/refunds/${r._id}`)} empty="No refund requests." columns={[
                    { key: 'refundNumber', label: 'Refund' },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'amount', label: 'Amount', render: (r) => (r.amount ? money(r.amount, order.currency) : '—') },
                    { key: 'reason', label: 'Reason', className: 'max-w-xs' },
                    { key: 'createdAt', label: 'Requested', render: (r) => dateTime(r.createdAt) },
                ]} />
            )}
            {tab === 'audit' && (
                <DataTable rows={audit} empty="No admin actions recorded." columns={[
                    { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
                    { key: 'action', label: 'Action' },
                    { key: 'actorEmail', label: 'By' },
                    { key: 'outcome', label: 'Outcome', render: (r) => <StatusBadge status={r.outcome === 'success' ? 'done' : 'failed'} /> },
                ]} />
            )}

            <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Create refund request" footer={<Button loading={busy === 'refund'} onClick={async () => { const r = await act('refund', () => api.post(`/admin/orders/${order._id}/refunds`, refund).then((x) => x.data)); if (r) { setRefundOpen(false); navigate(`/admin/refunds/${r.data._id}`); } }}>Create request</Button>}>
                <div className="space-y-4">
                    <Alert tone="info">This only records a request. No money moves until you approve it and explicitly initiate the refund.</Alert>
                    <Select label="Category" value={refund.category} onChange={(e) => setRefund({ ...refund, category: e.target.value })} options={['inaccessible_file', 'defective_file', 'duplicate_charge', 'not_as_described', 'other'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} />
                    <Textarea label="Reason" rows={4} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
                </div>
            </Modal>
            <ConfirmDialog open={Boolean(revoke)} title="Revoke access?" message={`The customer will no longer be able to download "${revoke?.productTitle}". Existing links stop working immediately.`} confirmLabel="Revoke access" tone="danger" loading={busy === 'revoke'} onClose={() => setRevoke(null)} onConfirm={async () => { await act('revoke', () => api.patch(`/admin/entitlements/${revoke._id}`, { status: 'revoked', reason: 'Revoked by admin' }).then((x) => x.data)); setRevoke(null); }} />
        </div>
    );
}

function Payments() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('payments');
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const payments = useAdminData(tab === 'payments' ? '/admin/payments' : null, { q: q || undefined, status: status || undefined, page }, { skip: tab !== 'payments' });
    const hooks = useAdminData(tab === 'webhooks' ? '/admin/payments/webhooks' : null, { status: status || undefined, page }, { skip: tab !== 'webhooks' });
    return (
        <div>
            <PageHeader title="Payments" description="Every Razorpay payment attempt and webhook event. Use an order's Reconcile action to resolve discrepancies." />
            <Tabs value={tab} onChange={(t) => { setTab(t); setStatus(''); setPage(1); }} tabs={[{ value: 'payments', label: 'Payments' }, { value: 'webhooks', label: 'Webhook events' }]} />
            <div className="my-4 flex flex-wrap gap-2">
                {tab === 'payments' && <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Payment ID, order ID, email" className="w-full sm:w-80" />}
                <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={tab === 'payments' ? opts(['created', 'authorized', 'captured', 'failed', 'refunded']) : opts(['received', 'processing', 'processed', 'ignored', 'failed'])} />
            </div>
            {tab === 'payments' ? (
                <DataTable loading={payments.loading} error={payments.error} rows={payments.data?.items} pagination={payments.data?.pagination} onPage={setPage} onRowClick={(r) => r.order && navigate(`/admin/orders/${r.order._id}`)} columns={[
                    { key: 'order', label: 'Order', render: (r) => r.order?.orderNumber },
                    { key: 'razorpayOrderId', label: 'Razorpay order', className: 'text-xs' },
                    { key: 'razorpayPaymentId', label: 'Payment ID', className: 'text-xs', render: (r) => r.razorpayPaymentId || '—' },
                    { key: 'amount', label: 'Amount', render: (r) => money(r.amount, r.currency) },
                    { key: 'status', label: 'State', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'verified', label: 'Verified', render: (r) => (r.verifiedVia?.length ? r.verifiedVia.join(', ') : 'No') },
                    { key: 'delivery', label: 'Delivery', render: (r) => (r.order ? <StatusBadge status={r.order.deliveryStatus} /> : '—') },
                    { key: 'error', label: 'Failure', render: (r) => r.errorDescription || '—' },
                    { key: 'createdAt', label: 'Created', render: (r) => dateTime(r.createdAt) },
                ]} />
            ) : (
                <DataTable loading={hooks.loading} error={hooks.error} rows={hooks.data?.items} pagination={hooks.data?.pagination} onPage={setPage} onRowClick={(r) => r.order && navigate(`/admin/orders/${r.order._id}`)} columns={[
                    { key: 'event', label: 'Event' },
                    { key: 'status', label: 'Processing', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'order', label: 'Order', render: (r) => r.order?.orderNumber || '—' },
                    { key: 'razorpayPaymentId', label: 'Payment', className: 'text-xs' },
                    { key: 'attempts', label: 'Attempts' },
                    { key: 'error', label: 'Error', className: 'max-w-xs' },
                    { key: 'createdAt', label: 'Received', render: (r) => dateTime(r.createdAt) },
                ]} />
            )}
        </div>
    );
}

function Refunds() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const { data, loading, error } = useAdminData('/admin/refunds', { status: status || undefined, page });
    return (
        <div>
            <PageHeader title="Manual refunds" description="There is no automatic refund system. Every refund is reviewed and explicitly initiated by an administrator." />
            <div className="mb-4"><FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={opts(['requested', 'under_review', 'approved', 'rejected', 'processing', 'processed', 'failed'])} /></div>
            <DataTable loading={loading} error={error} rows={data?.items} pagination={data?.pagination} onPage={setPage} onRowClick={(r) => navigate(`/admin/refunds/${r._id}`)} empty="No refund requests." columns={[
                { key: 'refundNumber', label: 'Refund' },
                { key: 'order', label: 'Order', render: (r) => r.order?.orderNumber },
                { key: 'email', label: 'Customer' },
                { key: 'category', label: 'Reason', render: (r) => r.category.replace(/_/g, ' ') },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'amount', label: 'Amount', render: (r) => (r.amount ? money(r.amount) : '—') },
                { key: 'source', label: 'Source' },
                { key: 'createdAt', label: 'Requested', render: (r) => dateTime(r.createdAt) },
            ]} />
        </div>
    );
}

function RefundDetail() {
    const { id } = useParams();
    const { data, loading, error, reload } = useAdminData(`/admin/refunds/${id}`);
    const { busy, run } = useAction();
    const [decision, setDecision] = useState(null);
    const [form, setForm] = useState({ decisionReason: '', eligibilityNotes: '', amount: null, revokeAccess: true, notifyCustomer: true });
    const [confirmInitiate, setConfirmInitiate] = useState(false);
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const { refund, payment, downloads } = data;
    const order = refund.order;
    const remaining = order.total - (order.refundedAmount || 0);
    const open = (d) => {
        setForm({ decisionReason: '', eligibilityNotes: refund.eligibilityNotes || '', amount: refund.amount || remaining, revokeAccess: true, notifyCustomer: true });
        setDecision(d);
    };
    const decide = async () => {
        const r = await run('decide', () => api.post(`/admin/refunds/${refund._id}/decision`, { decision, ...form, amount: decision === 'approved' ? form.amount : undefined }).then((x) => x.data));
        if (r) {
            setDecision(null);
            reload();
        }
    };
    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/refunds', label: 'Manual refunds' }} title={`Refund ${refund.refundNumber}`} description={<StatusBadge status={refund.status} />}
                actions={
                    <>
                        {['requested', 'failed'].includes(refund.status) && <Button variant="outline" onClick={() => open('under_review')}>Mark under review</Button>}
                        {['requested', 'under_review', 'failed'].includes(refund.status) && <Button variant="outline-danger" onClick={() => open('rejected')}>Reject</Button>}
                        {['requested', 'under_review', 'failed'].includes(refund.status) && <Button variant="secondary" onClick={() => open('approved')}>Approve</Button>}
                        {refund.status === 'approved' && <Button variant="danger" onClick={() => setConfirmInitiate(true)}><RotateCcw className="h-4 w-4" /> Initiate refund with Razorpay</Button>}
                        {refund.status === 'processing' && <Button variant="outline" loading={busy === 'sync'} onClick={async () => { if (await run('sync', () => api.post(`/admin/refunds/${refund._id}/sync`).then((x) => x.data))) reload(); }}><RefreshCw className="h-4 w-4" /> Check gateway status</Button>}
                    </>
                }
            />
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Request">
                    <KeyValue items={[
                        ['Customer', refund.email],
                        ['Category', refund.category.replace(/_/g, ' ')],
                        ['Source', refund.source],
                        ['Requested', dateTime(refund.createdAt)],
                        ['Refund amount', refund.amount ? money(refund.amount, order.currency) : 'Not set'],
                        ['Revoke access on refund', refund.revokeAccess ? 'Yes' : 'No'],
                        ['Gateway refund', refund.razorpayRefundId],
                        ['Gateway status', refund.gatewayStatus],
                        ['Decided by', refund.decidedBy?.email],
                        ['Customer notified', dateTime(refund.customerNotifiedAt)],
                    ]} />
                    <p className="mt-4 text-sm font-medium">Customer message</p>
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-surface p-3 text-sm">{refund.reason || '—'}</p>
                    {refund.eligibilityNotes && <><p className="mt-4 text-sm font-medium">Eligibility notes</p><p className="mt-1 whitespace-pre-line text-sm">{refund.eligibilityNotes}</p></>}
                    {refund.failureReason && <Alert tone="error" className="mt-4">{refund.failureReason}</Alert>}
                </Panel>
                <Panel title="Order and payment">
                    <KeyValue items={[
                        ['Order', <Link key="o" to={`/admin/orders/${order._id}`}>{order.orderNumber}</Link>],
                        ['Order status', <StatusBadge key="s" status={order.status} />],
                        ['Total paid', money(order.total, order.currency)],
                        ['Already refunded', money(order.refundedAmount || 0, order.currency)],
                        ['Refundable balance', money(remaining, order.currency)],
                        ['Paid at', dateTime(order.paidAt)],
                        ['Payment ID', payment?.razorpayPaymentId],
                        ['Method', payment?.method],
                        ['Files downloaded', `${downloads} time(s)`],
                    ]} />
                </Panel>
            </div>
            <Panel title="History">
                <ul className="space-y-2 text-sm">
                    {refund.history.map((h, i) => (
                        <li key={i} className="flex flex-wrap gap-2"><StatusBadge status={h.status} /> <span>{h.note}</span> <span className="text-muted">{h.by?.email} · {dateTime(h.at)}</span></li>
                    ))}
                </ul>
            </Panel>
            <Modal open={Boolean(decision)} onClose={() => setDecision(null)} title={decision === 'approved' ? 'Approve refund' : decision === 'rejected' ? 'Reject refund' : 'Mark under review'} footer={<Button onClick={decide} loading={busy === 'decide'} variant={decision === 'rejected' ? 'danger' : 'primary'}>Save decision</Button>}>
                <div className="space-y-4">
                    {decision === 'approved' && (
                        <>
                            <MoneyInput label="Refund amount (₹)" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} hint={`Maximum ${money(remaining, order.currency)}`} />
                            <Checkbox checked={form.revokeAccess} onChange={(e) => setForm({ ...form, revokeAccess: e.target.checked })} label="Revoke download access when the refund is processed" />
                            <Alert tone="info">Approving does not move money. You will initiate the refund in a separate, explicit step.</Alert>
                        </>
                    )}
                    <Textarea label={decision === 'rejected' ? 'Reason (sent to the customer)' : 'Message to customer (optional)'} rows={3} value={form.decisionReason} onChange={(e) => setForm({ ...form, decisionReason: e.target.value })} />
                    <Textarea label="Eligibility notes (internal)" rows={3} value={form.eligibilityNotes} onChange={(e) => setForm({ ...form, eligibilityNotes: e.target.value })} />
                    <Checkbox checked={form.notifyCustomer} onChange={(e) => setForm({ ...form, notifyCustomer: e.target.checked })} label="Email the customer about this update" />
                </div>
            </Modal>
            <ConfirmDialog open={confirmInitiate} title="Initiate refund?" message={`This asks Razorpay to refund ${money(refund.amount || 0, order.currency)} to the customer's original payment method. This cannot be undone.`} confirmLabel="Initiate refund" tone="danger" loading={busy === 'init'} onClose={() => setConfirmInitiate(false)} onConfirm={async () => { const r = await run('init', () => api.post(`/admin/refunds/${refund._id}/initiate`, { confirm: true }).then((x) => x.data)); setConfirmInitiate(false); if (r) reload(); }} />
        </div>
    );
}

export default function Orders({ view }) {
    if (view === 'order') return <OrderDetail />;
    if (view === 'payments') return <Payments />;
    if (view === 'refunds') return <Refunds />;
    if (view === 'refund') return <RefundDetail />;
    return <OrdersList />;
}

