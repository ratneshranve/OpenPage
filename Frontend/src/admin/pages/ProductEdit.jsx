import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, Eye, EyeOff, FileUp, Save, Send, Upload } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, Input, PageLoader, Select, StatusBadge, Tabs, Textarea, Toggle } from '../../components/ui';
import { DataTable, ImageField, KeyValue, MoneyInput, ObjectListEditor, PageHeader, Panel, StringListEditor, toLocalInput, fromLocalInput, uploadImages, useAction, useAdminData } from '../components/kit';
import { api, get, errorMessage } from '../../lib/api';
import { date, dateTime, fileSize, money } from '../../lib/format';

const EMPTY = {
    title: '', slug: '', subtitle: '', shortDescription: '', description: '', author: '', publisher: 'OpenPage', category: '', tags: [], keyBenefits: [], audience: [], tableOfContents: [], faqs: [],
    coverImage: null, previewImages: [], productType: 'ebook', price: null, compareAtPrice: null, currency: 'INR', featured: false, language: 'English', format: 'PDF', pageCount: '', license: '', publishedAt: null,
    seo: { title: '', description: '', primaryKeyword: '', keywords: [], canonicalUrl: '', ogTitle: '', ogDescription: '', ogImage: '', noindex: false },
};

const editable = (p) => {
    const out = {};
    for (const k of Object.keys(EMPTY)) out[k] = p[k] ?? EMPTY[k];
    out.category = p.category?._id || p.category || '';
    out.seo = { ...EMPTY.seo, ...(p.seo || {}) };
    return out;
};

export default function ProductEdit() {
    const { id } = useParams();
    const isNew = !id;
    const navigate = useNavigate();
    const [tab, setTab] = useState('details');
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [categories, setCategories] = useState([]);
    const { data, loading, error, reload } = useAdminData(isNew ? null : `/admin/products/${id}`, null, { skip: isNew });
    const { busy, run } = useAction();
    const [confirm, setConfirm] = useState(null);

    useEffect(() => {
        get('/admin/categories').then(setCategories).catch(() => {});
    }, []);
    useEffect(() => {
        if (data?.product) setForm(editable(data.product));
    }, [data]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const setSeo = (k, v) => setForm((f) => ({ ...f, seo: { ...f.seo, [k]: v } }));

    const validate = () => {
        const e = {};
        if (!form.title.trim()) e.title = 'Title is required';
        if (form.price == null || form.price < 100) e.price = 'Price must be at least ₹1';
        if (form.compareAtPrice != null && form.compareAtPrice <= form.price) e.compareAtPrice = 'The original price must be higher than the current price, or left empty';
        if (form.seo.title.length > 70) e.seoTitle = 'Keep SEO titles under 70 characters';
        if (form.seo.description.length > 170) e.seoDescription = 'Keep meta descriptions under 170 characters';
        setErrors(e);
        if (Object.keys(e).length) toast.error('Please fix the highlighted fields.');
        return !Object.keys(e).length;
    };

    const payload = () => {
        const p = { ...form, category: form.category || null, pageCount: form.pageCount === '' ? null : Number(form.pageCount), compareAtPrice: form.compareAtPrice ?? null };
        if (!p.slug) delete p.slug;
        if (!p.coverImage?.url) p.coverImage = null;
        return p;
    };

    const save = async () => {
        if (!validate()) return;
        const r = await run('save', () => (isNew ? api.post('/admin/products', payload()) : api.patch(`/admin/products/${id}`, payload())).then((x) => x.data));
        if (r && isNew) navigate(`/admin/products/${r.data._id}`, { replace: true });
        else if (r) reload();
    };

    const setStatus = async (status) => {
        const r = await run(status, () => api.post(`/admin/products/${id}/status`, { status }).then((x) => x.data));
        setConfirm(null);
        if (r) reload();
    };

    if (!isNew && loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const product = data?.product;

    return (
        <div className="space-y-6">
            <PageHeader
                back={{ to: '/admin/products', label: 'Products' }}
                title={isNew ? 'New product' : product?.title}
                description={!isNew && <span className="flex flex-wrap items-center gap-2"><StatusBadge status={product.status} /> {product.status === 'published' && <a href={`/ebooks/${product.slug}`} target="_blank" rel="noreferrer">View on store</a>}</span>}
                actions={
                    <>
                        {!isNew && product.status !== 'published' && <Button variant="secondary" onClick={() => setStatus('published')} loading={busy === 'published'}><Send className="h-4 w-4" /> Publish</Button>}
                        {!isNew && product.status === 'published' && <Button variant="outline" onClick={() => setConfirm('unpublished')}><EyeOff className="h-4 w-4" /> Unpublish</Button>}
                        {!isNew && product.status !== 'archived' && <Button variant="outline" onClick={() => setConfirm('archived')}><Archive className="h-4 w-4" /> Archive</Button>}
                        {!isNew && product.status === 'archived' && <Button variant="outline" onClick={() => setStatus('draft')}><Eye className="h-4 w-4" /> Restore to draft</Button>}
                        <Button onClick={save} loading={busy === 'save'}><Save className="h-4 w-4" /> {isNew ? 'Save draft' : 'Save changes'}</Button>
                    </>
                }
            />
            {isNew && <Alert tone="info">Save the product as a draft first, then upload the eBook file and cover image before publishing.</Alert>}
            {!isNew && !product.file && <Alert tone="warning" title="No eBook file uploaded">Upload the private eBook file in the “File & versions” tab before publishing.</Alert>}

            <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: 'details', label: 'Details' },
                    { value: 'content', label: 'Content' },
                    { value: 'media', label: 'Cover & previews' },
                    { value: 'pricing', label: 'Pricing' },
                    { value: 'seo', label: 'SEO' },
                    ...(isNew ? [] : [{ value: 'file', label: 'File & versions' }, { value: 'sales', label: 'Sales & history' }]),
                ]}
            />

            {tab === 'details' && (
                <Panel>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input className="sm:col-span-2" label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} required />
                        <Input label="URL slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} hint={`Leave blank to generate from the title. URL: /ebooks/${form.slug || '…'}`} />
                        <Input label="Subtitle" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
                        <Textarea className="sm:col-span-2" label="Short description" rows={2} maxLength={400} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} hint={`${form.shortDescription.length}/400 · shown on product cards and as the default meta description`} />
                        <Input label="Author" value={form.author} onChange={(e) => set('author', e.target.value)} />
                        <Input label="Publisher" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
                        <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="No category" options={categories.map((c) => ({ value: c._id, label: c.name }))} />
                        <Select label="Product type" value={form.productType} onChange={(e) => set('productType', e.target.value)} options={['ebook', 'template', 'checklist', 'guide', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
                        <Input label="Language" value={form.language} onChange={(e) => set('language', e.target.value)} />
                        <Input label="Page count" type="number" min="0" value={form.pageCount ?? ''} onChange={(e) => set('pageCount', e.target.value)} />
                        <Input label="Publication date" type="datetime-local" value={toLocalInput(form.publishedAt)} onChange={(e) => set('publishedAt', fromLocalInput(e.target.value))} hint="Set automatically on first publish if empty." />
                        <div className="flex items-end pb-2"><Toggle checked={form.featured} onChange={(v) => set('featured', v)} label="Featured" description="Show in the Featured section on the homepage" /></div>
                        <div className="sm:col-span-2"><StringListEditor label="Tags and keywords" value={form.tags} onChange={(v) => set('tags', v.map((t) => t.toLowerCase()))} placeholder="e.g. automation" hint="Used for search and related products." /></div>
                    </div>
                </Panel>
            )}

            {tab === 'content' && (
                <div className="space-y-6">
                    <Panel title="Description" description="Markdown supported: **bold**, lists, headings, links.">
                        <Textarea rows={12} value={form.description} onChange={(e) => set('description', e.target.value)} />
                    </Panel>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Panel><StringListEditor label="Key benefits" value={form.keyBenefits} onChange={(v) => set('keyBenefits', v)} placeholder="What will the reader gain?" /></Panel>
                        <Panel><StringListEditor label="Intended audience" value={form.audience} onChange={(v) => set('audience', v)} placeholder="Who is it for?" /></Panel>
                    </div>
                    <Panel><StringListEditor label="Table of contents" value={form.tableOfContents} onChange={(v) => set('tableOfContents', v)} placeholder="Chapter title" /></Panel>
                    <Panel><ObjectListEditor label="Product FAQs" value={form.faqs} onChange={(v) => set('faqs', v)} itemLabel="question" newItem={{ question: '', answer: '' }} fields={[{ key: 'question', label: 'Question', wide: true }, { key: 'answer', label: 'Answer', type: 'textarea' }]} /></Panel>
                    <Panel title="Licence terms"><Textarea rows={4} value={form.license} onChange={(e) => set('license', e.target.value)} hint="Shown on the product page. Leave blank to use the standard personal licence text." /></Panel>
                </div>
            )}

            {tab === 'media' && (
                <div className="space-y-6">
                    <Panel title="Cover image" description="Recommended 3:4 ratio, at least 900×1200px, JPG/PNG/WebP.">
                        <ImageField value={form.coverImage?.url} onChange={(url) => set('coverImage', { url, alt: form.coverImage?.alt || `Cover of ${form.title}` })} folder="covers" />
                        <Input className="mt-3" label="Cover alt text" value={form.coverImage?.alt || ''} onChange={(e) => set('coverImage', { ...(form.coverImage || {}), alt: e.target.value })} hint="Describe the cover for screen readers and search engines." />
                    </Panel>
                    <Panel title="Preview images" description="Sample pages shown in the product gallery.">
                        <PreviewImages value={form.previewImages} onChange={(v) => set('previewImages', v)} />
                    </Panel>
                    {!isNew && <SampleUpload product={product} onDone={reload} />}
                    <p className="text-sm text-muted">Remember to save the product after changing images.</p>
                </div>
            )}

            {tab === 'pricing' && (
                <Panel title="Pricing" description="Amounts in rupees. All discounts shown to customers are recalculated on the server.">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <MoneyInput label="Current price (₹)" value={form.price} onChange={(v) => set('price', v)} error={errors.price} required />
                        <MoneyInput label="Original price (₹)" value={form.compareAtPrice} onChange={(v) => set('compareAtPrice', v)} error={errors.compareAtPrice} hint="Optional. Only enter a genuine previous price." />
                        <Input label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} hint="Razorpay supports INR by default." />
                    </div>
                    {form.compareAtPrice > form.price && <p className="mt-3 text-sm text-brand">Customers will see {Math.round(((form.compareAtPrice - form.price) / form.compareAtPrice) * 100)}% off.</p>}
                    <p className="mt-4 text-sm text-muted">Time-limited sales, category discounts and coupons are managed in <Link to="/admin/offers">Coupons & offers</Link>.</p>
                </Panel>
            )}

            {tab === 'seo' && (
                <Panel title="Search engine and social sharing">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input className="sm:col-span-2" label="SEO title" value={form.seo.title} onChange={(e) => setSeo('title', e.target.value)} error={errors.seoTitle} hint={`${form.seo.title.length}/70 · defaults to the product title`} />
                        <Textarea className="sm:col-span-2" rows={2} label="Meta description" value={form.seo.description} onChange={(e) => setSeo('description', e.target.value)} error={errors.seoDescription} hint={`${form.seo.description.length}/170 · defaults to the short description`} />
                        <Input label="Primary keyword" value={form.seo.primaryKeyword} onChange={(e) => setSeo('primaryKeyword', e.target.value)} />
                        <Input label="Canonical URL (optional)" value={form.seo.canonicalUrl} onChange={(e) => setSeo('canonicalUrl', e.target.value)} hint="Only if this content lives primarily at another URL." />
                        <div className="sm:col-span-2"><StringListEditor label="Supporting keywords" value={form.seo.keywords} onChange={(v) => setSeo('keywords', v)} /></div>
                        <Input label="Social sharing title" value={form.seo.ogTitle} onChange={(e) => setSeo('ogTitle', e.target.value)} />
                        <Input label="Social sharing description" value={form.seo.ogDescription} onChange={(e) => setSeo('ogDescription', e.target.value)} />
                        <div className="sm:col-span-2"><ImageField label="Social image (1200×630 recommended)" value={form.seo.ogImage} onChange={(v) => setSeo('ogImage', v)} folder="social" hint="Defaults to the cover image." /></div>
                        <Checkbox className="sm:col-span-2" checked={form.seo.noindex} onChange={(e) => setSeo('noindex', e.target.checked)} label="Hide this product from search engines (noindex)" />
                    </div>
                    <div className="mt-5 rounded-xl border border-line p-4">
                        <p className="text-xs text-muted">Search preview</p>
                        <p className="mt-1 truncate text-lg text-accent">{form.seo.title || form.title || 'Product title'} | OpenPage</p>
                        <p className="text-xs text-brand">{window.location.origin}/ebooks/{form.slug || 'slug'}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{form.seo.description || form.shortDescription || 'Meta description…'}</p>
                    </div>
                </Panel>
            )}

            {tab === 'file' && !isNew && <FileVersions product={product} versions={data.entitlementVersions} onDone={reload} />}

            {tab === 'sales' && !isNew && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="card p-4"><p className="text-sm text-muted">Units sold</p><p className="text-2xl font-bold">{data.sales.units}</p></div>
                        <div className="card p-4"><p className="text-sm text-muted">Revenue</p><p className="text-2xl font-bold">{money(data.sales.revenue)}</p></div>
                        <div className="card p-4"><p className="text-sm text-muted">Rating</p><p className="text-2xl font-bold">{product.ratingCount ? `${product.ratingAverage.toFixed(1)} (${product.ratingCount})` : '—'}</p></div>
                    </div>
                    <Panel title="Update history">
                        <DataTable
                            rows={data.history}
                            empty="No changes recorded."
                            columns={[
                                { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
                                { key: 'action', label: 'Action' },
                                { key: 'actorEmail', label: 'By' },
                                { key: 'details', label: 'Details', render: (r) => <code className="text-xs">{JSON.stringify(r.details)?.slice(0, 120)}</code> },
                            ]}
                        />
                    </Panel>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(confirm)}
                title={confirm === 'archived' ? 'Archive product?' : 'Unpublish product?'}
                message={`This stops new purchases and hides the product from the store. Customers who already bought it keep access to their downloads.`}
                confirmLabel={confirm === 'archived' ? 'Archive' : 'Unpublish'}
                tone="danger"
                loading={busy === confirm}
                onConfirm={() => setStatus(confirm)}
                onClose={() => setConfirm(null)}
            />
        </div>
    );
}

function PreviewImages({ value, onChange }) {
    const [busy, setBusy] = useState(false);
    const onFiles = async (e) => {
        if (!e.target.files?.length) return;
        setBusy(true);
        try {
            const urls = await uploadImages(e.target.files, 'previews');
            onChange([...value, ...urls.map((url, i) => ({ url, alt: `Preview page ${value.length + i + 1}` }))]);
            toast.success('Images uploaded.');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy(false);
            e.target.value = '';
        }
    };
    return (
        <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {value.map((img, i) => (
                    <div key={img.url} className="relative">
                        <img src={img.url} alt={img.alt} className="aspect-[3/4] w-full rounded-lg object-cover ring-1 ring-line" />
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-danger shadow">Remove</button>
                    </div>
                ))}
            </div>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface">
                <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Upload preview images'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={onFiles} disabled={busy} />
            </label>
        </div>
    );
}

function SampleUpload({ product, onDone }) {
    const [busy, setBusy] = useState(false);
    const onFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const r = await api.post(`/admin/products/${product._id}/sample`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(r.data.message);
            onDone();
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy(false);
            e.target.value = '';
        }
    };
    return (
        <Panel title="Free sample (optional)" description="A short PDF excerpt customers can download before buying.">
            <p className="mb-3 text-sm">{product.sampleFile?.key ? <>Current sample: <strong>{product.sampleFile.originalName}</strong> ({fileSize(product.sampleFile.size)})</> : 'No sample uploaded.'}</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface">
                <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : product.sampleFile?.key ? 'Replace sample' : 'Upload sample PDF'}
                <input type="file" accept="application/pdf" className="sr-only" onChange={onFile} disabled={busy} />
            </label>
        </Panel>
    );
}

function FileVersions({ product, versions, onDone }) {
    const [file, setFile] = useState(null);
    const [version, setVersion] = useState('');
    const [notes, setNotes] = useState('');
    const [apply, setApply] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState('');

    const upload = async (e) => {
        e.preventDefault();
        setError('');
        if (!file) return setError('Choose a PDF, EPUB or ZIP file.');
        if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/.test(version)) return setError('Enter a version label such as 1.0, 1.1 or 2024.1');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('version', version);
        fd.append('notes', notes);
        fd.append('applyToExistingPurchases', String(apply));
        setProgress(0);
        try {
            const r = await api.post(`/admin/products/${product._id}/file`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 0,
                onUploadProgress: (p) => setProgress(p.total ? Math.round((p.loaded / p.total) * 100) : null),
            });
            toast.success(r.data.message);
            setFile(null);
            setVersion('');
            setNotes('');
            setApply(false);
            onDone();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setProgress(null);
        }
    };

    const all = [product.file, ...(product.fileHistory || []).slice().reverse()].filter(Boolean);
    return (
        <div className="space-y-6">
            <Panel title="Current file">
                {product.file ? (
                    <KeyValue
                        items={[
                            ['Version', product.file.version],
                            ['Format', product.file.format],
                            ['Size', fileSize(product.file.size)],
                            ['Original name', product.file.originalName],
                            ['Uploaded', dateTime(product.file.uploadedAt)],
                            ['SHA-256', <code key="h" className="text-xs">{product.file.sha256?.slice(0, 16)}…</code>],
                        ]}
                    />
                ) : (
                    <p className="text-sm text-muted">No file uploaded yet.</p>
                )}
                <p className="mt-3 text-xs text-muted">Files are stored in private storage and are only reachable through time-limited, purchase-checked download links.</p>
            </Panel>
            <Panel title="Upload a new version">
                <form onSubmit={upload} className="grid gap-4 sm:grid-cols-2" noValidate>
                    {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
                    <label className="sm:col-span-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-center hover:bg-surface">
                        <FileUp className="h-8 w-8 text-accent" />
                        <span className="text-sm font-medium">{file ? `${file.name} (${fileSize(file.size)})` : 'Choose eBook file (PDF, EPUB or ZIP)'}</span>
                        <span className="text-xs text-muted">The real file type is checked on the server.</span>
                        <input type="file" accept=".pdf,.epub,.zip,application/pdf,application/epub+zip,application/zip" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <Input label="Version label" placeholder="e.g. 1.1" value={version} onChange={(e) => setVersion(e.target.value)} required />
                    <Input label="Change notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <Checkbox
                        className="sm:col-span-2"
                        checked={apply}
                        onChange={(e) => setApply(e.target.checked)}
                        label="Also give this version to existing purchasers"
                        description="Leave unchecked to keep each past customer on the version they bought. New purchases always get the latest version."
                    />
                    <div className="sm:col-span-2 flex items-center gap-3">
                        <Button type="submit" loading={progress !== null}><Upload className="h-4 w-4" /> Upload version</Button>
                        {progress !== null && <span className="text-sm text-muted">{progress}%</span>}
                    </div>
                </form>
            </Panel>
            <Panel title="Version history">
                <DataTable
                    rows={all}
                    rowKey={(r) => r.version}
                    columns={[
                        { key: 'version', label: 'Version', render: (r) => <>{r.version} {r.version === product.file?.version && <Badge tone="green">Current</Badge>}</> },
                        { key: 'format', label: 'Format' },
                        { key: 'size', label: 'Size', render: (r) => fileSize(r.size) },
                        { key: 'uploadedAt', label: 'Uploaded', render: (r) => date(r.uploadedAt) },
                        { key: 'owners', label: 'Customers on this version', className: 'text-right', render: (r) => versions?.find((v) => v._id === r.version)?.count || 0 },
                        { key: 'notes', label: 'Notes' },
                    ]}
                />
            </Panel>
        </div>
    );
}
