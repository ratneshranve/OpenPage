import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, PageLoader, Select, StatusBadge, Tabs, Textarea } from '../../components/ui';
import { DataTable, FilterSelect, KeyValue, PageHeader, Panel, SearchInput, useAction, useAdminData } from '../components/kit';
import { api, post } from '../../lib/api';
import { dateTime } from '../../lib/format';

function TicketList() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('open');
    const [category, setCategory] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const { data, loading, error } = useAdminData('/admin/support', { status: status || undefined, category: category || undefined, q: q || undefined, page });
    const counts = data?.counts || {};
    return (
        <div>
            <PageHeader title="Support" description="Requests from the support and contact forms. Replies are emailed to the customer." />
            <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: 'open', label: 'Open', count: counts.open }, { value: 'pending', label: 'Awaiting customer', count: counts.pending }, { value: 'resolved', label: 'Resolved', count: counts.resolved }, { value: 'closed', label: 'Closed', count: counts.closed }, { value: '', label: 'All' }]} />
            <div className="my-4 flex flex-wrap gap-2">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Email, ticket or order number" className="w-full sm:w-80" />
                <FilterSelect label="Topic" value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: '', label: 'All topics' }, ...['download', 'payment', 'refund', 'account', 'product', 'other'].map((c) => ({ value: c, label: c }))]} />
            </div>
            <DataTable loading={loading} error={error} rows={data?.items} pagination={data?.pagination} onPage={setPage} onRowClick={(r) => navigate(`/admin/support/${r._id}`)} empty="No requests here." columns={[
                { key: 'ticketNumber', label: 'Ticket', render: (r) => <><p className="font-medium">{r.ticketNumber}</p>{r.priority === 'high' && <Badge tone="red">High</Badge>}</> },
                { key: 'subject', label: 'Subject', render: (r) => <><p>{r.subject || '(no subject)'}</p><p className="text-xs text-muted">{r.category}</p></> },
                { key: 'email', label: 'From', render: (r) => <><p>{r.name}</p><p className="text-xs text-muted">{r.email}</p></> },
                { key: 'orderNumber', label: 'Order' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'updatedAt', label: 'Updated', render: (r) => dateTime(r.updatedAt) },
            ]} />
        </div>
    );
}

function Ticket() {
    const { id } = useParams();
    const { data: t, loading, error, reload } = useAdminData(`/admin/support/${id}`);
    const { busy, run } = useAction();
    const [reply, setReply] = useState('');
    const [replyStatus, setReplyStatus] = useState('pending');
    const [note, setNote] = useState('');
    if (loading && !t) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const update = (body) => run('upd', () => api.patch(`/admin/support/${id}`, body).then((x) => x.data)).then(reload);
    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/support', label: 'Support' }} title={t.subject || `Ticket ${t.ticketNumber}`} description={<span className="flex gap-2"><StatusBadge status={t.status} /> <Badge>{t.category}</Badge></span>}
                actions={
                    <>
                        <Select aria-label="Status" value={t.status} onChange={(e) => update({ status: e.target.value })} options={['open', 'pending', 'resolved', 'closed'].map((s) => ({ value: s, label: s }))} />
                        <Select aria-label="Priority" value={t.priority} onChange={(e) => update({ priority: e.target.value })} options={['low', 'normal', 'high'].map((s) => ({ value: s, label: `${s} priority` }))} />
                    </>
                }
            />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <Panel title="Conversation">
                        <ul className="space-y-3">
                            {t.replies.map((r, i) => (
                                <li key={i} className={`rounded-xl p-4 text-sm ${r.from === 'admin' ? 'ml-6 bg-accent-pale' : 'mr-6 bg-surface'}`}>
                                    <p className="text-xs text-muted">{r.from === 'admin' ? `Support (${r.by?.email || 'admin'})` : `${t.name || t.email}`} · {dateTime(r.at)}</p>
                                    <p className="mt-1 whitespace-pre-line">{r.message}</p>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 space-y-3 border-t border-line pt-4">
                            <Textarea label="Reply to customer" rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />
                            <div className="flex flex-wrap items-end gap-2">
                                <Select label="Then set status to" value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)} options={[{ value: 'pending', label: 'Awaiting customer' }, { value: 'resolved', label: 'Resolved' }, { value: 'open', label: 'Open' }]} />
                                <Button loading={busy === 'reply'} disabled={!reply.trim()} onClick={async () => { if (await run('reply', () => post(`/admin/support/${id}/reply`, { message: reply, status: replyStatus }))) { setReply(''); reload(); } }}>Send reply</Button>
                            </div>
                        </div>
                    </Panel>
                </div>
                <div className="space-y-4">
                    <Panel title="Details">
                        <KeyValue items={[
                            ['Name', t.name], ['Email', t.email], ['Ticket', t.ticketNumber], ['Received', dateTime(t.createdAt)],
                            ['Order', t.order ? <Link key="o" to={`/admin/orders/${t.order._id}`}>{t.order.orderNumber}</Link> : t.orderNumber || '—'],
                            t.refundRequest && ['Refund request', <Link key="r" to={`/admin/refunds/${t.refundRequest._id}`}>{t.refundRequest.refundNumber} ({t.refundRequest.status})</Link>],
                        ]} />
                    </Panel>
                    <Panel title="Internal notes">
                        <ul className="mb-3 space-y-2 text-sm">
                            {t.internalNotes.map((n, i) => <li key={i} className="rounded-lg bg-surface p-2">{n.text}<p className="text-xs text-muted">{n.by?.email} · {dateTime(n.at)}</p></li>)}
                        </ul>
                        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to admins only" />
                        <Button size="sm" className="mt-2" disabled={!note.trim()} onClick={async () => { await update({ note }); setNote(''); }}>Add note</Button>
                    </Panel>
                </div>
            </div>
        </div>
    );
}

export default function SupportAdmin() {
    const { id } = useParams();
    return id ? <Ticket /> : <TicketList />;
}
