import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, Play, Plus, RotateCcw, Save, Send, Server } from 'lucide-react';
import { Alert, Badge, Button, Input, Modal, PageLoader, Select, StatusBadge, Textarea, Toggle, cn } from '../../components/ui';
import { DataTable, FilterSelect, KeyValue, PageHeader, Panel, SearchInput, fromLocalInput, toLocalInput, useAction, useAdminData } from '../components/kit';
import { api, post, errorMessage } from '../../lib/api';
import { dateTime, money } from '../../lib/format';

function SmtpStatus() {
    const { data, loading, reload } = useAdminData('/admin/email/smtp-status');
    const { busy, run } = useAction();
    const [to, setTo] = useState('');
    return (
        <Panel title="SMTP connection" actions={<Server className="h-4 w-4 text-muted" />}>
            {loading ? <p className="text-sm text-muted">Checking…</p> : data?.ok ? <Alert tone="success">Connected to {data.host}:{data.port}{data.secure ? ' (TLS)' : ''} as {data.user || 'anonymous'}. Sending from {data.from}.</Alert> : <Alert tone="error" title={data?.configured ? 'SMTP connection failed' : 'SMTP is not configured'}>{data?.error} Set SMTP_* variables in the server environment. Passwords are never shown here.</Alert>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input className="flex-1" label="Send a test email to" type="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
                <Button variant="outline" loading={busy === 'test'} onClick={() => run('test', () => post('/admin/email/test', { to: to || undefined }))}><Send className="h-4 w-4" /> Send test</Button>
                <Button variant="ghost" onClick={reload}>Recheck</Button>
            </div>
        </Panel>
    );
}

function Templates() {
    const navigate = useNavigate();
    const { data, loading, error } = useAdminData('/admin/email-templates');
    return (
        <div className="space-y-6">
            <PageHeader title="Email templates" description="Edit the content of every email. Transactional emails (codes, receipts, downloads) are always sent; marketing emails respect unsubscribes and include an unsubscribe link automatically." />
            <SmtpStatus />
            <DataTable loading={loading} error={error} rows={data} rowKey={(r) => r.key} onRowClick={(r) => navigate(`/admin/email-templates/${r.key}`)} columns={[
                { key: 'name', label: 'Template', render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.key}</p></> },
                { key: 'category', label: 'Type', render: (r) => <Badge tone={r.category === 'marketing' ? 'blue' : 'green'}>{r.category}</Badge> },
                { key: 'subject', label: 'Subject', className: 'max-w-sm' },
                { key: 'updatedAt', label: 'Updated', render: (r) => dateTime(r.updatedAt) },
            ]} />
        </div>
    );
}

function TemplateEdit() {
    const { key } = useParams();
    const { data, loading, error, reload } = useAdminData(`/admin/email-templates/${key}`);
    const [form, setForm] = useState(null);
    const [preview, setPreview] = useState(null);
    const { busy, run } = useAction();
    useEffect(() => {
        if (data) setForm({ subject: data.subject, preheader: data.preheader || '', html: data.html });
    }, [data]);
    const doPreview = async () => {
        try {
            const r = await post(`/admin/email-templates/${key}/preview`, form);
            setPreview(r.data);
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (!form) return null;
    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/email-templates', label: 'Email templates' }} title={data.name} description={<Badge tone={data.category === 'marketing' ? 'blue' : 'green'}>{data.category}</Badge>}
                actions={
                    <>
                        <Button variant="outline" onClick={doPreview}><Eye className="h-4 w-4" /> Preview</Button>
                        <Button variant="outline" loading={busy === 'test'} onClick={() => run('test', () => post('/admin/email/test', { templateKey: key }))}><Send className="h-4 w-4" /> Send test to me</Button>
                        <Button variant="ghost" loading={busy === 'reset'} onClick={async () => { if (await run('reset', () => post(`/admin/email-templates/${key}/reset`))) reload(); }}><RotateCcw className="h-4 w-4" /> Restore default</Button>
                        <Button loading={busy === 'save'} onClick={() => run('save', () => api.patch(`/admin/email-templates/${key}`, form).then((x) => x.data))}><Save className="h-4 w-4" /> Save</Button>
                    </>
                }
            />
            <div className="grid gap-6 xl:grid-cols-2">
                <Panel>
                    <div className="space-y-4">
                        <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                        <Input label="Preheader (inbox preview text)" value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} />
                        <Textarea label="HTML body" rows={20} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className="[&_textarea]:font-mono [&_textarea]:text-xs" />
                        <div className="rounded-xl bg-surface p-3 text-xs leading-5 text-ink-soft">
                            <p className="font-semibold text-ink">Variables</p>
                            <p>Always available: <code>{'{{siteName}} {{siteUrl}} {{supportEmail}} {{recipientEmail}} {{year}}'}</code></p>
                            {data.variables?.length > 0 && <p>This template: {data.variables.map((v) => <code key={v} className="mr-1">{`{{${v}}}`}</code>)}</p>}
                            <p className="mt-1">Blocks: <code>{'{{#if x}}…{{else}}…{{/if}}'}</code>, <code>{'{{#each items}}{{this.title}}{{/each}}'}</code>. Values are HTML-escaped automatically. The header, footer and (for marketing) unsubscribe link are added for you.</p>
                        </div>
                    </div>
                </Panel>
                <Panel title="Preview" description={preview ? `Subject: ${preview.subject}` : 'Click Preview to render with sample data.'}>
                    {preview ? <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[640px] w-full rounded-lg border border-line bg-white" /> : <div className="flex h-64 items-center justify-center text-sm text-muted">No preview yet</div>}
                </Panel>
            </div>
        </div>
    );
}

function Automations() {
    const { data, loading, error, reload } = useAdminData('/admin/automations');
    const templates = useAdminData('/admin/email-templates');
    const { busy, run } = useAction();
    const [editing, setEditing] = useState(null);
    const [runsFor, setRunsFor] = useState(null);
    const toggle = (a) => run(a._id, () => api.patch(`/admin/automations/${a._id}`, { enabled: !a.enabled }).then((x) => x.data)).then(reload);
    return (
        <div className="space-y-6">
            <PageHeader title="Email automation" description="Automations send marketing emails only. Pausing them never affects payment confirmations or eBook delivery." />
            <Alert tone="warning" title="Consent">A verified checkout email is not, by itself, consent for promotional messages. By default every automation requires the customer to have opted in. Check the rules for the markets you sell to before relaxing this.</Alert>
            <DataTable loading={loading} error={error} rows={data} columns={[
                { key: 'name', label: 'Automation', render: (r) => <><p className="font-medium">{r.name}</p><p className="max-w-md text-xs text-muted">{r.description}</p></> },
                { key: 'trigger', label: 'Trigger', render: (r) => <>{r.trigger === 'checkout_abandoned' ? `Abandoned checkout · step ${r.step}` : 'After purchase'}<p className="text-xs text-muted">Delay {r.delayMinutes >= 1440 ? `${(r.delayMinutes / 1440).toFixed(1)} d` : r.delayMinutes >= 60 ? `${(r.delayMinutes / 60).toFixed(1)} h` : `${r.delayMinutes} min`}</p></> },
                { key: 'consent', label: 'Consent', render: (r) => (r.conditions?.requireMarketingConsent ? <Badge tone="green">Opt-in required</Badge> : <Badge tone="yellow">Not required</Badge>) },
                { key: 'stats', label: 'Queued / sent / failed', render: (r) => `${r.stats.queued} / ${r.stats.sent} / ${r.stats.failed}` },
                { key: 'lastRunAt', label: 'Last run', render: (r) => dateTime(r.lastRunAt) },
                { key: 'enabled', label: 'Enabled', render: (r) => <Toggle checked={r.enabled} disabled={busy === r._id} onChange={() => toggle(r)} label="" /> },
                { key: 'act', label: '', render: (r) => <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setRunsFor(r)}>History</Button><Button size="sm" variant="ghost" disabled={!r.enabled} loading={busy === `run${r._id}`} onClick={() => run(`run${r._id}`, () => post(`/admin/automations/${r._id}/run`)).then(reload)}><Play className="h-4 w-4" /></Button></div> },
            ]} />
            {editing && (
                <Modal open onClose={() => setEditing(null)} title={`Edit: ${editing.name}`} size="lg" footer={<Button loading={busy === 'save'} onClick={async () => { const body = { name: editing.name, description: editing.description, delayMinutes: Number(editing.delayMinutes), templateKey: editing.templateKey, audience: editing.audience, maxPerRecipient: Number(editing.maxPerRecipient), frequencyCapHours: Number(editing.frequencyCapHours), lookbackHours: Number(editing.lookbackHours), conditions: { requireMarketingConsent: editing.conditions.requireMarketingConsent, minOrderValue: editing.conditions.minOrderValue || 0 } }; const r = await run('save', () => api.patch(`/admin/automations/${editing._id}`, body).then((x) => x.data)); if (r) { setEditing(null); reload(); } }}>Save</Button>}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input className="sm:col-span-2" label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                        <Textarea className="sm:col-span-2" rows={2} label="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                        <Input label="Delay (minutes)" type="number" min="5" value={editing.delayMinutes} onChange={(e) => setEditing({ ...editing, delayMinutes: e.target.value })} hint={editing.trigger === 'checkout_abandoned' && editing.step > 1 ? 'Measured from the previous reminder.' : editing.trigger === 'checkout_abandoned' ? 'Measured from the last checkout activity. Recommended 60 to 180.' : 'Measured from payment.'} />
                        <Select label="Email template" value={editing.templateKey} onChange={(e) => setEditing({ ...editing, templateKey: e.target.value })} options={(templates.data || []).map((t) => ({ value: t.key, label: t.name }))} />
                        <Select label="Audience" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} options={[{ value: 'all_eligible', label: 'All eligible' }, { value: 'registered_only', label: 'Registered customers only' }, { value: 'guests_only', label: 'Guests only' }]} />
                        <Input label="Max emails per recipient" type="number" min="1" value={editing.maxPerRecipient} onChange={(e) => setEditing({ ...editing, maxPerRecipient: e.target.value })} />
                        <Input label="Frequency cap (hours between marketing emails)" type="number" min="0" value={editing.frequencyCapHours} onChange={(e) => setEditing({ ...editing, frequencyCapHours: e.target.value })} />
                        <Input label="Look-back window (hours)" type="number" min="1" value={editing.lookbackHours} onChange={(e) => setEditing({ ...editing, lookbackHours: e.target.value })} hint="Older candidates are ignored." />
                        <div className="sm:col-span-2"><Toggle checked={editing.conditions.requireMarketingConsent} onChange={(v) => setEditing({ ...editing, conditions: { ...editing.conditions, requireMarketingConsent: v } })} label="Require marketing opt-in" description="Strongly recommended. Unsubscribed and suppressed addresses are always excluded." /></div>
                    </div>
                </Modal>
            )}
            {runsFor && <RunHistory automation={runsFor} onClose={() => setRunsFor(null)} />}
        </div>
    );
}

function RunHistory({ automation, onClose }) {
    const { data, loading } = useAdminData(`/admin/automations/${automation._id}/runs`);
    return (
        <Modal open onClose={onClose} title={`Execution history: ${automation.name}`} size="lg">
            <DataTable loading={loading} rows={data} empty="No runs yet." columns={[
                { key: 'startedAt', label: 'Started', render: (r) => dateTime(r.startedAt) },
                { key: 'candidates', label: 'Candidates' },
                { key: 'queued', label: 'Queued' },
                { key: 'skipped', label: 'Skipped' },
                { key: 'error', label: 'Error' },
            ]} />
        </Modal>
    );
}

function Logs() {
    const [params, setParams] = useSearchParams();
    const [page, setPage] = useState(1);
    const status = params.get('status') || '';
    const [category, setCategory] = useState('');
    const [q, setQ] = useState('');
    const { data, loading, error, reload } = useAdminData('/admin/email-logs', { status: status || undefined, category: category || undefined, q: q || undefined, page });
    const { busy, run } = useAction();
    const [detail, setDetail] = useState(null);
    const counts = data?.last7Days || {};
    return (
        <div>
            <PageHeader title="Email logs" description="Every email with its delivery state, retries and provider response. OTP codes and download links are never stored." />
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
                {['sent', 'queued', 'failed', 'suppressed', 'cancelled'].map((s) => <span key={s} className="flex items-center gap-1"><StatusBadge status={s} /> {counts[s] || 0}</span>)}
                <span className="text-muted">last 7 days</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Recipient email" className="w-full sm:w-72" />
                <FilterSelect label="Status" value={status} onChange={(v) => { setParams(v ? { status: v } : {}); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...['queued', 'sending', 'sent', 'failed', 'cancelled', 'suppressed'].map((s) => ({ value: s, label: s }))]} />
                <FilterSelect label="Category" value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ value: '', label: 'All types' }, { value: 'transactional', label: 'Transactional' }, { value: 'marketing', label: 'Marketing' }]} />
            </div>
            <DataTable loading={loading} error={error} rows={data?.items} pagination={data?.pagination} onPage={setPage} onRowClick={setDetail} columns={[
                { key: 'to', label: 'Recipient' },
                { key: 'type', label: 'Type', render: (r) => <>{r.type}<p className="text-xs text-muted">{r.category}</p></> },
                { key: 'subject', label: 'Subject', className: 'max-w-xs' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'attempts', label: 'Attempts', render: (r) => `${r.attempts}/${r.maxAttempts}` },
                { key: 'order', label: 'Order', render: (r) => (r.order ? <Link to={`/admin/orders/${r.order._id}`} onClick={(e) => e.stopPropagation()}>{r.order.orderNumber}</Link> : '—') },
                { key: 'createdAt', label: 'Created', render: (r) => dateTime(r.createdAt) },
                { key: 'act', label: '', render: (r) => (
                    <span onClick={(e) => e.stopPropagation()} className="flex gap-1">
                        {['failed', 'cancelled'].includes(r.status) && r.type !== 'otp_verification' && <Button size="sm" variant="outline" loading={busy === r._id} onClick={() => run(r._id, () => post(`/admin/email-logs/${r._id}/retry`)).then(reload)}>Retry</Button>}
                        {r.status === 'queued' && <Button size="sm" variant="ghost" loading={busy === `c${r._id}`} onClick={() => run(`c${r._id}`, () => post(`/admin/email-logs/${r._id}/cancel`)).then(reload)}>Cancel</Button>}
                    </span>
                ) },
            ]} />
            {detail && (
                <EmailDetailModal detail={detail} onClose={() => setDetail(null)} />
            )}
        </div>
    );
}

function EmailDetailModal({ detail, onClose }) {
    const [preview, setPreview] = useState({
        loading: !detail.bodyHtml && !detail.bodyText,
        html: detail.bodyHtml || '',
        text: detail.bodyText || '',
        subject: detail.subject || '',
    });
    const [tab, setTab] = useState('html');

    useEffect(() => {
        if (!detail?._id) return;
        if (detail.bodyHtml || detail.bodyText) {
            setPreview({
                loading: false,
                html: detail.bodyHtml || '',
                text: detail.bodyText || '',
                subject: detail.subject || '',
            });
            return;
        }

        api.get(`/admin/email-logs/${detail._id}/preview`)
            .then((r) => {
                setPreview({
                    loading: false,
                    html: r.data.data?.html || '',
                    text: r.data.data?.text || '',
                    subject: r.data.data?.subject || detail.subject || '',
                });
            })
            .catch(() => {
                setPreview((p) => ({ ...p, loading: false }));
            });
    }, [detail]);

    return (
        <Modal open onClose={onClose} title="Email details & Message" size="xl">
            <div className="space-y-6">
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Delivery Information</h3>
                    <KeyValue
                        items={[
                            ['Recipient', detail.to],
                            ['Subject', preview.subject || detail.subject || '—'],
                            ['Type', detail.type],
                            ['Template', detail.templateKey],
                            ['Category', detail.category],
                            ['Status', <StatusBadge key="s" status={detail.status} />],
                            ['Order', detail.order ? (detail.order.orderNumber || detail.order) : '—'],
                            ['Sent', dateTime(detail.sentAt)],
                            ['Attempts', `${detail.attempts}/${detail.maxAttempts}`],
                            ['Provider Message ID', detail.providerMessageId || '—'],
                        ]}
                    />
                </div>

                <div className="rounded-xl border border-line bg-surface/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-ink">Message Content Sent</h3>
                            <p className="truncate text-xs text-muted">
                                {preview.subject ? `Subject: ${preview.subject}` : 'Rendered preview of the message sent to customer'}
                            </p>
                        </div>
                        <div className="flex rounded-lg border border-line bg-white p-0.5 text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => setTab('html')}
                                className={cn('rounded-md px-3 py-1 transition cursor-pointer', tab === 'html' ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-ink')}
                            >
                                HTML Preview
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('text')}
                                className={cn('rounded-md px-3 py-1 transition cursor-pointer', tab === 'text' ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-ink')}
                            >
                                Plain Text
                            </button>
                        </div>
                    </div>

                    {preview.loading ? (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-white text-sm text-muted">
                            Loading message preview…
                        </div>
                    ) : tab === 'html' ? (
                        preview.html ? (
                            <iframe
                                title="Email Preview"
                                srcDoc={preview.html}
                                className="h-96 w-full rounded-lg border border-line bg-white shadow-inner"
                                sandbox="allow-same-origin allow-popups"
                            />
                        ) : (
                            <div className="flex h-32 items-center justify-center rounded-lg border border-line bg-white text-xs text-muted">
                                No visual preview available for this email log.
                            </div>
                        )
                    ) : (
                        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-4 font-mono text-xs text-ink leading-relaxed">
                            {preview.text || preview.html?.replace(/<[^>]+>/g, '') || 'No plain text content available.'}
                        </pre>
                    )}
                </div>

                {detail.errors?.length > 0 && (
                    <div className="mt-4">
                        <p className="text-sm font-semibold text-danger">Errors</p>
                        <ul className="mt-1 space-y-1 text-xs">
                            {detail.errors.map((e, i) => (
                                <li key={i} className="rounded-lg bg-danger-pale p-2 text-danger">
                                    {dateTime(e.at)} · {e.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Modal>
    );
}

const CAMPAIGN_EMPTY = { name: '', subject: '', preheader: '', audience: 'newsletter', offer: null, html: '<h1 style="font-size:20px;margin:0 0 12px;">Hello from {{siteName}}</h1>\n<p>Write your message here.</p>\n<p><a href="{{siteUrl}}/ebooks?utm_source=email&utm_medium=campaign" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">Browse eBooks</a></p>' };

function Campaigns() {
    const navigate = useNavigate();
    const { data, loading, error } = useAdminData('/admin/campaigns');
    return (
        <div>
            <PageHeader title="Marketing campaigns" description="One-off email campaigns to subscribers and opted-in customers. Suppressed and unsubscribed addresses are always excluded." actions={<Button onClick={() => navigate('/admin/campaigns/new')}><Plus className="h-4 w-4" /> New campaign</Button>} />
            <DataTable loading={loading} error={error} rows={data} onRowClick={(r) => navigate(`/admin/campaigns/${r._id}`)} empty="No campaigns yet." columns={[
                { key: 'name', label: 'Campaign', render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.subject}</p></> },
                { key: 'audience', label: 'Audience', render: (r) => r.audience.replace(/_/g, ' ') },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'scheduledAt', label: 'Scheduled', render: (r) => dateTime(r.scheduledAt) },
                { key: 'stats', label: 'Sent / recipients', render: (r) => `${r.stats.sent} / ${r.stats.recipients}` },
            ]} />
            <p className="mt-6 text-sm text-muted">Browser push campaigns are in <Link to="/admin/notifications">Notifications</Link>.</p>
        </div>
    );
}

function CampaignEdit() {
    const { id } = useParams();
    const isNew = id === 'new';
    const navigate = useNavigate();
    const { data, loading, error, reload } = useAdminData(isNew ? null : `/admin/campaigns/${id}`, null, { skip: isNew });
    const offers = useAdminData('/admin/offers');
    const [form, setForm] = useState(isNew ? CAMPAIGN_EMPTY : null);
    const [audience, setAudience] = useState(null);
    const [scheduleAt, setScheduleAt] = useState('');
    const [preview, setPreview] = useState(false);
    const { busy, run } = useAction();
    useEffect(() => {
        if (data?.campaign) setForm({ name: data.campaign.name, subject: data.campaign.subject, preheader: data.campaign.preheader || '', html: data.campaign.html, audience: data.campaign.audience, offer: data.campaign.offer || null });
    }, [data]);
    useEffect(() => {
        if (form?.audience) api.get('/admin/campaigns/audience', { params: { audience: form.audience } }).then((r) => setAudience(r.data.data)).catch(() => {});
    }, [form?.audience]);

    if (!isNew && loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (!form) return null;
    const campaign = data?.campaign;
    const editable = isNew || ['draft', 'scheduled'].includes(campaign?.status);
    const save = async () => {
        const r = await run('save', () => (isNew ? api.post('/admin/campaigns', form) : api.patch(`/admin/campaigns/${id}`, form)).then((x) => x.data));
        if (r && isNew) navigate(`/admin/campaigns/${r.data._id}`, { replace: true });
        else if (r) reload();
        return r;
    };
    const action = (a, extra = {}) => run(a, () => post(`/admin/campaigns/${id}/action`, { action: a, ...extra })).then(reload);

    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/campaigns', label: 'Campaigns' }} title={isNew ? 'New campaign' : campaign.name} description={!isNew && <StatusBadge status={campaign.status} />}
                actions={
                    <>
                        <Button variant="outline" onClick={() => setPreview(true)}><Eye className="h-4 w-4" /> Preview</Button>
                        {!isNew && <Button variant="outline" loading={busy === 'test'} onClick={() => run('test', () => post(`/admin/campaigns/${id}/test`, {}))}><Send className="h-4 w-4" /> Send test to me</Button>}
                        {editable && <Button loading={busy === 'save'} onClick={save}><Save className="h-4 w-4" /> Save</Button>}
                    </>
                }
            />
            {!isNew && campaign.status !== 'draft' && (
                <Panel title="Delivery">
                    <KeyValue items={[['Recipients', campaign.stats.recipients], ['Sent', campaign.stats.sent], ['Failed', campaign.stats.failed], ['Suppressed', campaign.stats.suppressed], ['Attributed orders', data.attributed.orders], ['Attributed revenue', money(data.attributed.revenue)]]} />
                    <p className="mt-3 text-xs text-muted">To attribute sales, add <code>{data.utmHint}</code> to links in the email.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {['sending', 'sent'].includes(campaign.status) && (data.delivery.queued || 0) > 0 && <Button variant="outline" onClick={() => action('pause')}>Pause sending</Button>}
                        {campaign.status === 'paused' && <Button variant="outline" onClick={() => action('resume')}>Resume</Button>}
                        {campaign.status === 'scheduled' && <Button variant="outline" onClick={() => action('unschedule')}>Unschedule</Button>}
                        {['scheduled', 'paused', 'sending'].includes(campaign.status) && <Button variant="outline-danger" onClick={() => action('cancel')}>Cancel campaign</Button>}
                    </div>
                </Panel>
            )}
            <Panel>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Campaign name (internal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!editable} />
                    <Select label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} disabled={!editable} options={[{ value: 'newsletter', label: 'Newsletter subscribers' }, { value: 'consented_customers', label: 'Customers who opted in' }, { value: 'all_marketing', label: 'All opted-in contacts' }]} hint={audience ? `${audience.count} recipient(s) right now · ${audience.suppressed} suppressed excluded` : undefined} />
                    <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} disabled={!editable} />
                    <Input label="Preheader" value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} disabled={!editable} />
                    <Select label="Linked offer (optional)" value={form.offer || ''} onChange={(e) => setForm({ ...form, offer: e.target.value || null })} disabled={!editable} placeholder="None" options={(offers.data || []).filter((o) => o.promoteViaEmail || o._id === form.offer).map((o) => ({ value: o._id, label: `${o.name}${o.couponCode ? ` (${o.couponCode})` : ''}` }))} />
                    <Textarea className="sm:col-span-2 [&_textarea]:font-mono [&_textarea]:text-xs" rows={16} label="HTML content" value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} disabled={!editable} hint="Header, footer and unsubscribe link are added automatically. Variables like {{siteUrl}} work here." />
                </div>
            </Panel>
            {!isNew && editable && (
                <Panel title="Schedule">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Input label="Send at (leave empty to send now)" type="datetime-local" value={scheduleAt || toLocalInput(campaign.scheduledAt)} onChange={(e) => setScheduleAt(e.target.value)} />
                        <Button variant="secondary" loading={busy === 'schedule'} onClick={async () => { if (await save()) action('schedule', { scheduledAt: fromLocalInput(scheduleAt) || undefined }); }}><Send className="h-4 w-4" /> {scheduleAt ? 'Schedule' : 'Send now'}</Button>
                    </div>
                </Panel>
            )}
            {preview && (
                <Modal open onClose={() => setPreview(false)} title={form.subject || 'Preview'} size="xl">
                    <iframe title="Campaign preview" sandbox="" srcDoc={form.html.replace(/{{\s*siteName\s*}}/g, 'OpenPage').replace(/{{\s*siteUrl\s*}}/g, window.location.origin)} className="h-[600px] w-full rounded-lg border border-line" />
                </Modal>
            )}
        </div>
    );
}

export default function Email({ view }) {
    if (view === 'template') return <TemplateEdit />;
    if (view === 'automations') return <Automations />;
    if (view === 'logs') return <Logs />;
    if (view === 'campaigns') return <Campaigns />;
    if (view === 'campaign') return <CampaignEdit />;
    return <Templates />;
}
