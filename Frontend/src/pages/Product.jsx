import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Download, FileText, Globe, Layers, Lock, RefreshCcw, Share2, ShoppingCart, Star, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo, { breadcrumbLd, siteOrigin } from '../components/layout/Seo';
import { AdSlot, Breadcrumbs, Markdown } from '../components/layout/Extras';
import { ProductGrid } from '../components/shop/ProductCard';
import QuickCheckoutModal from '../components/shop/QuickCheckoutModal';
import { Alert, Badge, BookCover, Button, PageLoader, Price } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useConfig } from '../context/ConfigContext';
import { get, errorMessage, apiOrigin } from '../lib/api';
import { date, fileSize, money } from '../lib/format';
import { trackViewContent } from '../lib/tracking';
import NotFound from './NotFound';

function Stars({ value, size = 'h-4 w-4' }) {
    return (
        <span className="inline-flex gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`${size} ${i < Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} aria-hidden />
            ))}
        </span>
    );
}

export default function Product() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { add, has } = useCart();
    const { config } = useConfig();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeImage, setActiveImage] = useState(0);
    const [quickBuyOpen, setQuickBuyOpen] = useState(false);
    const [selectedRelated, setSelectedRelated] = useState(null);

    useEffect(() => {
        setData(null);
        setError(null);
        setActiveImage(0);
        get(`/products/${slug}`)
            .then((d) => {
                setData(d);
                trackViewContent(d.product);
            })
            .catch((err) => setError(err));
    }, [slug]);

    if (error?.response?.status === 404) return <NotFound title="eBook not found" message="This eBook could not be found or is no longer available." />;
    if (error) return <div className="container-page py-10"><Alert tone="error" title="Could not load this eBook">{errorMessage(error)}</Alert></div>;
    if (!data) return <PageLoader />;

    const { product: p, related, reviews, reviewsEnabled } = data;
    const inCart = has(p._id);
    const images = [p.coverImage, ...(p.previewImages || [])].filter((i) => i?.url);
    const url = p.seo?.canonicalUrl || `${siteOrigin()}/ebooks/${p.slug}`;
    const crumbs = [{ name: 'Home', path: '/' }, { name: 'eBooks', path: '/ebooks' }, ...(p.category ? [{ name: p.category.name, path: `/category/${p.category.slug}` }] : []), { name: p.title, path: `/ebooks/${p.slug}` }];

    // Structured data mirrors what is visible on the page; ratings only from approved reviews.
    const productLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: p.shortDescription,
        image: p.coverImage?.url ? [p.coverImage.url] : undefined,
        sku: p._id,
        brand: { '@type': 'Brand', name: p.publisher || 'OpenPage' },
        offers: {
            '@type': 'Offer',
            url,
            priceCurrency: p.currency,
            price: (p.finalPrice / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
            ...(p.activeOffer?.endsAt ? { priceValidUntil: p.activeOffer.endsAt.slice(0, 10) } : {}),
        },
        ...(p.ratingCount > 0 && config?.seo?.structuredData?.reviews !== false
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAverage.toFixed(1), reviewCount: p.ratingCount } }
            : {}),
    };

    const buyNow = () => {
        setQuickBuyOpen(true);
    };

    const share = async () => {
        try {
            if (navigator.share) await navigator.share({ title: p.title, url });
            else {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied.');
            }
        } catch {
            /* cancelled */
        }
    };

    const facts = [
        { icon: FileText, label: 'Format', value: p.fileFormat || p.format },
        p.pageCount ? { icon: Layers, label: 'Pages', value: p.pageCount } : null,
        { icon: Globe, label: 'Language', value: p.language },
        p.fileSize ? { icon: Download, label: 'File size', value: fileSize(p.fileSize) } : null,
        p.version ? { icon: RefreshCcw, label: 'Version', value: p.version } : null,
        p.publishedAt ? { icon: Clock, label: 'Published', value: date(p.publishedAt) } : null,
    ].filter(Boolean);

    return (
        <div className="container-page py-8">
            <Seo
                title={p.seo?.title || p.title}
                description={p.seo?.description || p.shortDescription}
                image={p.seo?.ogImage || p.coverImage?.url}
                canonical={p.seo?.canonicalUrl}
                ogTitle={p.seo?.ogTitle}
                ogDescription={p.seo?.ogDescription}
                noindex={p.seo?.noindex}
                type="product"
                jsonLd={config?.seo?.structuredData?.products === false ? breadcrumbLd(crumbs) : [productLd, breadcrumbLd(crumbs)]}
            />
            <Breadcrumbs items={crumbs} />

            <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                {/* Gallery */}
                <div className="min-w-0">
                    <div className="mx-auto max-w-sm lg:sticky lg:top-24">
                        {images.length ? (
                            <img src={images[activeImage].url} alt={images[activeImage].alt || `${activeImage ? 'Preview page of' : 'Cover of'} ${p.title}`} className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md ring-1 ring-line" />
                        ) : (
                            <BookCover title={p.title} className="shadow-md" />
                        )}
                        {images.length > 1 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none" role="list" aria-label="Preview images">
                                {images.map((img, i) => (
                                    <button key={img.url} type="button" onClick={() => setActiveImage(i)} className={`h-20 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${i === activeImage ? 'ring-accent' : 'ring-transparent'}`} aria-label={`Show image ${i + 1}`} aria-pressed={i === activeImage}>
                                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {p.hasSample && (
                            <a href={`${apiOrigin}/api/v1/products/${p.slug}/sample`} className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium no-underline hover:bg-surface">
                                <FileText className="h-4 w-4" /> Read a free sample
                            </a>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                        {p.category && (
                            <Link to={`/category/${p.category.slug}`} className="no-underline">
                                <Badge tone="blue">{p.category.name}</Badge>
                            </Link>
                        )}
                        {p.isBestseller && <Badge tone="navy">Bestseller</Badge>}
                    </div>
                    <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{p.title}</h1>
                    {p.subtitle && <p className="mt-2 text-lg text-ink-soft">{p.subtitle}</p>}
                    <p className="mt-2 text-sm text-muted">
                        by <span className="font-medium text-ink">{p.author || p.publisher}</span>
                        {p.author && p.publisher && p.publisher !== p.author && <> · {p.publisher}</>}
                    </p>
                    {p.ratingCount > 0 && (
                        <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm no-underline">
                            <Stars value={p.ratingAverage} /> <span className="text-ink">{p.ratingAverage.toFixed(1)}</span> <span className="text-muted">({p.ratingCount} review{p.ratingCount === 1 ? '' : 's'})</span>
                        </a>
                    )}

                    <div className="mt-6 rounded-2xl border border-line p-5">
                        <Price product={p} size="lg" />
                        {p.activeOffer && (
                            <p className="mt-2 text-sm text-brand">
                                {p.activeOffer.name}: you save {money(p.activeOffer.discount, p.currency)}
                                {p.activeOffer.endsAt && <span className="text-muted"> · Offer ends {date(p.activeOffer.endsAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                            </p>
                        )}
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <Button size="lg" className="flex-1" onClick={buyNow}>
                                <Zap className="h-5 w-5" /> Buy now
                            </Button>
                            <Button size="lg" variant="outline" className="flex-1" onClick={() => (inCart ? navigate('/cart') : add(p))}>
                                {inCart ? <Check className="h-5 w-5 text-brand" /> : <ShoppingCart className="h-5 w-5" />}
                                {inCart ? 'In cart: view cart' : 'Add to cart'}
                            </Button>
                        </div>
                        <ul className="mt-5 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
                            <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand" /> Instant download after payment</li>
                            <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand" /> Secure checkout by Razorpay</li>
                            <li className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-brand" /> Re-download from your library</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-brand" /> <Link to="/refund-policy">Fair refund policy</Link></li>
                        </ul>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {facts.map((f) => (
                            <div key={f.label} className="rounded-xl bg-surface p-3">
                                <dt className="flex items-center gap-1.5 text-xs text-muted"><f.icon className="h-3.5 w-3.5" /> {f.label}</dt>
                                <dd className="mt-0.5 text-sm font-semibold">{f.value}</dd>
                            </div>
                        ))}
                    </dl>

                    {p.keyBenefits?.length > 0 && (
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">What you will learn</h2>
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                {p.keyBenefits.map((b) => (
                                    <li key={b} className="flex gap-2 text-ink-soft"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" /> {b}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {p.description && (
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">About this eBook</h2>
                            <Markdown className="prose-openpage mt-2">{p.description}</Markdown>
                        </section>
                    )}

                    {p.audience?.length > 0 && (
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">Who it is for</h2>
                            <ul className="mt-3 list-disc space-y-1 pl-6 text-ink-soft">
                                {p.audience.map((a) => <li key={a}>{a}</li>)}
                            </ul>
                        </section>
                    )}

                    {p.tableOfContents?.length > 0 && (
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">Table of contents</h2>
                            <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
                                {p.tableOfContents.map((t, i) => (
                                    <li key={`${i}-${t}`} className="flex gap-3 px-4 py-2.5 text-sm"><span className="w-6 shrink-0 text-muted">{i + 1}.</span> {t}</li>
                                ))}
                            </ol>
                        </section>
                    )}

                    <section className="mt-8 rounded-2xl bg-surface p-5 text-sm leading-6 text-ink-soft">
                        <h2 className="text-base font-semibold text-ink">Licence and refunds</h2>
                        <p className="mt-1">{p.license || 'Personal licence: download and read on your own devices. Sharing or reselling the file is not permitted.'} <Link to="/licensing">Licensing details</Link>.</p>
                        <p className="mt-2">Problems with your file? Refund requests are reviewed under our <Link to="/refund-policy">Refund Policy</Link>.</p>
                    </section>

                    {p.faqs?.length > 0 && (
                        <section className="mt-8">
                            <h2 className="text-xl font-bold">Questions</h2>
                            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
                                {p.faqs.map((f) => (
                                    <details key={f.question} className="p-4">
                                        <summary className="cursor-pointer font-medium">{f.question}</summary>
                                        <p className="mt-2 text-sm text-ink-soft">{f.answer}</p>
                                    </details>
                                ))}
                            </div>
                        </section>
                    )}

                    {reviewsEnabled && (
                        <section id="reviews" className="mt-8 scroll-mt-24">
                            <h2 className="text-xl font-bold">Reviews</h2>
                            {reviews.length === 0 ? (
                                <p className="mt-2 text-sm text-muted">No reviews yet. Verified buyers can review this eBook from their library.</p>
                            ) : (
                                <ul className="mt-3 space-y-4">
                                    {reviews.map((r) => (
                                        <li key={r._id} className="rounded-xl border border-line p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <Stars value={r.rating} />
                                                <span className="text-xs text-muted">{date(r.createdAt)}</span>
                                            </div>
                                            {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                                            <p className="mt-1 text-sm text-ink-soft">{r.body}</p>
                                            <p className="mt-2 text-xs text-muted">{r.displayName || 'Verified buyer'} · Verified purchase</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    <button type="button" onClick={share} className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent">
                        <Share2 className="h-4 w-4" /> Share this eBook
                    </button>
                </div>
            </div>

            <AdSlot placement="product_bottom" />

            {related.length > 0 && (
                <section className="mt-16">
                    <h2 className="mb-6 text-2xl font-bold">You may also like</h2>
                    <ProductGrid products={related} onQuickBuy={setSelectedRelated} />
                </section>
            )}

            {/* Sticky mobile purchase bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-md p-3 lg:hidden shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{p.title}</p>
                        <p className="font-extrabold text-brand text-base">{money(p.finalPrice, p.currency)}</p>
                    </div>
                    <Button onClick={buyNow} className="bg-gradient-to-r from-emerald-600 via-brand to-emerald-700 font-extrabold text-white shadow-md">
                        <Zap className="h-4 w-4 fill-yellow-300 text-yellow-300" /> Buy now
                    </Button>
                </div>
            </div>
            <div className="h-16 lg:hidden" aria-hidden />

            <QuickCheckoutModal
                product={p}
                open={quickBuyOpen}
                onClose={() => setQuickBuyOpen(false)}
            />

            <QuickCheckoutModal
                product={selectedRelated}
                open={Boolean(selectedRelated)}
                onClose={() => setSelectedRelated(null)}
            />
        </div>
    );
}
