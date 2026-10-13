import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge, Button, Checkbox, ConfirmDialog, Input, Modal, StatusBadge, Textarea } from '../../components/ui';
import { DataTable, FilterSelect, ImageField, PageHeader, useAction, useAdminData } from '../components/kit';
import { api } from '../../lib/api';
import { date } from '../../lib/format';

const EMPTY = { name: '', slug: '', description: '', image: '', icon: '', visible: true, seo: { title: '', description: '', noindex: false } };

function Categories() {
    const { data, loading, error, reload, setData } = useAdminData('/admin/categories');
    const { busy, run } = useAction();
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const save = async () => {
        const body = { ...editing, seo: editing.seo || {} };
        delete body._id;
        ['productCount', 'publishedCount', 'createdAt', 'updatedAt', '__v', 'order'].forEach((k) => delete body[k]);
        if (!body.slug) delete body.slug;
        const r = await run('save', () => (editing._id ? api.patch(`/admin/categories/${editing._id}`, body) : api.post('/admin/categories', body)).then((x) => x.data));
        if (r) {
            setEditing(null);
            reload();
        }
    };
    const move = async (i, d) => {
        const list = [...data];
        [list[i], list[i + d]] = [list[i + d], list[i]];
        setData(list);
        await run('order', () => api.post('/admin/categories/reorder', { ids: list.map((c) => c._id) }).then((x) => x.data));
    };

    return (
        <div>
            <PageHeader title="Categories" description="Each visible category gets its own indexable landing page at /category/slug." actions={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> New category</Button>} />
            <DataTable
                loading={loading}
                error={error}
                rows={data}
                columns={[
                    { key: 'order', label: 'Order', render: (r) => { const i = data.indexOf(r); return <span className="flex gap-1"><button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button><button type="button" disabled={i === data.length - 1} onClick={() => move(i, 1)} className="p-1 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button></span>; } },
                    { key: 'name', label: 'Name', render: (r) => <><p className="font-medium">{r.name}</p><p className="text-xs text-muted">/category/{r.slug}</p></> },
                    { key: 'products', label: 'Products', render: (r) => `${r.publishedCount} published / ${r.productCount}` },
                    { key: 'visible', label: 'Visibility', render: (r) => <StatusBadge status={r.visible ? 'active' : 'inactive'} /> },
                    { key: 'actions', label: '', className: 'text-right', render: (r) => <span className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing({ ...EMPTY, ...r, seo: { ...EMPTY.seo, ...(r.seo || {}) } })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4 text-danger" /></Button></span> },
                ]}
            />
            <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit category' : 'New category'} size="lg" footer={<Button onClick={save} loading={busy === 'save'}>Save category</Button>}>
                {editing && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
                        <Input label="URL slug" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} hint="Blank to generate from name" />
                        <Textarea className="sm:col-span-2" rows={5} label="Description (Markdown)" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} hint="Helpful, original text improves the landing page for search." />
                        <div className="sm:col-span-2"><ImageField label="Image or icon" value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} folder="categories" /></div>
                        <Input label="SEO title" value={editing.seo.title || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, title: e.target.value } })} maxLength={70} />
                        <Input label="Meta description" value={editing.seo.description || ''} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, description: e.target.value } })} maxLength={170} />
                        <Checkbox checked={editing.visible} onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} label="Visible on the store" />
                        <Checkbox checked={editing.seo.noindex} onChange={(e) => setEditing({ ...editing, seo: { ...editing.seo, noindex: e.target.checked } })} label="Hide from search engines" />
                    </div>
                )}
            </Modal>
            <ConfirmDialog open={Boolean(deleting)} title="Delete category?" message={`Delete "${deleting?.name}"? Categories that still contain products cannot be deleted.`} confirmLabel="Delete" tone="danger" loading={busy === 'del'} onClose={() => setDeleting(null)} onConfirm={async () => { const r = await run('del', () => api.delete(`/admin/categories/${deleting._id}`).then((x) => x.data)); setDeleting(null); if (r) reload(); }} />
        </div>
    );
}

function Reviews() {
    const [status, setStatus] = useState('pending');
    const [page, setPage] = useState(1);
    const { data, loading, error, reload } = useAdminData('/admin/reviews', { status: status || undefined, page });
    const { run } = useAction();
    const update = async (r, body) => {
        const res = await run(r._id, () => api.patch(`/admin/reviews/${r._id}`, body).then((x) => x.data));
        if (res) reload();
    };
    return (
        <div>
            <PageHeader title="Reviews" description="Only reviews from verified purchasers can be submitted. Approve genuine reviews, positive or critical. Featured reviews appear as homepage testimonials." />
            <div className="mb-4"><FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]} /></div>
            <DataTable
                loading={loading}
                error={error}
                rows={data?.items}
                pagination={data?.pagination}
                onPage={setPage}
                empty="No reviews in this list."
                columns={[
                    { key: 'product', label: 'Product', render: (r) => r.product?.title },
                    { key: 'rating', label: 'Rating', render: (r) => <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{r.rating}</span> },
                    { key: 'body', label: 'Review', className: 'max-w-md', render: (r) => <><p className="font-medium">{r.title}</p><p className="text-ink-soft">{r.body}</p><p className="text-xs text-muted">{r.displayName} · {r.email} · {date(r.createdAt)}</p></> },
                    { key: 'status', label: 'Status', render: (r) => <div className="flex flex-col gap-1"><StatusBadge status={r.status} />{r.featured && <Badge tone="blue">Featured</Badge>}</div> },
                    { key: 'actions', label: '', render: (r) => (
                        <div className="flex flex-wrap gap-1">
                            {r.status !== 'approved' && <Button size="sm" onClick={() => update(r, { status: 'approved' })}>Approve</Button>}
                            {r.status !== 'rejected' && <Button size="sm" variant="outline" onClick={() => update(r, { status: 'rejected', featured: false })}>Reject</Button>}
                            {r.status === 'approved' && <Button size="sm" variant="ghost" onClick={() => update(r, { featured: !r.featured })}>{r.featured ? 'Unfeature' : 'Feature'}</Button>}
                        </div>
                    ) },
                ]}
            />
        </div>
    );
}

export default function CatalogAdmin({ view }) {
    return view === 'reviews' ? <Reviews /> : <Categories />;
}
