import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { Alert, Badge, Button, ConfirmDialog, Input, Modal, PageLoader, StatusBadge, Tabs } from '../../components/ui';
import { DataTable, FilterSelect, KeyValue, PageHeader, Panel, SearchInput, downloadCsv, useAction, useAdminData } from '../components/kit';
import { api } from '../../lib/api';
import { date, dateTime, money } from '../../lib/format';

function Customers() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('registered');
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const reg = useAdminData('/admin/customers', { q: q || undefined, status: status || undefined, page }, { skip: tab !== 'registered' });
    const guests = useAdminData('/admin/customers/guests', { q: q || undefined, page }, { skip: tab !== 'guests' });
    return (
        <div>
            <PageHeader title="Customers" description="Registered accounts and guest buyers. Personal data is shown only where needed for support." />
            <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ value: 'registered', label: 'Registered accounts' }, { value: 'guests', label: 'Guest buyers' }]} />
            <div className="my-4 flex flex-wrap gap-2">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search email or name" className="w-full sm:w-80" />
                {tab === 'registered' && <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />}
            </div>
            {tab === 'registered' ? (
                <DataTable loading={reg.loading} error={reg.error} rows={reg.data?.items} pagination={reg.data?.pagination} onPage={setPage} onRowClick={(r) => navigate(`/admin/customers/${r.id}`)} empty="No customers yet." columns={[
                    { key: 'email', label: 'Customer', render: (r) => <><p className="font-medium">{r.name || '—'}</p><p className="text-xs text-muted">{r.email}</p></> },
                    { key: 'emailVerified', label: 'Email', render: (r) => (r.emailVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="yellow">Unverified</Badge>) },
                    { key: 'orders', label: 'Orders', className: 'text-right' },
                    { key: 'totalValue', label: 'Value', className: 'text-right', render: (r) => money(r.totalValue) },
                    { key: 'marketingEmails', label: 'Marketing', render: (r) => (r.marketingEmails ? 'Opted in' : '—') },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'createdAt', label: 'Registered', render: (r) => date(r.createdAt) },
                ]} />
            ) : (
                <DataTable loading={guests.loading} error={guests.error} rows={guests.data?.items} rowKey={(r) => r._id} pagination={guests.data?.pagination} onPage={setPage} onRowClick={(r) => navigate(`/admin/orders?q=${encodeURIComponent(r._id)}`)} empty="No guest purchases." columns={[
                    { key: '_id', label: 'Email' },
                    { key: 'orders', label: 'Paid orders', className: 'text-right' },
                    { key: 'value', label: 'Value', className: 'text-right', render: (r) => money(r.value) },
                    { key: 'last', label: 'Last purchase', render: (r) => date(r.last) },
                ]} />
            )}
        </div>
    );
}

function CustomerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, loading, error, reload } = useAdminData(`/admin/customers/${id}`);
    const { busy, run } = useAction();
    const [suspend, setSuspend] = useState(false);
    const [reason, setReason] = useState('');
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const c = data.customer;
    const recovery = (action) => run(action, () => api.post(`/admin/customers/${id}/recovery`, { action }).then((x) => x.data)).then(reload);
    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/customers', label: 'Customers' }} title={c.name || c.email} description={<span className="flex gap-2"><StatusBadge status={c.status} /> {c.emailVerified ? <Badge tone="green">Email verified</Badge> : <Badge tone="yellow">Email not verified</Badge>}</span>}
                actions={
                    <>
                        <Button variant="outline" size="sm" loading={busy === 'send_password_reset'} onClick={() => recovery('send_password_reset')}>Send password reset</Button>
                        {!c.emailVerified && <Button variant="outline" size="sm" loading={busy === 'resend_verification'} onClick={() => recovery('resend_verification')}>Resend verification</Button>}
                        <Button variant="outline" size="sm" loading={busy === 'revoke_sessions'} onClick={() => recovery('revoke_sessions')}>Sign out everywhere</Button>
                        {c.status === 'active' ? <Button variant="outline-danger" size="sm" onClick={() => setSuspend(true)}>Suspend</Button> : <Button variant="secondary" size="sm" loading={busy === 'react'} onClick={() => run('react', () => api.post(`/admin/customers/${id}/status`, { status: 'active' }).then((x) => x.data)).then(reload)}>Reactivate</Button>}
                    </>
                }
            />
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Profile">
                    <KeyValue items={[
                        ['Email', c.email],
                        ['Registered', dateTime(c.createdAt)],
                        ['Last login', dateTime(c.lastLoginAt)],
                        ['Paid orders', data.totals.orders],
                        ['Total purchase value', money(data.totals.value)],
                        ['Active sessions', data.activeSessions],
                        c.suspendedReason && ['Suspension reason', c.suspendedReason],
                    ]} />
                </Panel>
                <Panel title="Consent and preferences">
                    <KeyValue items={[
                        ['Marketing emails', c.marketingEmails ? 'Opted in' : 'Not opted in'],
                        ['Newsletter', data.newsletter ? `${data.newsletter.status} (${data.newsletter.source})` : 'Not subscribed'],
                        ['Browser notifications', c.notificationsEnabled ? `On · ${data.notificationSubscriptions} browser(s)` : 'Off'],
                    ]} />
                    <p className="mt-4 text-sm font-medium">Consent history</p>
                    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                        {(c.consents || []).slice().reverse().map((x, i) => <li key={i}>{dateTime(x.at)} · {x.type.replace(/_/g, ' ')} · {x.granted ? 'granted' : 'withdrawn'} · {x.source}</li>)}
                    </ul>
                </Panel>
            </div>
            <Panel title="Orders">
                <DataTable rows={data.orders} onRowClick={(r) => navigate(`/admin/orders/${r._id}`)} empty="No orders." columns={[
                    { key: 'orderNumber', label: 'Order' },
                    { key: 'total', label: 'Total', render: (r) => money(r.total, r.currency) },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'deliveryStatus', label: 'Delivery', render: (r) => <StatusBadge status={r.deliveryStatus} /> },
                    { key: 'createdAt', label: 'Date', render: (r) => dateTime(r.createdAt) },
                ]} />
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Purchased eBooks">
                    <DataTable rows={data.entitlements} empty="No purchases." columns={[
                        { key: 'productTitle', label: 'eBook' },
                        { key: 'fileVersion', label: 'Version' },
                        { key: 'status', label: 'Access', render: (r) => <StatusBadge status={r.status} /> },
                        { key: 'downloadCount', label: 'Downloads', className: 'text-right' },
                    ]} />
                </Panel>
                <Panel title="Support history">
                    <DataTable rows={data.tickets} onRowClick={(r) => navigate(`/admin/support/${r._id}`)} empty="No support requests." columns={[
                        { key: 'ticketNumber', label: 'Ticket' },
                        { key: 'subject', label: 'Subject', render: (r) => r.subject || r.category },
                        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    ]} />
                </Panel>
            </div>
            <Modal open={suspend} onClose={() => setSuspend(false)} title="Suspend account" footer={<Button variant="danger" loading={busy === 'susp'} onClick={async () => { await run('susp', () => api.post(`/admin/customers/${id}/status`, { status: 'suspended', reason }).then((x) => x.data)); setSuspend(false); reload(); }}>Suspend account</Button>}>
                <p className="mb-3 text-sm text-ink-soft">The customer will be signed out everywhere and unable to sign in. Their purchases remain recorded; guest download links by email still work unless you revoke access on the order.</p>
                <Input label="Reason (internal)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Modal>
        </div>
    );
}

function Subscribers() {
    const [tab, setTab] = useState('subscribers');
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('subscribed');
    const [page, setPage] = useState(1);
    const subs = useAdminData('/admin/subscribers', { q: q || undefined, status: status || undefined, page }, { skip: tab !== 'subscribers' });
    const sup = useAdminData('/admin/suppressions', { q: q || undefined, page }, { skip: tab !== 'suppressions' });
    const { busy, run } = useAction();
    const [removing, setRemoving] = useState(null);
    const [adding, setAdding] = useState(false);
    const [email, setEmail] = useState('');
    const counts = subs.data?.counts || {};
    return (
        <div>
            <PageHeader
                title="Newsletter subscribers"
                description="Double opt-in subscribers with consent timestamps. Buyers are never added automatically."
                actions={<Button variant="outline" onClick={() => downloadCsv('/admin/subscribers/export', {}, 'subscribers.csv')}><Download className="h-4 w-4" /> Export subscribed</Button>}
            />
            <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ value: 'subscribers', label: 'Subscribers', count: counts.subscribed }, { value: 'suppressions', label: 'Suppression list' }]} />
            <div className="my-4 flex flex-wrap gap-2">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search email" className="w-full sm:w-72" />
                {tab === 'subscribers' && <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'subscribed', label: `Subscribed (${counts.subscribed || 0})` }, { value: 'pending', label: `Pending confirmation (${counts.pending || 0})` }, { value: 'unsubscribed', label: `Unsubscribed (${counts.unsubscribed || 0})` }, { value: '', label: 'All' }]} />}
                {tab === 'suppressions' && <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add address</Button>}
            </div>
            {tab === 'subscribers' ? (
                <DataTable loading={subs.loading} error={subs.error} rows={subs.data?.items} pagination={subs.data?.pagination} onPage={setPage} empty="No subscribers." columns={[
                    { key: 'email', label: 'Email' },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'source', label: 'Source' },
                    { key: 'consentAt', label: 'Consent', render: (r) => dateTime(r.consentAt) },
                    { key: 'createdAt', label: 'Signed up', render: (r) => date(r.createdAt) },
                    { key: 'act', label: '', render: (r) => r.status !== 'unsubscribed' && <Button size="sm" variant="ghost" loading={busy === r._id} onClick={() => run(r._id, () => api.post(`/admin/subscribers/${r._id}/unsubscribe`).then((x) => x.data)).then(subs.reload)}>Unsubscribe</Button> },
                ]} />
            ) : (
                <DataTable loading={sup.loading} error={sup.error} rows={sup.data?.items} pagination={sup.data?.pagination} onPage={setPage} empty="No suppressed addresses." columns={[
                    { key: 'email', label: 'Email' },
                    { key: 'reason', label: 'Reason' },
                    { key: 'source', label: 'Source' },
                    { key: 'createdAt', label: 'Since', render: (r) => dateTime(r.createdAt) },
                    { key: 'act', label: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}>Remove</Button> },
                ]} />
            )}
            <Modal open={adding} onClose={() => setAdding(false)} title="Suppress an address" footer={<Button loading={busy === 'add'} onClick={async () => { const r = await run('add', () => api.post('/admin/suppressions', { email, reason: 'manual' }).then((x) => x.data)); if (r) { setAdding(false); setEmail(''); sup.reload(); } }}>Suppress</Button>}>
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="Suppressed addresses never receive marketing email. Transactional emails are unaffected." />
            </Modal>
            <ConfirmDialog open={Boolean(removing)} title="Remove from suppression list?" message="Only do this if the person has asked to receive marketing again. They still need to opt in." confirmLabel="Remove" loading={busy === 'rm'} onClose={() => setRemoving(null)} onConfirm={async () => { await run('rm', () => api.delete(`/admin/suppressions/${removing._id}`).then((x) => x.data)); setRemoving(null); sup.reload(); }} />
        </div>
    );
}

export default function People({ view }) {
    if (view === 'customer') return <CustomerDetail />;
    if (view === 'subscribers') return <Subscribers />;
    return <Customers />;
}

