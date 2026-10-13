import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Pencil, Plus, Send } from 'lucide-react';
import { Alert, Button, Checkbox, ConfirmDialog, Input, Modal, PageLoader, Select, StatusBadge, Tabs, Textarea, Toggle } from '../../components/ui';
import { DataTable, ImageField, PageHeader, Panel, StatCard, fromLocalInput, toLocalInput, useAction, useAdminData } from '../components/kit';
import { api, put, post } from '../../lib/api';
import { currentPushToken } from '../../lib/notifications';
import { dateTime } from '../../lib/format';

const EMPTY = { title: '', body: '', url: '/', imageUrl: '', type: 'announcement', audience: 'all', active: true, scheduledAt: null };

export default function Notifications() {
    const overview = useAdminData('/admin/notifications');
    const campaigns = useAdminData('/admin/notifications/campaigns');
    const [tab, setTab] = useState('campaigns');
    const [page, setPage] = useState(1);
    const subs = useAdminData('/admin/notifications/subscriptions', { page }, { skip: tab !== 'subscriptions' });
    const { busy, run } = useAction();
    const [editing, setEditing] = useState(null);
    const [sending, setSending] = useState(null);

    if (overview.loading && !overview.data) return <PageLoader />;
    if (overview.error) return <Alert tone="error">{overview.error}</Alert>;
    const { stats, settings, firebase, recentErrors } = overview.data;
    const myToken = currentPushToken();

    const saveSettings = (patch) => run('settings', () => put('/admin/settings/notifications', { ...settings, ...patch })).then(overview.reload);
    const saveCampaign = async () => {
        const body = { ...editing };
        ['_id', 'status', 'stats', 'errors', 'sentAt', 'createdAt', 'updatedAt', 'createdBy', '__v'].forEach((k) => delete body[k]);
        body.offer = body.offer?._id || body.offer || null;
        body.product = body.product?._id || body.product || null;
        const r = await run('save', () => (editing._id ? api.patch(`/admin/notifications/campaigns/${editing._id}`, body) : api.post('/admin/notifications/campaigns', body)).then((x) => x.data));
        if (r) {
            setEditing(null);
            campaigns.reload();
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Browser notifications" description="Optional web push via Firebase Cloud Messaging. Only browsers that granted permission and are actively subscribed receive notifications." actions={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> New campaign</Button>} />
            {!firebase.adminConfigured && <Alert tone="warning" title="Firebase is not configured">Add the FIREBASE_* service account and web config variables to the server environment to enable notifications.</Alert>}
            {firebase.error && <Alert tone="error" title="Firebase error">{firebase.error}</Alert>}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Active subscriptions" value={stats.active} icon={BellRing} tone="blue" />
                <StatCard label="Customers" value={stats.customers} />
                <StatCard label="Guests" value={stats.guests} />
                <StatCard label="Inactive / removed" value={stats.inactive} />
            </div>
            <Panel title="Settings">
                <div className="space-y-4">
                    <Toggle checked={settings.enabled} disabled={busy === 'settings' || !firebase.adminConfigured} onChange={(v) => saveSettings({ enabled: v })} label="Notifications enabled (global)" description="When off, no prompts are shown and no campaigns are sent." />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Prompt title" defaultValue={settings.promptTitle} onBlur={(e) => e.target.value !== settings.promptTitle && saveSettings({ promptTitle: e.target.value })} />
                        <Input className="sm:col-span-2" label="Prompt text (why notifications are useful)" defaultValue={settings.promptText} onBlur={(e) => e.target.value !== settings.promptText && saveSettings({ promptText: e.target.value })} />
                        <Input label="Minimum hours between notifications" type="number" min="0" defaultValue={settings.minHoursBetweenNotifications} onBlur={(e) => Number(e.target.value) !== settings.minHoursBetweenNotifications && saveSettings({ minHoursBetweenNotifications: Number(e.target.value) })} hint="Frequency limit per browser" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3 text-sm">
                        <span>Test send to this browser:</span>
                        {myToken ? (
                            <Button size="sm" variant="outline" loading={busy === 'test'} onClick={() => run('test', () => post('/admin/notifications/test', { token: myToken }))}><Send className="h-4 w-4" /> Send test</Button>
                        ) : (
                            <span className="text-muted">Turn on notifications on the <Link to="/cookie-preferences">storefront</Link> in this browser first.</span>
                        )}
                    </div>
                </div>
            </Panel>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'campaigns', label: 'Campaigns' }, { value: 'subscriptions', label: 'Subscriptions' }, { value: 'errors', label: 'Errors' }]} />
            {tab === 'campaigns' && (
                <DataTable loading={campaigns.loading} error={campaigns.error} rows={campaigns.data} empty="No notification campaigns yet." columns={[
                    { key: 'title', label: 'Notification', render: (r) => <><p className="font-medium">{r.title}</p><p className="max-w-sm text-xs text-muted">{r.body}</p></> },
                    { key: 'type', label: 'Type', render: (r) => r.type.replace(/_/g, ' ') },
                    { key: 'audience', label: 'Audience' },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.active ? r.status : 'inactive'} /> },
                    { key: 'scheduledAt', label: 'Schedule', render: (r) => (r.sentAt ? `Sent ${dateTime(r.sentAt)}` : r.scheduledAt ? dateTime(r.scheduledAt) : '—') },
                    { key: 'stats', label: 'Delivered / failed / skipped', render: (r) => `${r.stats.delivered} / ${r.stats.failed} / ${r.stats.skipped}` },
                    { key: 'act', label: '', render: (r) => !['sent', 'sending'].includes(r.status) && <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing({ ...r })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={!r.active || !settings.enabled} onClick={() => setSending(r)}><Send className="h-4 w-4" /> Send now</Button></div> },
                ]} />
            )}
            {tab === 'subscriptions' && (
                <DataTable loading={subs.loading} error={subs.error} rows={subs.data?.items} pagination={subs.data?.pagination} onPage={setPage} empty="No subscriptions yet." columns={[
                    { key: 'user', label: 'Customer', render: (r) => r.user?.email || 'Guest browser' },
                    { key: 'active', label: 'State', render: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
                    { key: 'permission', label: 'Permission' },
                    { key: 'deliveredCount', label: 'Delivered' },
                    { key: 'lastError', label: 'Last error' },
                    { key: 'lastSeenAt', label: 'Last seen', render: (r) => dateTime(r.lastSeenAt) },
                ]} />
            )}
            {tab === 'errors' && (
                <DataTable rows={recentErrors} rowKey={(r) => r._id} empty="No delivery errors." columns={[{ key: '_id', label: 'Error code' }, { key: 'n', label: 'Browsers affected' }]} />
            )}
            {editing && (
                <Modal open onClose={() => setEditing(null)} title={editing._id ? 'Edit notification' : 'New notification'} size="lg" footer={<Button loading={busy === 'save'} onClick={saveCampaign}>Save</Button>}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input className="sm:col-span-2" label="Title" maxLength={80} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                        <Textarea className="sm:col-span-2" label="Message" rows={3} maxLength={240} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} hint="Keep it genuine and specific: new launches, real limited-time offers, price reductions." />
                        <Input label="Destination URL" value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} hint="e.g. /ebooks/my-new-book" />
                        <Select label="Type" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} options={['launch', 'offer', 'price_drop', 'announcement', 'reminder'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />
                        <Select label="Audience" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} options={[{ value: 'all', label: 'All subscribers' }, { value: 'customers', label: 'Signed-in customers' }, { value: 'guests', label: 'Guest browsers' }]} />
                        <Input label="Schedule (optional)" type="datetime-local" value={toLocalInput(editing.scheduledAt)} onChange={(e) => setEditing({ ...editing, scheduledAt: fromLocalInput(e.target.value) })} />
                        <div className="sm:col-span-2"><ImageField label="Image (optional)" value={editing.imageUrl} onChange={(v) => setEditing({ ...editing, imageUrl: v })} folder="banners" /></div>
                        <Checkbox checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} label="Active" />
                    </div>
                </Modal>
            )}
            <ConfirmDialog open={Boolean(sending)} title="Send notification now?" message={`"${sending?.title}" will be sent to ${sending?.audience === 'all' ? 'all' : sending?.audience} subscribed browsers (subject to the frequency limit).`} confirmLabel="Send" loading={busy === 'send'} onClose={() => setSending(null)} onConfirm={async () => { await run('send', () => post(`/admin/notifications/campaigns/${sending._id}/send`)); setSending(null); campaigns.reload(); }} />
        </div>
    );
}
