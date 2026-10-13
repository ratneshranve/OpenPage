import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, BookCover, Button, StatusBadge } from '../../components/ui';
import { DataTable, FilterSelect, PageHeader, SearchInput, useAdminData } from '../components/kit';
import { date, money } from '../../lib/format';

export default function Products() {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const { data, loading, error } = useAdminData('/admin/products', { q: q || undefined, status: status || undefined, page });
    return (
        <div>
            <PageHeader title="Products" description="Create, publish and manage eBooks and other digital products." actions={<Button as={Link} to="/admin/products/new"><Plus className="h-4 w-4" /> New product</Button>} />
            <div className="mb-4 flex flex-wrap gap-2">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search title, slug, author, tag" className="w-full sm:w-80" />
                <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...['draft', 'published', 'unpublished', 'archived'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))]} />
            </div>
            <DataTable
                loading={loading}
                error={error}
                rows={data?.items}
                pagination={data?.pagination}
                onPage={setPage}
                onRowClick={(r) => navigate(`/admin/products/${r._id}`)}
                empty="No products yet. Create your first eBook."
                columns={[
                    { key: 'title', label: 'Product', render: (r) => (
                        <div className="flex items-center gap-3">
                            <div className="w-9 shrink-0"><BookCover src={r.coverImage?.url} title={r.title} className="rounded" /></div>
                            <div className="min-w-0">
                                <p className="font-medium">{r.title}</p>
                                <p className="text-xs text-muted">/{r.slug}</p>
                            </div>
                        </div>
                    ) },
                    { key: 'category', label: 'Category', render: (r) => r.category?.name || '—' },
                    { key: 'price', label: 'Price', render: (r) => <>{money(r.price, r.currency)}{r.compareAtPrice && <span className="ml-1 text-xs text-muted line-through">{money(r.compareAtPrice)}</span>}</> },
                    { key: 'status', label: 'Status', render: (r) => <div className="flex flex-wrap gap-1"><StatusBadge status={r.status} />{r.featured && <Badge tone="blue">Featured</Badge>}</div> },
                    { key: 'file', label: 'File', render: (r) => (r.file?.version ? `v${r.file.version} · ${r.file.format}` : <Badge tone="red">No file</Badge>) },
                    { key: 'salesCount', label: 'Sales', className: 'text-right' },
                    { key: 'updatedAt', label: 'Updated', render: (r) => date(r.updatedAt) },
                ]}
            />
        </div>
    );
}
