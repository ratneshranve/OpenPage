import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Save, Trash2, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, Input, Modal, PageLoader, Select, StatusBadge, Tabs, Textarea, Toggle } from '../../components/ui';
import { Markdown } from '../../components/layout/Extras';
import { DataTable, FilterSelect, ImageField, KeyValue, ObjectListEditor, PageHeader, Panel, StringListEditor, useAction, useAdminData } from '../components/kit';
import { api, get, post, put, errorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { dateTime } from '../../lib/format';

/** Loads one settings section into local state and saves it back. */
function useSection(section) {
    const { data, loading, error, reload } = useAdminData(`/admin/settings/${section}`);
    const { reload: reloadPublic } = useConfig();
    const [value, setValue] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (data) setValue(data);
    }, [data]);
    const save = async (override) => {
        setSaving(true);
        try {
            const r = await put(`/admin/settings/${section}`, override || value);
            setValue(r.data);
            toast.success(r.message);
            reloadPublic();
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setSaving(false);
        }
    };
    const set = (path, v) =>
        setValue((cur) => {
            const next = structuredClone(cur);
            const keys = path.split('.');
            let o = next;
            keys.slice(0, -1).forEach((k) => {
                o[k] = o[k] ?? {};
                o = o[k];
            });
            o[keys.at(-1)] = v;
            return next;
        });
    return { value, set, save, saving, loading: loading || !value, error, reload };
}

const SaveButton = ({ s }) => <Button onClick={() => s.save()} loading={s.saving}><Save className="h-4 w-4" /> Save changes</Button>;

// ---------------- SEO ----------------
function Seo() {
    const s = useSection('seo');
    const status = useAdminData('/admin/seo');
    const redirects = useAdminData('/admin/seo/redirects');
    const { busy, run } = useAction();
    const [redirect, setRedirect] = useState(null);
    if (s.loading) return <PageLoader />;
    const v = s.value;
    return (
        <div className="space-y-6">
            <PageHeader title="SEO manager" description="Site-wide metadata, robots rules, sitemap and redirects. Product and category SEO fields are edited on each product and category." actions={<SaveButton s={s} />} />
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Defaults">
                    <div className="space-y-4">
                        <Input label="Default site title" value={v.defaultTitle} onChange={(e) => s.set('defaultTitle', e.target.value)} />
                        <Input label="Title template" value={v.titleTemplate} onChange={(e) => s.set('titleTemplate', e.target.value)} hint="%s is replaced by the page title, e.g. “%s | OpenPage”" />
                        <Textarea label="Default meta description" rows={3} value={v.defaultDescription} onChange={(e) => s.set('defaultDescription', e.target.value)} hint={`${v.defaultDescription.length}/160`} />
                        <ImageField label="Default social sharing image" value={v.defaultOgImage} onChange={(x) => s.set('defaultOgImage', x)} folder="social" />
                        <Input label="Twitter/X handle" value={v.twitterHandle} onChange={(e) => s.set('twitterHandle', e.target.value)} placeholder="@openpage" />
                    </div>
                </Panel>
                <Panel title="Homepage metadata">
                    <div className="space-y-4">
                        <Input label="Homepage title" value={v.homepage.title} onChange={(e) => s.set('homepage.title', e.target.value)} hint="Leave empty to use the default title." />
                        <Textarea label="Homepage description" rows={3} value={v.homepage.description} onChange={(e) => s.set('homepage.description', e.target.value)} />
                    </div>
                    <h3 className="mt-6 text-sm font-semibold">Organisation (structured data)</h3>
                    <div className="mt-3 space-y-4">
                        <Input label="Organisation name" value={v.organization.name} onChange={(e) => s.set('organization.name', e.target.value)} />
                        <ImageField label="Logo" value={v.organization.logo} onChange={(x) => s.set('organization.logo', x)} folder="site" />
                        <StringListEditor label="Official profiles (sameAs)" value={v.organization.sameAs} onChange={(x) => s.set('organization.sameAs', x)} placeholder="https://www.linkedin.com/company/…" />
                    </div>
                </Panel>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Structured data">
                    <div className="space-y-3">
                        {[['organization', 'Organization'], ['website', 'WebSite and site search'], ['products', 'Products and offers'], ['breadcrumbs', 'Breadcrumbs'], ['reviews', 'Ratings from approved reviews']].map(([k, label]) => (
                            <Toggle key={k} checked={v.structuredData[k]} onChange={(x) => s.set(`structuredData.${k}`, x)} label={label} />
                        ))}
                        <p className="text-xs text-muted">Structured data always mirrors visible page content. Ratings appear only when genuine approved reviews exist.</p>
                    </div>
                </Panel>
                <Panel title="Robots and indexing">
                    <StringListEditor label="Disallowed paths (never indexed)" value={v.robotsDisallow} onChange={(x) => s.set('robotsDisallow', x)} hint="Account, checkout, cart, download, admin and API paths are excluded by default." />
                    <div className="mt-4"><StringListEditor label="Additional no-index pages" value={v.noindexPaths} onChange={(x) => s.set('noindexPaths', x)} placeholder="/some-page" /></div>
                    <Textarea className="mt-4" label="Extra robots.txt lines" rows={3} value={v.extraRobots} onChange={(e) => s.set('extraRobots', e.target.value)} />
                </Panel>
            </div>
            <Panel title="Sitemap" actions={<Button size="sm" variant="outline" loading={busy === 'sm'} onClick={() => run('sm', () => post('/admin/seo/sitemap')).then(status.reload)}><RefreshCw className="h-4 w-4" /> Regenerate</Button>}>
                {status.data && (
                    <KeyValue items={[
                        ['Sitemap URL', <a key="s" href={status.data.sitemap.url} target="_blank" rel="noreferrer">{status.data.sitemap.url}</a>],
                        ['robots.txt', <a key="r" href={status.data.robotsUrl} target="_blank" rel="noreferrer">{status.data.robotsUrl}</a>],
                        ['Last generated', dateTime(status.data.sitemap.generatedAt) || 'On first request'],
                        ['URLs', status.data.sitemap.urlCount],
                    ]} />
                )}
            </Panel>
            <Panel title="Redirects" description="301 redirects for changed URLs (applied when the API serves the storefront)." actions={<Button size="sm" onClick={() => setRedirect({ from: '', to: '', statusCode: 301, active: true })}><Plus className="h-4 w-4" /> Add redirect</Button>}>
                <DataTable rows={redirects.data} loading={redirects.loading} empty="No redirects." columns={[
                    { key: 'from', label: 'From' },
                    { key: 'to', label: 'To' },
                    { key: 'statusCode', label: 'Type' },
                    { key: 'hits', label: 'Hits' },
                    { key: 'active', label: 'Active', render: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
                    { key: 'act', label: '', render: (r) => <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setRedirect(r)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => run('del', () => api.delete(`/admin/seo/redirects/${r._id}`).then((x) => x.data)).then(redirects.reload)}><Trash2 className="h-4 w-4 text-danger" /></Button></div> },
                ]} />
            </Panel>
            {redirect && (
                <Modal open onClose={() => setRedirect(null)} title={redirect._id ? 'Edit redirect' : 'Add redirect'} footer={<Button loading={busy === 'rd'} onClick={async () => { const body = { from: redirect.from, to: redirect.to, statusCode: Number(redirect.statusCode), active: redirect.active }; const r = await run('rd', () => (redirect._id ? api.patch(`/admin/seo/redirects/${redirect._id}`, body) : api.post('/admin/seo/redirects', body)).then((x) => x.data)); if (r) { setRedirect(null); redirects.reload(); } }}>Save</Button>}>
                    <div className="space-y-4">
                        <Input label="From path" placeholder="/old-url" value={redirect.from} onChange={(e) => setRedirect({ ...redirect, from: e.target.value })} />
                        <Input label="To path or URL" placeholder="/ebooks/new-url" value={redirect.to} onChange={(e) => setRedirect({ ...redirect, to: e.target.value })} />
                        <Select label="Type" value={redirect.statusCode} onChange={(e) => setRedirect({ ...redirect, statusCode: e.target.value })} options={[{ value: 301, label: '301 Permanent' }, { value: 302, label: '302 Temporary' }]} />
                        <Checkbox checked={redirect.active} onChange={(e) => setRedirect({ ...redirect, active: e.target.checked })} label="Active" />
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ---------------- Content ----------------
function Homepage() {
    const s = useSection('homepage');
    const [products, setProducts] = useState([]);
    useEffect(() => {
        get('/admin/products', { status: 'published', limit: 100 }).then((d) => setProducts(d.items)).catch(() => {});
    }, []);
    if (s.loading) return <PageLoader />;
    const v = s.value;
    const SECTIONS = [['featured', 'Featured eBooks'], ['bestsellers', 'Bestsellers'], ['recent', 'New releases'], ['categories', 'Categories'], ['banners', 'Promotional banners and offers'], ['whyUs', 'Why choose us'], ['howItWorks', 'How delivery works'], ['testimonials', 'Reviews from verified buyers'], ['faq', 'FAQ'], ['newsletter', 'Newsletter signup']];
    return (
        <div className="space-y-6">
            <div className="flex justify-end"><SaveButton s={s} /></div>
            <Panel title="Hero">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Eyebrow" value={v.hero.eyebrow} onChange={(e) => s.set('hero.eyebrow', e.target.value)} />
                    <Input label="Headline" value={v.hero.title} onChange={(e) => s.set('hero.title', e.target.value)} />
                    <Textarea className="sm:col-span-2" rows={2} label="Value proposition" value={v.hero.subtitle} onChange={(e) => s.set('hero.subtitle', e.target.value)} />
                    <Input label="Primary button text" value={v.hero.primaryCtaText} onChange={(e) => s.set('hero.primaryCtaText', e.target.value)} />
                    <Input label="Primary button link" value={v.hero.primaryCtaLink} onChange={(e) => s.set('hero.primaryCtaLink', e.target.value)} />
                    <Input label="Secondary button text" value={v.hero.secondaryCtaText} onChange={(e) => s.set('hero.secondaryCtaText', e.target.value)} />
                    <Input label="Secondary button link" value={v.hero.secondaryCtaLink} onChange={(e) => s.set('hero.secondaryCtaLink', e.target.value)} />
                    <div className="sm:col-span-2"><ImageField label="Hero image (optional; defaults to featured covers)" value={v.hero.image} onChange={(x) => s.set('hero.image', x)} folder="site" /></div>
                </div>
            </Panel>
            <Panel title="Section visibility">
                <div className="grid gap-3 sm:grid-cols-2">{SECTIONS.map(([k, label]) => <Toggle key={k} checked={v.sections[k] !== false} onChange={(x) => s.set(`sections.${k}`, x)} label={label} />)}</div>
            </Panel>
            <Panel title="Featured products" description="Choose and order featured titles. If empty, products marked “Featured” are used.">
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                    {products.map((p) => (
                        <label key={p._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface">
                            <input type="checkbox" checked={v.featuredProductIds.includes(p._id)} onChange={(e) => s.set('featuredProductIds', e.target.checked ? [...v.featuredProductIds, p._id] : v.featuredProductIds.filter((x) => x !== p._id))} />
                            {p.title}
                            {v.featuredProductIds.includes(p._id) && <Badge tone="blue">#{v.featuredProductIds.indexOf(p._id) + 1}</Badge>}
                        </label>
                    ))}
                </div>
            </Panel>
            <Panel title="Promotional banners" description="Shown only between their start and end dates. Use genuine promotions only.">
                <ObjectListEditor value={v.banners} onChange={(x) => s.set('banners', x)} itemLabel="banner" newItem={{ title: '', text: '', link: '/ebooks', imageUrl: '', active: true, startsAt: '', endsAt: '' }} fields={[{ key: 'title', label: 'Title' }, { key: 'link', label: 'Link' }, { key: 'text', label: 'Text', type: 'textarea', rows: 2 }, { key: 'startsAt', label: 'Starts', type: 'datetime-local' }, { key: 'endsAt', label: 'Ends', type: 'datetime-local' }, { key: 'imageUrl', label: 'Image', type: 'image', folder: 'banners' }, { key: 'active', label: 'Active', type: 'checkbox' }]} />
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Why buy from us"><ObjectListEditor value={v.whyUs} onChange={(x) => s.set('whyUs', x)} itemLabel="reason" newItem={{ title: '', text: '' }} fields={[{ key: 'title', label: 'Title', wide: true }, { key: 'text', label: 'Text', type: 'textarea', rows: 2 }]} /></Panel>
                <Panel title="How digital delivery works"><ObjectListEditor value={v.howItWorks} onChange={(x) => s.set('howItWorks', x)} itemLabel="step" newItem={{ title: '', text: '' }} fields={[{ key: 'title', label: 'Title', wide: true }, { key: 'text', label: 'Text', type: 'textarea', rows: 2 }]} /></Panel>
            </div>
            <Panel title="FAQ (homepage and /faq)"><ObjectListEditor value={v.faqs} onChange={(x) => s.set('faqs', x)} itemLabel="question" newItem={{ question: '', answer: '' }} fields={[{ key: 'question', label: 'Question', wide: true }, { key: 'answer', label: 'Answer', type: 'textarea' }]} /></Panel>
            <Panel title="Newsletter section">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Title" value={v.newsletter.title} onChange={(e) => s.set('newsletter.title', e.target.value)} />
                    <Input label="Text" value={v.newsletter.text} onChange={(e) => s.set('newsletter.text', e.target.value)} />
                </div>
            </Panel>
        </div>
    );
}

function General() {
    const s = useSection('general');
    const c = useSection('contact');
    if (s.loading || c.loading) return <PageLoader />;
    const v = s.value;
    return (
        <div className="space-y-6">
            <Panel title="Brand and business" actions={<SaveButton s={s} />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Site name" value={v.siteName} onChange={(e) => s.set('siteName', e.target.value)} />
                    <Input label="Tagline" value={v.tagline} onChange={(e) => s.set('tagline', e.target.value)} />
                    <div className="sm:col-span-2"><ImageField label="Logo (optional)" value={v.logoUrl} onChange={(x) => s.set('logoUrl', x)} folder="site" /></div>
                    <Input label="Legal business name" value={v.businessName} onChange={(e) => s.set('businessName', e.target.value)} />
                    <Input label="Governing law / jurisdiction" value={v.governingLaw} onChange={(e) => s.set('governingLaw', e.target.value)} />
                    <Textarea className="sm:col-span-2" rows={2} label="Business address" value={v.businessAddress} onChange={(e) => s.set('businessAddress', e.target.value)} />
                    <Input label="Support email" type="email" value={v.supportEmail} onChange={(e) => s.set('supportEmail', e.target.value)} />
                    <Input label="Contact phone" value={v.contactPhone} onChange={(e) => s.set('contactPhone', e.target.value)} />
                    <Input label="Support hours" value={v.supportHours} onChange={(e) => s.set('supportHours', e.target.value)} />
                    <Input label="Expected response time" value={v.responseTime} onChange={(e) => s.set('responseTime', e.target.value)} />
                </div>
                <h3 className="mt-6 text-sm font-semibold">Social links</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {Object.keys(v.social).map((k) => <Input key={k} label={k[0].toUpperCase() + k.slice(1)} value={v.social[k]} onChange={(e) => s.set(`social.${k}`, e.target.value)} placeholder="https://…" />)}
                </div>
            </Panel>
            <Panel title="Contact page" actions={<SaveButton s={c} />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Contact email" value={c.value.email} onChange={(e) => c.set('email', e.target.value)} />
                    <Input label="Contact phone" value={c.value.phone} onChange={(e) => c.set('phone', e.target.value)} />
                    <Textarea className="sm:col-span-2" rows={2} label="Address" value={c.value.address} onChange={(e) => c.set('address', e.target.value)} />
                    <Textarea className="sm:col-span-2" rows={2} label="Intro text" value={c.value.intro} onChange={(e) => c.set('intro', e.target.value)} />
                </div>
            </Panel>
        </div>
    );
}

function Footer() {
    const s = useSection('footer');
    if (s.loading) return <PageLoader />;
    return (
        <Panel title="Footer" actions={<SaveButton s={s} />}>
            <div className="space-y-4">
                <Textarea label="About text" rows={2} value={s.value.about} onChange={(e) => s.set('about', e.target.value)} />
                <Input label="Copyright line (optional)" value={s.value.copyright} onChange={(e) => s.set('copyright', e.target.value)} />
                {s.value.columns.map((col, i) => (
                    <div key={i} className="rounded-xl border border-line p-4">
                        <div className="flex items-end gap-2">
                            <Input className="flex-1" label="Column title" value={col.title} onChange={(e) => s.set('columns', s.value.columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)))} />
                            <Button variant="ghost" onClick={() => s.set('columns', s.value.columns.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-danger" /></Button>
                        </div>
                        <div className="mt-3"><ObjectListEditor value={col.links} onChange={(links) => s.set('columns', s.value.columns.map((c, j) => (j === i ? { ...c, links } : c)))} itemLabel="link" newItem={{ label: '', href: '/' }} fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'Link' }]} /></div>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => s.set('columns', [...s.value.columns, { title: 'New column', links: [] }])}><Plus className="h-4 w-4" /> Add column</Button>
            </div>
        </Panel>
    );
}

function Content() {
    const [tab, setTab] = useState('homepage');
    return (
        <div className="space-y-6">
            <PageHeader title="Homepage and content" description="Changes appear on the website immediately; no code changes needed. About, FAQ answers and legal pages live under Legal pages." />
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'homepage', label: 'Homepage' }, { value: 'general', label: 'Brand, contact & support' }, { value: 'footer', label: 'Footer' }]} />
            {tab === 'homepage' && <Homepage />}
            {tab === 'general' && <General />}
            {tab === 'footer' && <Footer />}
        </div>
    );
}

// ---------------- Pages ----------------
function Pages() {
    const navigate = useNavigate();
    const [type, setType] = useState('');
    const { data, loading, error } = useAdminData('/admin/pages', { type: type || undefined });
    return (
        <div>
            <PageHeader title="Legal and content pages" description="Terms, Privacy, Refund policy, Licensing, About, Accessibility and any custom pages. Have legal pages reviewed for the jurisdictions you operate in." actions={<Button onClick={() => navigate('/admin/legal-pages/new')}><Plus className="h-4 w-4" /> New page</Button>} />
            <div className="mb-4"><FilterSelect label="Type" value={type} onChange={setType} options={[{ value: '', label: 'All pages' }, { value: 'legal', label: 'Legal' }, { value: 'content', label: 'Content' }]} /></div>
            <DataTable loading={loading} error={error} rows={data} onRowClick={(r) => navigate(`/admin/legal-pages/${r._id}`)} columns={[
                { key: 'title', label: 'Page', render: (r) => <><p className="font-medium">{r.title}</p><p className="text-xs text-muted">/{r.slug}</p></> },
                { key: 'type', label: 'Type', render: (r) => <Badge tone={r.type === 'legal' ? 'navy' : 'blue'}>{r.type}</Badge> },
                { key: 'published', label: 'Status', render: (r) => <StatusBadge status={r.published ? 'published' : 'draft'} /> },
                { key: 'version', label: 'Version' },
                { key: 'updatedAt', label: 'Updated', render: (r) => dateTime(r.updatedAt) },
            ]} />
        </div>
    );
}

function PageEdit() {
    const { id } = useParams();
    const isNew = id === 'new';
    const navigate = useNavigate();
    const { data, loading, error } = useAdminData(isNew ? null : `/admin/pages/${id}`, null, { skip: isNew });
    const [form, setForm] = useState(isNew ? { title: '', slug: '', type: 'content', body: '', published: true, seo: { title: '', description: '', noindex: false } } : null);
    const [preview, setPreview] = useState(false);
    const [del, setDel] = useState(false);
    const { busy, run } = useAction();
    useEffect(() => {
        if (data) setForm({ title: data.title, slug: data.slug, type: data.type, body: data.body, published: data.published, seo: { title: '', description: '', noindex: false, ...(data.seo || {}) } });
    }, [data]);
    if (!isNew && loading) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (!form) return null;
    const save = async () => {
        const r = await run('save', () => (isNew ? api.post('/admin/pages', form) : api.patch(`/admin/pages/${id}`, form)).then((x) => x.data));
        if (r && isNew) navigate(`/admin/legal-pages/${r.data._id}`, { replace: true });
    };
    return (
        <div className="space-y-6">
            <PageHeader back={{ to: '/admin/legal-pages', label: 'Pages' }} title={isNew ? 'New page' : form.title}
                actions={
                    <>
                        {!isNew && form.published && <Button as="a" variant="outline" href={`/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> View</Button>}
                        <Button variant="outline" onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</Button>
                        {!isNew && form.type !== 'legal' && <Button variant="outline-danger" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Button>}
                        <Button loading={busy === 'save'} onClick={save}><Save className="h-4 w-4" /> Save</Button>
                    </>
                }
            />
            {form.type === 'legal' && <Alert tone="warning">Legal text must be reviewed by a qualified professional for the jurisdictions where OpenPage operates. Do not state that refunds are impossible in all circumstances.</Alert>}
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <Panel>
                    {preview ? (
                        <><h1 className="text-3xl font-bold">{form.title}</h1><Markdown className="prose-openpage mt-4">{form.body}</Markdown></>
                    ) : (
                        <div className="space-y-4">
                            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                            <Textarea label="Content (Markdown)" rows={26} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="[&_textarea]:font-mono [&_textarea]:text-sm" hint="Use ## for headings, - for bullet lists, **bold**, [link text](/support)." />
                        </div>
                    )}
                </Panel>
                <div className="space-y-4">
                    <Panel title="Settings">
                        <div className="space-y-4">
                            <Input label="URL slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint={`/${form.slug || '…'}`} />
                            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'content', label: 'Content page' }, { value: 'legal', label: 'Legal page' }]} />
                            <Checkbox checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} label="Published" />
                        </div>
                    </Panel>
                    <Panel title="SEO">
                        <div className="space-y-4">
                            <Input label="SEO title" value={form.seo.title} onChange={(e) => setForm({ ...form, seo: { ...form.seo, title: e.target.value } })} maxLength={70} />
                            <Textarea label="Meta description" rows={3} value={form.seo.description} onChange={(e) => setForm({ ...form, seo: { ...form.seo, description: e.target.value } })} maxLength={170} />
                            <Checkbox checked={form.seo.noindex} onChange={(e) => setForm({ ...form, seo: { ...form.seo, noindex: e.target.checked } })} label="Hide from search engines" />
                        </div>
                    </Panel>
                </div>
            </div>
            <ConfirmDialog open={del} title="Delete page?" message="This permanently removes the page." confirmLabel="Delete" tone="danger" loading={busy === 'del'} onClose={() => setDel(false)} onConfirm={async () => { if (await run('del', () => api.delete(`/admin/pages/${id}`).then((x) => x.data))) navigate('/admin/legal-pages'); }} />
        </div>
    );
}

// ---------------- Integrations ----------------
const Ok = ({ ok, label }) => <span className="flex items-center gap-1.5 text-sm">{ok ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <XCircle className="h-4 w-4 text-danger" />} {label}</span>;

function Integrations() {
    const { data, loading, error, reload } = useAdminData('/admin/integrations');
    const t = useSection('tracking');
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    if (t.loading) return <PageLoader />;
    const v = t.value;
    const d = data;
    return (
        <div className="space-y-6">
            <PageHeader title="Integrations" description="Status of each integration. Secrets are configured only in server environment variables and are never displayed here." actions={<Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Refresh status</Button>} />
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Razorpay">
                    <div className="mb-3 flex flex-wrap gap-4"><Ok ok={d.razorpay.configured} label="API keys" /> <Ok ok={d.razorpay.webhookSecret === 'set'} label="Webhook secret" /> {d.razorpay.mode && <Badge tone={d.razorpay.mode === 'live' ? 'green' : 'yellow'}>{d.razorpay.mode} mode</Badge>}</div>
                    <KeyValue items={[['Key ID (public)', d.razorpay.keyId], ['Key secret', d.razorpay.keySecret], ['Webhook URL', <code key="w" className="text-xs">{d.razorpay.webhookUrl}</code>], ['Last webhook', d.razorpay.lastEvent ? `${d.razorpay.lastEvent.event} · ${d.razorpay.lastEvent.status} · ${dateTime(d.razorpay.lastEvent.createdAt)}` : 'None received'], ['Webhooks (7 days)', Object.entries(d.razorpay.last7Days).map(([k, n]) => `${k}: ${n}`).join(', ') || '—']]} />
                    <p className="mt-3 text-xs text-muted">Subscribe the webhook to: {d.razorpay.recommendedEvents.join(', ')}.</p>
                </Panel>
                <Panel title="SMTP email">
                    <div className="mb-3 flex gap-4"><Ok ok={d.smtp.ok} label={d.smtp.ok ? 'Connected' : d.smtp.configured ? 'Connection failed' : 'Not configured'} /></div>
                    <KeyValue items={[['Host', d.smtp.host ? `${d.smtp.host}:${d.smtp.port}` : '—'], ['From', d.smtp.from], ['Password', d.smtp.password], ['Queue', Object.entries(d.smtp.queue).map(([k, n]) => `${k}: ${n}`).join(', ') || 'empty']]} />
                    {d.smtp.error && <Alert tone="error" className="mt-3">{d.smtp.error}</Alert>}
                    <p className="mt-3 text-xs text-muted">Configure SPF, DKIM and DMARC for your sending domain to keep emails out of spam.</p>
                </Panel>
                <Panel title="Private file storage">
                    <div className="mb-3"><Ok ok={d.storage.ok} label={d.storage.ok ? 'Reachable' : 'Unavailable'} /></div>
                    <KeyValue items={[['Provider', d.storage.provider], ['Bucket', d.storage.bucket], ['Public image base URL', d.storage.publicAssetsBaseUrl || 'Served via API /media']]} />
                    {d.storage.provider === 'local' && <Alert tone="warning" className="mt-3">Local disk storage is for development. Use private S3-compatible storage in production.</Alert>}
                    {d.storage.error && <Alert tone="error" className="mt-3">{d.storage.error}</Alert>}
                </Panel>
                <Panel title="Firebase Cloud Messaging">
                    <div className="mb-3 flex flex-wrap gap-4"><Ok ok={d.firebase.adminConfigured} label="Service account" /> <Ok ok={d.firebase.webConfigured} label="Web config + VAPID key" /></div>
                    <KeyValue items={[['Project', d.firebase.projectId], ['Client email', d.firebase.clientEmail], ['Private key', d.firebase.privateKey], ['Active subscriptions', d.firebase.subscriptions.active]]} />
                </Panel>
                <Panel title="Background jobs">
                    <KeyValue items={[['Workers', d.jobs.workersEnabled ? 'Running' : 'Disabled on this instance'], ['Automations', d.jobs.automationEnabled ? 'Enabled' : 'Disabled (AUTOMATION_ENABLED)'], ['Email retry limit', d.jobs.emailRetryLimit], ['Job queue', Object.entries(d.jobs.queue).map(([k, n]) => `${k}: ${n}`).join(', ') || 'empty']]} />
                </Panel>
            </div>

            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Marketing tags</h2><SaveButton s={t} /></div>
            <Alert tone="info">These tags load only after the visitor gives advertising consent. Purchase events fire once per order, only after the server verifies payment.</Alert>
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Meta Pixel">
                    <div className="space-y-4">
                        <Toggle checked={v.meta.enabled} onChange={(x) => t.set('meta.enabled', x)} label="Enabled" />
                        <Input label="Pixel ID" value={v.meta.pixelId} onChange={(e) => t.set('meta.pixelId', e.target.value.trim())} hint={d.metaPixel.envPixelId ? `Environment default: ${d.metaPixel.envPixelId}` : undefined} />
                        <div className="grid grid-cols-2 gap-2">{Object.keys(v.meta.events).map((ev) => <Checkbox key={ev} checked={v.meta.events[ev]} onChange={(e) => t.set(`meta.events.${ev}`, e.target.checked)} label={ev} />)}</div>
                    </div>
                </Panel>
                <Panel title="Google Ads conversion tracking">
                    <div className="space-y-4">
                        <Toggle checked={v.googleAds.enabled} onChange={(x) => t.set('googleAds.enabled', x)} label="Enabled" />
                        <Input label="Google tag ID" placeholder="AW-123456789" value={v.googleAds.tagId} onChange={(e) => t.set('googleAds.tagId', e.target.value.trim())} />
                        <Input label="Conversion ID (if different from tag)" value={v.googleAds.conversionId} onChange={(e) => t.set('googleAds.conversionId', e.target.value.trim())} />
                        <Input label="Purchase conversion label" value={v.googleAds.purchaseLabel} onChange={(e) => t.set('googleAds.purchaseLabel', e.target.value.trim())} />
                        <Toggle checked={v.googleAds.trackCheckout} onChange={(x) => t.set('googleAds.trackCheckout', x)} label="Track checkout starts" />
                        {v.googleAds.trackCheckout && <Input label="Checkout conversion label" value={v.googleAds.checkoutLabel} onChange={(e) => t.set('googleAds.checkoutLabel', e.target.value.trim())} />}
                    </div>
                </Panel>
                <Panel title="Google AdSense (optional, separate from Google Ads)">
                    <div className="space-y-4">
                        <Toggle checked={v.adsense.enabled} onChange={(x) => t.set('adsense.enabled', x)} label="Show ads" description="Ads never appear on cart, checkout, account, order or download pages." />
                        <Input label="Publisher ID" placeholder="ca-pub-…" value={v.adsense.clientId} onChange={(e) => t.set('adsense.clientId', e.target.value.trim())} />
                        {v.adsense.placements.map((p, i) => (
                            <div key={p.key} className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
                                <Checkbox checked={p.enabled} onChange={(e) => t.set('adsense.placements', v.adsense.placements.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} label={p.label} />
                                <Input className="flex-1" label="Ad slot ID" value={p.slot} onChange={(e) => t.set('adsense.placements', v.adsense.placements.map((x, j) => (j === i ? { ...x, slot: e.target.value.trim() } : x)))} />
                            </div>
                        ))}
                    </div>
                </Panel>
                <Panel title="Consent management">
                    <div className="space-y-4">
                        <Toggle checked={v.consent.bannerEnabled} onChange={(x) => t.set('consent.bannerEnabled', x)} label="Show cookie consent banner" />
                        <Toggle checked={v.consent.requireConsent} onChange={(x) => t.set('consent.requireConsent', x)} label="Require consent before analytics/advertising" description="Keep enabled unless you have confirmed it is not required in your markets." />
                        <Input label="Policy version" value={v.consent.policyVersion} onChange={(e) => t.set('consent.policyVersion', e.target.value)} hint="Changing the version asks every visitor again." />
                        <Textarea label="Banner text" rows={3} value={v.consent.bannerText} onChange={(e) => t.set('consent.bannerText', e.target.value)} />
                    </div>
                </Panel>
            </div>
        </div>
    );
}

// ---------------- Settings ----------------
function Settings() {
    const checkout = useSection('checkout');
    const downloads = useSection('downloads');
    const features = useSection('features');
    const payments = useSection('payments');
    if (checkout.loading || downloads.loading || features.loading || payments.loading) return <PageLoader />;
    const c = checkout.value;
    const dl = downloads.value;
    const f = features.value;
    const pay = payments.value || {};
    return (
        <div className="space-y-6">
            <PageHeader title="Website settings" description="Operational settings and feature toggles. Credentials are environment variables and cannot be edited here." />
            <Panel title="Payment Methods & Gateway" actions={<SaveButton s={payments} />}>
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            label="Active Payment Method on Storefront"
                            value={pay.activeGateway || 'manual_upi'}
                            onChange={(e) => payments.set('activeGateway', e.target.value)}
                            options={[
                                { value: 'manual_upi', label: 'Manual UPI (QR Code & UTR Verification) - 0% Fees' },
                                { value: 'razorpay', label: 'Razorpay Payment Gateway (Cards, UPI, Netbanking)' },
                                { value: 'both', label: 'Both (Customer chooses at checkout)' },
                            ]}
                            hint="Switch instantly between Manual UPI and Razorpay without code changes."
                        />
                    </div>

                    <div className="rounded-xl border border-line bg-surface/50 p-4">
                        <div className="flex items-center justify-between pb-3 border-b border-line">
                            <div>
                                <h4 className="font-semibold text-sm">Direct UPI Payment (No Gateway Required)</h4>
                                <p className="text-xs text-muted">Customer scans your UPI QR code or pays to your UPI ID, then submits the 12-digit UTR for admin approval.</p>
                            </div>
                            <Toggle checked={pay.manualUpi?.enabled ?? true} onChange={(x) => payments.set('manualUpi.enabled', x)} label="Enabled" />
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Input
                                label="UPI ID / VPA"
                                placeholder="e.g. ranveratnesh@okhdfcbank"
                                value={pay.manualUpi?.upiId || ''}
                                onChange={(e) => payments.set('manualUpi.upiId', e.target.value.trim())}
                                hint="Your GPay / PhonePe / Paytm / Bank UPI ID where customers send payment."
                            />
                            <Input
                                label="Payee / Account Holder Name"
                                placeholder="e.g. OpenPage / Ratnesh Ranve"
                                value={pay.manualUpi?.accountHolderName || ''}
                                onChange={(e) => payments.set('manualUpi.accountHolderName', e.target.value)}
                                hint="Displayed as receiver name on customer's UPI app."
                            />
                            <div className="sm:col-span-2">
                                <Input
                                    label="Custom QR Code Image URL (Optional)"
                                    placeholder="https://... (leave blank to auto-generate dynamic QR code)"
                                    value={pay.manualUpi?.qrCodeUrl || ''}
                                    onChange={(e) => payments.set('manualUpi.qrCodeUrl', e.target.value.trim())}
                                    hint="If blank, OpenPage automatically generates a live dynamic QR code with exact cart amount."
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Textarea
                                    label="Customer Payment Instructions"
                                    rows={3}
                                    value={pay.manualUpi?.instructions || ''}
                                    onChange={(e) => payments.set('manualUpi.instructions', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-line bg-surface/50 p-4">
                        <div className="flex items-center justify-between pb-3 border-b border-line">
                            <div>
                                <h4 className="font-semibold text-sm">Razorpay Payment Gateway</h4>
                                <p className="text-xs text-muted">Preserved for future use. Toggle on whenever your merchant gateway is approved and credentials are added.</p>
                            </div>
                            <Toggle checked={pay.razorpay?.enabled ?? false} onChange={(x) => payments.set('razorpay.enabled', x)} label="Enabled" />
                        </div>
                        <div className="mt-3 text-xs text-muted">
                            {pay.razorpay?.enabled ? (
                                <p className="text-brand font-medium">✓ Razorpay is toggled ON. Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured in Backend/.env.</p>
                            ) : (
                                <p>Razorpay is currently inactive. You can turn this on anytime when you are ready to accept automated card and gateway payments.</p>
                            )}
                        </div>
                    </div>
                </div>
            </Panel>
            <Panel title="Checkout" actions={<SaveButton s={checkout} />}>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Input label="Email verification valid for (minutes)" type="number" min="5" value={c.verificationValidMinutes} onChange={(e) => checkout.set('verificationValidMinutes', Number(e.target.value))} hint="After verifying, the customer can pay within this window." />
                    <Input label="Checkout session lifetime (hours)" type="number" min="1" value={c.sessionTtlHours} onChange={(e) => checkout.set('sessionTtlHours', Number(e.target.value))} />
                    <Input label="Reuse pending order within (minutes)" type="number" min="1" value={c.pendingOrderReuseMinutes} onChange={(e) => checkout.set('pendingOrderReuseMinutes', Number(e.target.value))} />
                    <Input label="Terms version" value={c.termsVersion} onChange={(e) => checkout.set('termsVersion', e.target.value)} hint="Recorded with each order's terms acceptance." />
                </div>
                <h3 className="mt-6 text-sm font-semibold">Tax</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-4">
                    <div className="flex items-end pb-2"><Toggle checked={c.tax.enabled} onChange={(x) => checkout.set('tax.enabled', x)} label="Apply tax" /></div>
                    <Input label="Label" value={c.tax.label} onChange={(e) => checkout.set('tax.label', e.target.value)} />
                    <Input label="Rate (%)" type="number" min="0" max="100" step="0.01" value={c.tax.ratePercent} onChange={(e) => checkout.set('tax.ratePercent', Number(e.target.value))} />
                    <div className="flex items-end pb-2"><Toggle checked={c.tax.inclusive} onChange={(x) => checkout.set('tax.inclusive', x)} label="Prices include tax" /></div>
                </div>
                <p className="mt-2 text-xs text-muted">OTP length, expiry, cooldown and attempt limits are set by OTP_* environment variables.</p>
            </Panel>
            <Panel title="Downloads" actions={<SaveButton s={downloads} />}>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Input label="Downloads allowed per link" type="number" min="1" value={dl.maxUsesPerLink} onChange={(e) => downloads.set('maxUsesPerLink', Number(e.target.value))} />
                    <Input label="Max downloads per purchase per day" type="number" min="1" value={dl.maxDownloadsPerEntitlementPerDay} onChange={(e) => downloads.set('maxDownloadsPerEntitlementPerDay', Number(e.target.value))} />
                    <Input label="Library link lifetime (minutes)" type="number" min="1" value={dl.libraryLinkTtlMinutes} onChange={(e) => downloads.set('libraryLinkTtlMinutes', Number(e.target.value))} />
                </div>
                <p className="mt-2 text-xs text-muted">Emailed link lifetime is DOWNLOAD_LINK_TTL_MINUTES in the server environment.</p>
            </Panel>
            <Panel title="Features" actions={<SaveButton s={features} />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Toggle checked={f.reviews} onChange={(x) => features.set('reviews', x)} label="Customer reviews" description="Verified buyers can review; admins moderate." />
                    <Toggle checked={f.newsletter} onChange={(x) => features.set('newsletter', x)} label="Newsletter signup" />
                    <Toggle checked={f.notifications} onChange={(x) => features.set('notifications', x)} label="Browser notification prompts" />
                    <Toggle checked={f.accounts} onChange={(x) => features.set('accounts', x)} label="Customer accounts" />
                    <Input label="Bestseller: minimum paid sales" type="number" min="1" value={f.bestsellerMinSales} onChange={(e) => features.set('bestsellerMinSales', Number(e.target.value))} hint="Labels are based on real sales only." />
                    <Input label="Bestseller: top N products" type="number" min="1" value={f.bestsellerTopN} onChange={(e) => features.set('bestsellerTopN', Number(e.target.value))} />
                </div>
            </Panel>
        </div>
    );
}

// ---------------- Admin account & audit ----------------
function Account() {
    const { user, setUser } = useAuth();
    const sessions = useAdminData('/admin/account/sessions');
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const logs = useAdminData('/admin/audit-logs', { action: action || undefined, page });
    const { busy, run } = useAction();
    const [name, setName] = useState(user.name || '');
    const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
    const actions = useMemo(() => ['', 'admin.', 'product.', 'order.', 'refund.', 'offer.', 'customer.', 'settings.', 'email', 'campaign.', 'seo.', 'page.'], []);
    return (
        <div className="space-y-6">
            <PageHeader title="Admin account and audit log" />
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Profile">
                    <div className="flex items-end gap-2">
                        <Input className="flex-1" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
                        <Button variant="outline" loading={busy === 'name'} onClick={async () => { const r = await run('name', () => api.patch('/admin/account', { name }).then((x) => x.data)); if (r) setUser(r.data.user); }}>Save</Button>
                    </div>
                    <p className="mt-3 text-sm text-muted">{user.email}</p>
                    <h3 className="mt-6 text-sm font-semibold">Change password</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
                        <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="10+ characters with letters and numbers" />
                    </div>
                    <Button className="mt-3" variant="outline" loading={busy === 'pw'} disabled={!pw.currentPassword || !pw.newPassword} onClick={async () => { if (await run('pw', () => post('/auth/change-password', pw))) setPw({ currentPassword: '', newPassword: '' }); }}>Update password</Button>
                </Panel>
                <Panel title="Active sessions" actions={<Button size="sm" variant="outline-danger" loading={busy === 'all'} onClick={async () => { if (await run('all', () => post('/auth/logout-all'))) setUser(null); }}>Sign out everywhere</Button>}>
                    <ul className="space-y-2 text-sm">
                        {(sessions.data?.sessions || []).map((s) => <li key={s._id} className="rounded-lg bg-surface p-2"><p className="truncate">{s.userAgent}</p><p className="text-xs text-muted">{s.ip} · last used {dateTime(s.lastUsedAt)}</p></li>)}
                    </ul>
                    <h3 className="mt-5 text-sm font-semibold">Recent sign-in attempts</h3>
                    <ul className="mt-2 space-y-1 text-xs">
                        {(sessions.data?.logins || []).map((l) => <li key={l._id} className="flex justify-between"><span>{dateTime(l.createdAt)} · {l.ip}</span><StatusBadge status={l.outcome === 'success' ? 'done' : 'failed'} /></li>)}
                    </ul>
                </Panel>
            </div>
            <Panel title="Audit log" description="Sensitive administrative actions with actor, target, time and outcome.">
                <div className="mb-3"><FilterSelect label="Action" value={action} onChange={(v) => { setAction(v); setPage(1); }} options={actions.map((a) => ({ value: a, label: a ? `${a.replace(/\.$/, '')}*` : 'All actions' }))} /></div>
                <DataTable loading={logs.loading} error={logs.error} rows={logs.data?.items} pagination={logs.data?.pagination} onPage={setPage} empty="No audit entries." columns={[
                    { key: 'createdAt', label: 'When', render: (r) => dateTime(r.createdAt) },
                    { key: 'actorEmail', label: 'Actor', render: (r) => r.actorEmail || '—' },
                    { key: 'action', label: 'Action' },
                    { key: 'target', label: 'Target', render: (r) => (r.targetType ? `${r.targetType} ${r.targetId?.slice(-8) || ''}` : '—') },
                    { key: 'outcome', label: 'Outcome', render: (r) => <StatusBadge status={r.outcome === 'success' ? 'done' : 'failed'} /> },
                    { key: 'details', label: 'Details', className: 'max-w-xs', render: (r) => <code className="break-all text-[11px]">{r.details ? JSON.stringify(r.details).slice(0, 140) : ''}</code> },
                ]} />
            </Panel>
        </div>
    );
}

export default function Site({ view }) {
    if (view === 'seo') return <Seo />;
    if (view === 'content') return <Content />;
    if (view === 'pages') return <Pages />;
    if (view === 'page') return <PageEdit />;
    if (view === 'integrations') return <Integrations />;
    if (view === 'settings') return <Settings />;
    if (view === 'account') return <Account />;
    return null;
}
