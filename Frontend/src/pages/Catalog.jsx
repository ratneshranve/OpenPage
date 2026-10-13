import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import Seo, { breadcrumbLd } from '../components/layout/Seo';
import { AdSlot, Breadcrumbs, Markdown } from '../components/layout/Extras';
import { ProductGrid } from '../components/shop/ProductCard';
import { Alert, Button, EmptyState, Pagination } from '../components/ui';
import { get, errorMessage } from '../lib/api';
import { trackSearch } from '../lib/tracking';
import NotFound from './NotFound';

const SORTS = [
    { value: '', label: 'Recommended' },
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most popular' },
    { value: 'price_asc', label: 'Price: low to high' },
    { value: 'price_desc', label: 'Price: high to low' },
    { value: 'rating', label: 'Top rated' },
];
const PRICE_RANGES = [
    { value: '', label: 'Any price' },
    { value: '0-199', label: 'Under ₹200' },
    { value: '200-499', label: '₹200 to ₹499' },
    { value: '500-999', label: '₹500 to ₹999' },
    { value: '1000-', label: '₹1,000 and above' },
];

export default function Catalog() {
    const { slug } = useParams();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [category, setCategory] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const q = params.get('q') || '';
    const sort = params.get('sort') || '';
    const price = params.get('price') || '';
    const page = Number(params.get('page') || 1);
    const categorySlug = slug || params.get('category') || '';

    useEffect(() => {
        get('/categories').then(setCategories).catch(() => {});
    }, []);

    useEffect(() => {
        setNotFound(false);
        if (!slug) return setCategory(null);
        get(`/categories/${slug}`)
            .then(setCategory)
            .catch((err) => err.response?.status === 404 && setNotFound(true));
    }, [slug]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        const [minPrice, maxPrice] = price.split('-');
        get('/products', { q: q || undefined, sort: sort || undefined, category: categorySlug || undefined, page, limit: 12, minPrice: minPrice || undefined, maxPrice: maxPrice || undefined })
            .then((d) => !cancelled && setData(d))
            .catch((err) => !cancelled && setError(errorMessage(err)))
            .finally(() => !cancelled && setLoading(false));
        if (q) trackSearch(q);
        return () => {
            cancelled = true;
        };
    }, [q, sort, price, page, categorySlug]);

    const update = (patch) => {
        const next = new URLSearchParams(params);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        if (!('page' in patch)) next.delete('page');
        setParams(next);
    };

    if (notFound) return <NotFound title="Category not found" />;

    const title = category ? category.seo?.title || `${category.name} eBooks` : q ? `Search results for “${q}”` : 'All eBooks';
    const crumbs = [{ name: 'Home', path: '/' }, category ? { name: category.name, path: `/category/${category.slug}` } : { name: 'eBooks', path: '/ebooks' }];

    const filters = (
        <div className="space-y-6">
            <div>
                <h2 className="mb-2 text-sm font-semibold">Category</h2>
                <ul className="space-y-1">
                    <li>
                        <button type="button" onClick={() => (slug ? navigate(`/ebooks${q ? `?q=${encodeURIComponent(q)}` : ''}`) : update({ category: '' }))} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${!categorySlug ? 'bg-accent-pale font-semibold text-accent' : 'text-ink-soft hover:bg-surface'}`}>
                            All categories
                        </button>
                    </li>
                    {categories.map((c) => (
                        <li key={c._id}>
                            <button type="button" onClick={() => (slug ? navigate(`/category/${c.slug}`) : update({ category: c.slug }))} className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm ${categorySlug === c.slug ? 'bg-accent-pale font-semibold text-accent' : 'text-ink-soft hover:bg-surface'}`}>
                                <span>{c.name}</span>
                                <span className="text-muted">{c.productCount}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h2 className="mb-2 text-sm font-semibold">Price</h2>
                <ul className="space-y-1">
                    {PRICE_RANGES.map((r) => (
                        <li key={r.value}>
                            <button type="button" onClick={() => update({ price: r.value })} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${price === r.value ? 'bg-accent-pale font-semibold text-accent' : 'text-ink-soft hover:bg-surface'}`}>
                                {r.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="container-page py-8">
            <Seo title={title} description={category?.seo?.description || category?.description?.slice(0, 160)} image={category?.seo?.ogImage || category?.image} noindex={Boolean(q) || page > 1 || Boolean(price) || category?.seo?.noindex} jsonLd={breadcrumbLd(crumbs)} />
            <Breadcrumbs items={crumbs} />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{category ? category.name : q ? `Results for “${q}”` : 'All eBooks'}</h1>
                    {data && <p className="mt-1 text-sm text-muted">{data.pagination.total} {data.pagination.total === 1 ? 'title' : 'titles'}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                        <SlidersHorizontal className="h-4 w-4" /> Filters
                    </Button>
                    <label htmlFor="sort" className="sr-only">
                        Sort by
                    </label>
                    <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })} className="input h-9 w-auto py-1 text-sm">
                        {SORTS.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {category?.description && page === 1 && (
                <div className="mt-4 max-w-3xl">
                    <Markdown className="prose-openpage text-[15px]">{category.description}</Markdown>
                </div>
            )}
            <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
                <aside className={`${filtersOpen ? 'block' : 'hidden'} rounded-2xl border border-line p-4 lg:block lg:border-0 lg:p-0`} aria-label="Filters">
                    {filters}
                </aside>
                <div>
                    {error && <Alert tone="error" title="Could not load eBooks">{error}</Alert>}
                    {!error && !loading && data?.items.length === 0 ? (
                        <EmptyState icon={SearchX} title="No eBooks found" action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>}>
                            Try a different search term or remove some filters.
                        </EmptyState>
                    ) : (
                        <ProductGrid products={data?.items || []} loading={loading} count={6} columns="sm:grid-cols-2 md:grid-cols-3" />
                    )}
                    {data && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={(p) => update({ page: String(p) })} />}
                </div>
            </div>
            <AdSlot placement="catalog_bottom" />
        </div>
    );
}
