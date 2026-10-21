import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BookOpen, Check, Clock, Download, Lock, MailCheck, ShoppingBag, ShoppingCart, Star, Tag, X, Zap } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { AdSlot, NotificationPrompt } from '../components/layout/Extras';
import { ProductGrid } from '../components/shop/ProductCard';
import NewsletterForm from '../components/shop/NewsletterForm';
import QuickCheckoutModal from '../components/shop/QuickCheckoutModal';
import { Badge, BookCover, Button } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import { useCart } from '../context/CartContext';
import { get } from '../lib/api';
import { date, money } from '../lib/format';
import { getPendingOrder, clearPendingOrder, fetchOrderStatus } from '../lib/checkout';

const STEP_ICONS = [ShoppingBag, MailCheck, Lock, Download];
const WHY_ICONS = [BadgeCheck, Zap, BookOpen, Lock];

function Section({ title, subtitle, link, children, id, className = '' }) {
    return (
        <section id={id} className={`container-page py-12 sm:py-16 ${className}`}>
            <div className="mb-8 flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
                    {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
                </div>
                {link && (
                    <Link to={link.to} className="hidden shrink-0 items-center gap-1 text-sm font-semibold no-underline sm:flex">
                        {link.label} <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            </div>
            {children}
        </section>
    );
}

export default function Home() {
    const { config } = useConfig();
    const { items, count } = useCart();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quickBuyProduct, setQuickBuyProduct] = useState(null);
    const [selectedBookIndex, setSelectedBookIndex] = useState(0);

    const subtotal = items.reduce((acc, i) => acc + (Number(i.price) || 0), 0);
    const currency = items[0]?.currency || 'INR';

    const [pendingOrder, setPendingOrder] = useState(null);

    useEffect(() => {
        get('/home')
            .then(setData)
            .catch(() => setData({ featured: [], bestsellers: [], recent: [], categories: [], banners: [], offers: [], testimonials: [] }))
            .finally(() => setLoading(false));

        const saved = getPendingOrder();
        if (saved && saved.orderNumber) {
            fetchOrderStatus(saved.orderNumber)
                .then((o) => {
                    if (o && o.status === 'pending') {
                        setPendingOrder(o);
                    } else {
                        clearPendingOrder(saved.orderNumber);
                        setPendingOrder(null);
                    }
                })
                .catch(() => {
                    setPendingOrder(saved);
                });
        }
    }, []);

    const allProducts = [
        ...(data?.featured || []),
        ...(data?.bestsellers || []),
        ...(data?.recent || []),
    ];
    const uniqueProducts = allProducts.filter((p, idx, arr) => arr.findIndex((x) => x._id === p._id) === idx);
    const primaryBook = uniqueProducts[selectedBookIndex] || uniqueProducts[0] || null;

    const home = config?.homepage;
    const sec = home?.sections || {};
    const hero = home?.hero || {};
    const seo = config?.seo;
    const faqLd = home?.faqs?.length
        ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: home.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }
        : null;

    return (
        <>
            <Seo title={seo?.homepage?.title || undefined} description={seo?.homepage?.description || undefined} jsonLd={faqLd} />

            {/* Pending Payment Recovery Banner */}
            {pendingOrder && (
                <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-3 sm:px-6">
                    <div className="container-page flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
                                <Clock className="h-5 w-5 animate-pulse" />
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    Pending payment for Order <span className="font-mono text-brand font-bold">{pendingOrder.orderNumber}</span> ({money(pendingOrder.total, pendingOrder.currency)})
                                </p>
                                <p className="text-xs text-muted">
                                    Resume directly to payment without refilling your details or re-verifying your email.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                            <Button as={Link} to={`/order/${pendingOrder.orderNumber}`} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
                                Complete Payment <ArrowRight className="h-4 w-4" />
                            </Button>
                            <button
                                type="button"
                                onClick={() => {
                                    clearPendingOrder(pendingOrder.orderNumber);
                                    setPendingOrder(null);
                                }}
                                className="p-1.5 text-muted hover:text-ink rounded-lg transition"
                                aria-label="Dismiss pending payment reminder"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero */}
            <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-accent-pale/60 to-white">
                <div className="container-page grid items-center gap-10 py-10 sm:py-20 lg:grid-cols-2">
                    <div>
                        {hero.eyebrow && <Badge tone="green">{hero.eyebrow}</Badge>}
                        <h1 className="mt-3 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{hero.title || 'Practical eBooks that help you work smarter'}</h1>
                        <p className="mt-3 max-w-xl text-base leading-7 text-ink-soft sm:text-lg sm:leading-8">{hero.subtitle}</p>

                        {/* Mobile Instant Book Showcase Card: visible immediately on mobile without scrolling */}
                        {primaryBook && (
                            <div className="block lg:hidden my-6">
                                {/* Book Switcher Tabs for Mobile */}
                                {uniqueProducts.length > 1 && (
                                    <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                                        {uniqueProducts.map((p, idx) => {
                                            const isSelected = selectedBookIndex === idx;
                                            return (
                                                <button
                                                    key={p._id}
                                                    type="button"
                                                    onClick={() => setSelectedBookIndex(idx)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-brand text-white shadow-md ring-2 ring-brand/30'
                                                            : 'bg-white text-ink-soft border border-line hover:border-brand/40 shadow-xs'
                                                    }`}
                                                >
                                                    <span className="truncate max-w-[150px]">{p.title}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                                        isSelected ? 'bg-white/20 text-yellow-200' : 'bg-brand/10 text-brand'
                                                    }`}>
                                                        {money(p.finalPrice, p.currency)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-white to-surface p-4 shadow-xl ring-1 ring-emerald-500/20">
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                                            <Zap className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" /> Instant Buy
                                        </span>
                                        {primaryBook.ratingAverage > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-ink">
                                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                                {primaryBook.ratingAverage.toFixed(1)} ({primaryBook.ratingCount || 1})
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex gap-3.5 items-center">
                                        <Link to={`/ebooks/${primaryBook.slug}`} className="shrink-0 block group">
                                            <div className="relative w-24 h-32 rounded-xl overflow-hidden shadow-md ring-1 ring-line/80 group-hover:scale-105 transition">
                                                {primaryBook.coverImage?.url ? (
                                                    <img src={primaryBook.coverImage.url} alt={primaryBook.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <BookCover title={primaryBook.title} className="w-full h-full" />
                                                )}
                                                <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold text-white uppercase">
                                                    PDF
                                                </span>
                                            </div>
                                        </Link>

                                        <div className="min-w-0 flex-1">
                                            <Link to={`/ebooks/${primaryBook.slug}`} className="no-underline">
                                                <h3 className="text-base font-extrabold text-ink leading-snug line-clamp-2 hover:text-brand">
                                                    {primaryBook.title}
                                                </h3>
                                            </Link>
                                            <p className="mt-0.5 text-xs text-brand font-medium">
                                                Instant PDF Download {primaryBook.pageCount ? `· ${primaryBook.pageCount} Pages` : ''}
                                            </p>

                                            <div className="mt-2 flex items-baseline gap-2">
                                                <span className="text-2xl font-black text-brand tracking-tight">
                                                    {money(primaryBook.finalPrice, primaryBook.currency)}
                                                </span>
                                                {primaryBook.originalPrice && primaryBook.originalPrice > primaryBook.finalPrice && (
                                                    <>
                                                        <span className="text-xs text-muted line-through">
                                                            {money(primaryBook.originalPrice, primaryBook.currency)}
                                                        </span>
                                                        <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                                                            {Math.round(((primaryBook.originalPrice - primaryBook.finalPrice) / primaryBook.originalPrice) * 100)}% OFF
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Big Instant Buy Now Button */}
                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setQuickBuyProduct(primaryBook)}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-brand to-emerald-700 py-3.5 px-4 font-extrabold text-white text-base shadow-lg shadow-brand/20 active:scale-[0.98] transition cursor-pointer hover:brightness-105"
                                        >
                                            <Zap className="h-5 w-5 fill-yellow-300 text-yellow-300 animate-bounce" />
                                            <span>Buy Now · {money(primaryBook.finalPrice, primaryBook.currency)}</span>
                                            <ArrowRight className="h-4 w-4 ml-1" />
                                        </button>
                                    </div>

                                    {/* Security & trust row */}
                                    <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] text-muted">
                                        <span className="flex items-center gap-1 font-medium text-ink-soft">
                                            <Zap className="h-3 w-3 text-brand" /> Instant UPI QR
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 font-medium text-ink-soft">
                                            <Lock className="h-3 w-3 text-brand" /> Instant Access
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 font-medium text-ink-soft">
                                            <Check className="h-3 w-3 text-brand" /> No App Needed
                                        </span>
                                    </div>

                                    {/* Switch book pills if multiple books exist */}
                                    {uniqueProducts.length > 1 && (
                                        <div className="mt-3.5 pt-3 border-t border-line/60">
                                            <p className="text-[11px] font-semibold text-muted mb-1.5">More eBooks to buy:</p>
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {uniqueProducts.map((p, idx) => (
                                                    <button
                                                        key={p._id}
                                                        type="button"
                                                        onClick={() => setSelectedBookIndex(idx)}
                                                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer border ${
                                                            selectedBookIndex === idx
                                                                ? 'bg-brand text-white border-brand shadow-xs'
                                                                : 'bg-white text-ink-soft border-line hover:bg-surface'
                                                        }`}
                                                    >
                                                        {p.title} ({money(p.finalPrice, p.currency)})
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap gap-3">
                            {primaryBook && (
                                <div className="hidden lg:inline-flex">
                                    <Button size="lg" className="bg-gradient-to-r from-emerald-600 via-brand to-emerald-700 font-extrabold text-white shadow-md hover:brightness-105" onClick={() => setQuickBuyProduct(primaryBook)}>
                                        <Zap className="h-4 w-4 fill-yellow-300 text-yellow-300" /> Buy Now · {money(primaryBook.finalPrice, primaryBook.currency)}
                                    </Button>
                                </div>
                            )}
                            {hero.primaryCtaText && (
                                <Button as={Link} to={hero.primaryCtaLink || '/ebooks'} size="lg" variant={primaryBook ? 'outline' : 'primary'}>
                                    {hero.primaryCtaText} <ArrowRight className="h-4 w-4" />
                                </Button>
                            )}
                            {hero.secondaryCtaText && (
                                <Button as={hero.secondaryCtaLink?.startsWith('#') ? 'a' : Link} href={hero.secondaryCtaLink} to={hero.secondaryCtaLink} variant="outline" size="lg">
                                    {hero.secondaryCtaText}
                                </Button>
                            )}
                        </div>
                        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                            <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand" /> Direct UPI / QR payment</li>
                            <li className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-brand" /> Instant download link</li>
                            <li className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-brand" /> Re-download any time</li>
                        </ul>
                    </div>
                    <div className="hidden lg:block">
                        {hero.image ? (
                            <img src={hero.image} alt="" className="mx-auto max-h-[440px] rounded-2xl object-contain" />
                        ) : (
                            <div className="relative mx-auto grid max-w-md grid-cols-2 gap-4">
                                {(data?.featured?.length ? data.featured : data?.recent || []).slice(0, 4).map((p, i) => (
                                    <div key={p._id} className={`block no-underline cursor-pointer group ${i % 2 ? 'translate-y-8' : ''}`} onClick={() => setQuickBuyProduct(p)}>
                                        {p.coverImage?.url ? (
                                            <div className="relative">
                                                <img src={p.coverImage.url} alt={p.title} className="aspect-[3/4] w-full rounded-xl object-cover shadow-lg ring-1 ring-line group-hover:scale-105 transition" />
                                                <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/80 backdrop-blur-xs p-2 text-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition">
                                                    Buy Now · {money(p.finalPrice, p.currency)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex aspect-[3/4] flex-col justify-end rounded-xl bg-gradient-to-br from-accent to-brand p-4 text-white shadow-lg group-hover:scale-105 transition">
                                                <span className="text-base font-bold leading-snug">{p.title}</span>
                                                <span className="text-xs font-semibold text-yellow-300 mt-2">Buy Now · {money(p.finalPrice, p.currency)}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Promotions: only real, active offers */}
            {sec.banners !== false && (data?.banners?.length > 0 || data?.offers?.length > 0) && (
                <section className="container-page pt-10">
                    <div className="grid gap-4 md:grid-cols-2">
                        {data.banners.map((b, i) => (
                            <Link key={`b${i}`} to={b.link || '/ebooks'} className="flex items-center gap-4 rounded-2xl border border-brand-tint bg-brand-pale p-5 no-underline hover:border-brand">
                                {b.imageUrl && <img src={b.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />}
                                <div>
                                    <p className="font-semibold text-ink">{b.title}</p>
                                    {b.text && <p className="text-sm text-ink-soft">{b.text}</p>}
                                </div>
                            </Link>
                        ))}
                        {data.offers.map((o) => (
                            <div key={o.id} className="flex items-start gap-4 rounded-2xl border border-accent-tint bg-accent-pale p-5">
                                <Tag className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden />
                                <div>
                                    <p className="font-semibold">{o.bannerText || o.name}</p>
                                    <p className="text-sm text-ink-soft">
                                        {o.discountType === 'percentage' ? `${o.value}% off` : o.discountType === 'fixed' ? `${money(o.value)} off` : `Bundle for ${money(o.value)}`}
                                        {o.couponCode && (
                                            <>
                                                {' '}with code <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-ink">{o.couponCode}</code>
                                            </>
                                        )}
                                        {o.minOrderAmount > 0 && ` on orders over ${money(o.minOrderAmount)}`}
                                        {o.endsAt && ` · Ends ${date(o.endsAt)}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {sec.featured !== false && (loading || data?.featured?.length > 0) && (
                <Section title="Featured eBooks" subtitle="Hand-picked guides to get you started" link={{ to: '/ebooks', label: 'View all' }}>
                    <ProductGrid products={data?.featured || []} loading={loading} count={4} onQuickBuy={setQuickBuyProduct} />
                </Section>
            )}

            {sec.categories !== false && data?.categories?.length > 0 && (
                <Section title="Browse by topic" link={{ to: '/categories', label: 'All categories' }} className="!pt-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {data.categories.map((c) => (
                            <Link key={c._id} to={`/category/${c.slug}`} className="group rounded-2xl border border-line p-5 no-underline transition hover:border-accent hover:bg-accent-pale">
                                {c.image ? <img src={c.image} alt="" className="mb-3 h-10 w-10 rounded-lg object-cover" /> : <BookOpen className="mb-3 h-7 w-7 text-accent" aria-hidden />}
                                <p className="font-semibold text-ink">{c.name}</p>
                                {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            {sec.bestsellers !== false && data?.bestsellers?.length > 0 && (
                <Section title="Bestsellers" subtitle="Our most purchased titles" link={{ to: '/ebooks?sort=popular', label: 'See more' }}>
                    <ProductGrid products={data.bestsellers.slice(0, 8)} onQuickBuy={setQuickBuyProduct} />
                </Section>
            )}

            <AdSlot placement="home_mid" />

            {sec.recent !== false && (loading || data?.recent?.length > 0) && (
                <Section title="New releases" subtitle="Recently published eBooks" link={{ to: '/ebooks?sort=newest', label: 'See all new' }}>
                    <ProductGrid products={data?.recent || []} loading={loading} count={4} onQuickBuy={setQuickBuyProduct} />
                </Section>
            )}

            {sec.whyUs !== false && home?.whyUs?.length > 0 && (
                <section className="border-y border-line bg-surface">
                    <div className="container-page py-14">
                        <h2 className="text-center text-2xl font-bold sm:text-3xl">Why readers choose {config?.general?.siteName || 'OpenPage'}</h2>
                        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {home.whyUs.map((w, i) => {
                                const Icon = WHY_ICONS[i % WHY_ICONS.length];
                                return (
                                    <div key={w.title} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                                        <Icon className="h-7 w-7 text-brand" aria-hidden />
                                        <h3 className="mt-4 font-semibold">{w.title}</h3>
                                        <p className="mt-1.5 text-sm leading-6 text-muted">{w.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {sec.howItWorks !== false && home?.howItWorks?.length > 0 && (
                <Section id="how-it-works" title="How digital delivery works" subtitle="From checkout to reading in a few minutes">
                    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {home.howItWorks.map((s, i) => {
                            const Icon = STEP_ICONS[i % STEP_ICONS.length];
                            return (
                                <li key={s.title} className="relative rounded-2xl border border-line p-6">
                                    <span className="absolute right-5 top-5 text-3xl font-extrabold text-accent-tint">{i + 1}</span>
                                    <Icon className="h-7 w-7 text-accent" aria-hidden />
                                    <h3 className="mt-4 font-semibold">{s.title}</h3>
                                    <p className="mt-1.5 text-sm leading-6 text-muted">{s.text}</p>
                                </li>
                            );
                        })}
                    </ol>
                </Section>
            )}

            {/* Only genuine, approved reviews from verified buyers are shown here. */}
            {sec.testimonials !== false && data?.testimonials?.length > 0 && (
                <Section title="What readers say" subtitle="Reviews from verified buyers">
                    <div className="grid gap-5 md:grid-cols-3">
                        {data.testimonials.map((t) => (
                            <figure key={t._id} className="rounded-2xl border border-line p-6">
                                <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={`h-4 w-4 ${i < t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} aria-hidden />
                                    ))}
                                </div>
                                {t.title && <p className="mt-3 font-semibold">{t.title}</p>}
                                <blockquote className="mt-2 text-sm leading-6 text-ink-soft">“{t.body}”</blockquote>
                                <figcaption className="mt-4 text-sm text-muted">
                                    {t.displayName || 'Verified buyer'} · <Link to={`/ebooks/${t.product?.slug}`}>{t.product?.title}</Link>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </Section>
            )}

            {sec.faq !== false && home?.faqs?.length > 0 && (
                <Section title="Frequently asked questions" link={{ to: '/faq', label: 'All FAQs' }}>
                    <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line">
                        {home.faqs.map((f) => (
                            <details key={f.question} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                                    {f.question}
                                    <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
                                </summary>
                                <p className="mt-3 text-sm leading-6 text-ink-soft">{f.answer}</p>
                            </details>
                        ))}
                    </div>
                </Section>
            )}

            {(sec.newsletter !== false && config?.features?.newsletter) || config?.notifications?.enabled ? (
                <section className="container-page pb-6">
                    <div className="grid gap-5 lg:grid-cols-2">
                        {sec.newsletter !== false && config?.features?.newsletter && (
                            <div className="rounded-2xl bg-gradient-to-br from-brand to-accent p-8 text-white">
                                <h2 className="text-2xl font-bold">{home?.newsletter?.title}</h2>
                                <p className="mt-2 text-white/90">{home?.newsletter?.text}</p>
                                <div className="mt-5 rounded-xl bg-white p-3 text-ink">
                                    <NewsletterForm source="homepage" />
                                </div>
                            </div>
                        )}
                        <NotificationPrompt />
                    </div>
                </section>
            ) : null}

            {count > 0 && (
                <aside className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md transition-all duration-300" aria-label="Cart summary">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-ink/95 px-5 py-3.5 text-white shadow-2xl backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                                <ShoppingCart className="h-5 w-5" />
                                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                                    {count}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-white/70">
                                    {count} {count === 1 ? 'eBook' : 'eBooks'} in cart
                                </p>
                                <p className="text-sm font-bold text-white">
                                    {money(subtotal, currency)}
                                </p>
                            </div>
                        </div>
                        <Link
                            to="/cart"
                            className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-brand-dark no-underline"
                        >
                            View cart <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </aside>
            )}

            <QuickCheckoutModal
                product={quickBuyProduct}
                open={Boolean(quickBuyProduct)}
                onClose={() => setQuickBuyProduct(null)}
            />
        </>
    );
}
