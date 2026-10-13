import { useEffect, useState } from 'react';
import { Pause, Pencil, Play, Plus, Power, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, Input, Modal, Select, StatusBadge, Tabs, Textarea } from '../../components/ui';
import { DataTable, MoneyInput, PageHeader, Panel, StringListEditor, fromLocalInput, toLocalInput, useAction, useAdminData } from '../components/kit';
import { api, get } from '../../lib/api';
import { dateTime, money } from '../../lib/format';

const EMPTY = {
    name: '', description: '', discountType: 'percentage', value: 10, appliesTo: 'all', products: [], categories: [], couponCode: '', startsAt: null, endsAt: null, timezone: 'Asia/Kolkata',
    minOrderAmount: 0, maxDiscountAmount: null, redemptionLimit: null, perCustomerLimit: null, firstPurchaseOnly: false, audienceEmails: [], stackable: false, active: false,
    showOnHomepage: false, bannerText: '', promoteViaEmail: false, promoteViaNotification: false,
};

const describe = (o) => (o.discountType === 'percentage' ? `${o.value}% off` : o.discountType === 'fixed' ? `${money(o.value)} off` : `Bundle price ${money(o.value)}`);

function MultiPick({ label, items, value, onChange, labelKey }) {
    return (
        <div>
            <p className="label">{label}</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                {items.map((i) => (
                    <label key={i._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface">
                        <input type="checkbox" checked={value.includes(i._id)} onChange={(e) => onChange(e.target.checked ? [...value, i._id] : value.filter((x) => x !== i._id))} />
                        {i[labelKey]}
                    </label>
                ))}
                {!items.length && <p className="p-2 text-sm text-muted">None available.</p>}
            </div>
        </div>
    );
}

function OfferForm({ initial, onClose, onSaved }) {
    const [form, setForm] = useState(initial);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const { busy, run } = useAction();
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    useEffect(() => {
        get('/admin/products', { limit: 100 }).then((d) => setProducts(d.items)).catch(() => {});
        get('/admin/categories').then(setCategories).catch(() => {});
    }, []);
    const save = async () => {
        const body = { ...form };
        ['_id', 'state', 'redemptionCount', 'createdAt', 'updatedAt', '__v'].forEach((k) => delete body[k]);
        body.products = (body.products || []).map((p) => p._id || p);
        body.categories = (body.categories || []).map((c) => c._id || c);
        if (body.discountType === 'percentage') body.value = Number(body.value);
        const r = await run('save', () => (initial._id ? api.patch(`/admin/offers/${initial._id}`, body) : api.post('/admin/offers', body)).then((x) => x.data));
        if (r) onSaved();
    };
    return (
        <Modal open onClose={onClose} title={initial._id ? 'Edit offer' : 'New offer'} size="xl" footer={<Button onClick={save} loading={busy === 'save'}>Save offer</Button>}>
            <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Offer name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                    <Input label="Coupon code" value={form.couponCode || ''} onChange={(e) => set('couponCode', e.target.value.toUpperCase())} hint="Leave empty for an automatic sale that needs no code." />
                    <Textarea className="sm:col-span-2" rows={2} label="Description (internal)" value={form.description} onChange={(e) => set('description', e.target.value)} />
                    <Select label="Discount type" value={form.discountType} onChange={(e) => set('discountType', e.target.value)} options={[{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'bundle', label: 'Bundle price' }]} />
                    {form.discountType === 'percentage' ? (
                        <Input label="Percentage off" type="number" min="1" max="100" value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
                    ) : (
                        <MoneyInput label={form.discountType === 'bundle' ? 'Bundle price (₹)' : 'Amount off (₹)'} value={form.value} onChange={(v) => set('value', v ?? 0)} hint={form.discountType === 'fixed' ? 'Coupons: off the eligible subtotal. Automatic sales: off each eligible item.' : 'Price when all selected products are bought together.'} />
                    )}
                </div>
                <Panel title="Eligibility">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {form.discountType !== 'bundle' && <Select label="Applies to" value={form.appliesTo} onChange={(e) => set('appliesTo', e.target.value)} options={[{ value: 'all', label: 'All products' }, { value: 'products', label: 'Selected products' }, { value: 'categories', label: 'Selected categories' }]} />}
                        <MoneyInput label="Minimum order (₹)" value={form.minOrderAmount} onChange={(v) => set('minOrderAmount', v ?? 0)} />
                        {(form.appliesTo === 'products' || form.discountType === 'bundle') && <MultiPick label={form.discountType === 'bundle' ? 'Bundle products' : 'Products'} items={products} value={(form.products || []).map((p) => p._id || p)} onChange={(v) => set('products', v)} labelKey="title" />}
                        {form.appliesTo === 'categories' && form.discountType !== 'bundle' && <MultiPick label="Categories" items={categories} value={(form.categories || []).map((c) => c._id || c)} onChange={(v) => set('categories', v)} labelKey="name" />}
                        <MoneyInput label="Maximum discount (₹)" value={form.maxDiscountAmount} onChange={(v) => set('maxDiscountAmount', v)} hint="Optional cap" />
                        <Input label="Total redemption limit" type="number" min="1" value={form.redemptionLimit ?? ''} onChange={(e) => set('redemptionLimit', e.target.value ? Number(e.target.value) : null)} />
                        <Input label="Uses per customer" type="number" min="1" value={form.perCustomerLimit ?? ''} onChange={(e) => set('perCustomerLimit', e.target.value ? Number(e.target.value) : null)} />
                        <div className="space-y-3 pt-2">
                            <Checkbox checked={form.firstPurchaseOnly} onChange={(e) => set('firstPurchaseOnly', e.target.checked)} label="First purchase only" />
                            <Checkbox checked={form.stackable} onChange={(e) => set('stackable', e.target.checked)} label="Can combine with other stackable offers" />
                        </div>
                        <div className="sm:col-span-2"><StringListEditor label="Selected audience (optional)" value={form.audienceEmails || []} onChange={(v) => set('audienceEmails', v.map((x) => x.toLowerCase()))} placeholder="customer@example.com" hint="If set, only these email addresses can use the offer. Audience offers are never shown publicly." /></div>
                    </div>
                </Panel>
                <Panel title="Schedule">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Starts" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set('startsAt', fromLocalInput(e.target.value))} />
                        <Input label="Ends" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set('endsAt', fromLocalInput(e.target.value))} hint="Customers see the end date only if one is set." />
                        <Input label="Time zone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} hint="Dates are entered in your browser's local time." />
                    </div>
                </Panel>
                <Panel title="Visibility and promotion">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Checkbox checked={form.showOnHomepage} onChange={(e) => set('showOnHomepage', e.target.checked)} label="Show on homepage and product badges" />
                        <Input label="Banner text" value={form.bannerText} onChange={(e) => set('bannerText', e.target.value)} placeholder="e.g. Launch week: 20% off" />
                        <Checkbox checked={form.promoteViaEmail} onChange={(e) => set('promoteViaEmail', e.target.checked)} label="Promote in email campaigns" />
                        <Checkbox checked={form.promoteViaNotification} onChange={(e) => set('promoteViaNotification', e.target.checked)} label="Promote via browser notifications" />
                        <Checkbox checked={form.active} onChange={(e) => set('active', e.target.checked)} label="Active (live within its schedule)" />
                    </div>
                </Panel>
            </div>
        </Modal>
    );
}

function Redemptions({ offer, onClose }) {
    const [page, setPage] = useState(1);
    const { data, loading } = useAdminData(`/admin/offers/${offer._id}/redemptions`, { page });
    return (
        <Modal open onClose={onClose} title={`Redemptions: ${offer.name}`} size="lg">
            {data && <p className="mb-3 text-sm">{data.summary.uses} uses · {money(data.summary.discount)} discount given · {money(data.summary.revenue)} associated sales</p>}
            <DataTable loading={loading} rows={data?.items} pagination={data?.pagination} onPage={setPage} empty="Not used yet." columns={[
                { key: 'order', label: 'Order', render: (r) => r.order?.orderNumber },
                { key: 'email', label: 'Customer' },
                { key: 'discount', label: 'Discount', render: (r) => money(r.discount) },
                { key: 'orderTotal', label: 'Order total', render: (r) => money(r.orderTotal) },
                { key: 'createdAt', label: 'Date', render: (r) => dateTime(r.createdAt) },
            ]} />
        </Modal>
    );
}

export default function Offers() {
    const [type, setType] = useState('');
    const { data, loading, error, reload } = useAdminData('/admin/offers', { type: type || undefined });
    const { busy, run } = useAction();
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [viewing, setViewing] = useState(null);
    const state = (o, action) => run(`${o._id}${action}`, () => api.post(`/admin/offers/${o._id}/state`, { action }).then((x) => x.data)).then(reload);
    return (
        <div>
            <PageHeader title="Coupons and offers" description="Discounts are always recalculated on the server. Changing an offer never alters completed orders." actions={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> New offer</Button>} />
            <Alert tone="info" className="mb-4">Only show genuine discounts. Original prices must be real previous prices, and expiry dates must be real.</Alert>
            <Tabs value={type} onChange={setType} tabs={[{ value: '', label: 'All' }, { value: 'coupon', label: 'Coupon codes' }, { value: 'automatic', label: 'Automatic sales' }]} />
            <div className="mt-4">
                <DataTable
                    loading={loading}
                    error={error}
                    rows={data}
                    empty="No offers yet."
                    columns={[
                        { key: 'name', label: 'Offer', render: (r) => <><p className="font-medium">{r.name}</p>{r.couponCode ? <code className="rounded bg-surface px-1.5 text-xs">{r.couponCode}</code> : <span className="text-xs text-muted">Automatic</span>}</> },
                        { key: 'discount', label: 'Discount', render: (r) => <>{describe(r)}<p className="text-xs text-muted">{r.appliesTo === 'all' ? 'All products' : r.appliesTo === 'products' ? `${r.products.length} product(s)` : `${r.categories.length} categor${r.categories.length === 1 ? 'y' : 'ies'}`}</p></> },
                        { key: 'window', label: 'Schedule', render: (r) => <span className="text-xs">{r.startsAt ? dateTime(r.startsAt) : 'Now'} → {r.endsAt ? dateTime(r.endsAt) : 'No end'}</span> },
                        { key: 'uses', label: 'Uses', render: (r) => `${r.redemptionCount}${r.redemptionLimit ? ` / ${r.redemptionLimit}` : ''}` },
                        { key: 'state', label: 'State', render: (r) => <div className="flex flex-wrap gap-1"><StatusBadge status={r.state} />{r.showOnHomepage && <Badge tone="blue">Public</Badge>}</div> },
                        { key: 'actions', label: '', className: 'text-right', render: (r) => (
                            <div className="flex flex-wrap justify-end gap-1">
                                {r.active ? <Button size="sm" variant="ghost" title="Deactivate" loading={busy === `${r._id}deactivate`} onClick={() => state(r, 'deactivate')}><Power className="h-4 w-4 text-danger" /></Button> : <Button size="sm" variant="ghost" title="Activate" loading={busy === `${r._id}activate`} onClick={() => state(r, 'activate')}><Power className="h-4 w-4 text-brand" /></Button>}
                                {r.active && (r.paused ? <Button size="sm" variant="ghost" title="Resume" onClick={() => state(r, 'resume')}><Play className="h-4 w-4" /></Button> : <Button size="sm" variant="ghost" title="Pause" onClick={() => state(r, 'pause')}><Pause className="h-4 w-4" /></Button>)}
                                <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>Redemptions</Button>
                                <Button size="sm" variant="ghost" title="Edit" onClick={() => setEditing({ ...EMPTY, ...r })}><Pencil className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                            </div>
                        ) },
                    ]}
                />
            </div>
            {editing && <OfferForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
            {viewing && <Redemptions offer={viewing} onClose={() => setViewing(null)} />}
            <ConfirmDialog open={Boolean(deleting)} title="Delete offer?" message="Offers that have been used cannot be deleted; deactivate them instead." confirmLabel="Delete" tone="danger" loading={busy === 'del'} onClose={() => setDeleting(null)} onConfirm={async () => { await run('del', () => api.delete(`/admin/offers/${deleting._id}`).then((x) => x.data)); setDeleting(null); reload(); }} />
        </div>
    );
}
