import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BookOpen, Download, Lock, MailCheck, ShoppingBag, ShoppingCart, Star, Tag, Zap } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { AdSlot, NotificationPrompt } from '../components/layout/Extras';
import { ProductGrid } from '../components/shop/ProductCard';
import NewsletterForm from '../components/shop/NewsletterForm';
import { Badge, Button } from '../components/ui';
import { useConfig } from '../context/ConfigContext';
import { useCart } from '../context/CartContext';
import { get } from '../lib/api';
import { date, money } from '../lib/format';

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

    const subtotal = items.reduce((acc, i) => acc + (Number(i.price) || 0), 0);
    const currency = items[0]?.currency || 'INR';

    useEffect(() => {
        get('/home')
            .then(setData)
            .catch(() => setData({ featured: [], bestsellers: [], recent: [], categories: [], banners: [], offers: [], testimonials: [] }))
            .finally(() => setLoading(false));
    }, []);

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

            {/* Hero */}
            <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-accent-pale/60 to-white">
                <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
                    <div>
                        {hero.eyebrow && <Badge tone="green">{hero.eyebrow}</Badge>}
                        <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{hero.title || 'Practical eBooks that help you work smarter'}</h1>
                        <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">{hero.subtitle}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            {hero.primaryCtaText && (
                                <Button as={Link} to={hero.primaryCtaLink || '/ebooks'} size="lg">
                                    {hero.primaryCtaText} <ArrowRight className="h-4 w-4" />
                                </Button>
                            )}
                            {hero.secondaryCtaText && (
                                <Button as={hero.secondaryCtaLink?.startsWith('#') ? 'a' : Link} href={hero.secondaryCtaLink} to={hero.secondaryCtaLink} variant="outline" size="lg">
                                    {hero.secondaryCtaText}
                                </Button>
                            )}
                        </div>
                        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                            <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand" /> Secure Razorpay checkout</li>
                            <li className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-brand" /> Instant email delivery</li>
                            <li className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-brand" /> Re-download any time</li>
                        </ul>
                    </div>
                    <div className="hidden lg:block">
                        {hero.image ? (
                            <img src={hero.image} alt="" className="mx-auto max-h-[440px] rounded-2xl object-contain" />
                        ) : (
                            <div className="relative mx-auto grid max-w-md grid-cols-2 gap-4">
                                {(data?.featured?.length ? data.featured : data?.recent || []).slice(0, 4).map((p, i) => (
                                    <Link key={p._id} to={`/ebooks/${p.slug}`} className={`block no-underline ${i % 2 ? 'translate-y-8' : ''}`}>
                                        {p.coverImage?.url ? (
                                            <img src={p.coverImage.url} alt={p.title} className="aspect-[3/4] w-full rounded-xl object-cover shadow-lg ring-1 ring-line" />
                                        ) : (
                                            <div className="flex aspect-[3/4] flex-col justify-end rounded-xl bg-gradient-to-br from-accent to-brand p-4 text-white shadow-lg">
                                                <span className="text-base font-bold leading-snug">{p.title}</span>
                                            </div>
                                        )}
                                    </Link>
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
                    <ProductGrid products={data?.featured || []} loading={loading} count={4} />
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
                    <ProductGrid products={data.bestsellers.slice(0, 8)} />
                </Section>
            )}

            <AdSlot placement="home_mid" />

            {sec.recent !== false && (loading || data?.recent?.length > 0) && (
                <Section title="New releases" subtitle="Recently published eBooks" link={{ to: '/ebooks?sort=newest', label: 'See all new' }}>
                    <ProductGrid products={data?.recent || []} loading={loading} count={4} />
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
        </>
    );
}
