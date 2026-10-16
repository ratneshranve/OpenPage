import { Link } from 'react-router-dom';
import { ShoppingCart, Check, Star, Zap } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Badge, BookCover, Button, Price, Skeleton } from '../ui';

export function ProductCard({ product, onQuickBuy }) {
    const { add, has } = useCart();
    const inCart = has(product._id);
    return (
        <article className="group flex flex-col">
            <Link to={`/ebooks/${product.slug}`} className="relative block no-underline" aria-label={product.title}>
                <BookCover src={product.coverImage?.url} title={product.title} className="shadow-sm ring-1 ring-line transition group-hover:shadow-md" />
                <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
                    {product.isBestseller && <Badge tone="navy">Bestseller</Badge>}
                    {product.activeOffer && <Badge tone="green">{product.activeOffer.bannerText || 'On sale'}</Badge>}
                </div>
            </Link>
            <div className="mt-3 flex flex-1 flex-col">
                <h3 className="text-[15px] font-semibold leading-snug">
                    <Link to={`/ebooks/${product.slug}`} className="text-ink no-underline hover:text-accent">
                        {product.title}
                    </Link>
                </h3>
                {product.author && <p className="mt-0.5 text-sm text-muted">{product.author}</p>}
                {product.shortDescription && <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{product.shortDescription}</p>}
                {product.ratingCount > 0 && (
                    <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden />
                        <span className="font-medium text-ink">{product.ratingAverage.toFixed(1)}</span> ({product.ratingCount})
                    </p>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-3">
                    <div className="flex items-end justify-between gap-2">
                        <Price product={product} />
                        <Button size="sm" variant={inCart ? 'outline' : 'ghost'} onClick={() => add(product)} className="border border-line h-8 px-2 text-xs" aria-label={inCart ? `${product.title} is in your cart` : `Add ${product.title} to cart`}>
                            {inCart ? <Check className="h-3.5 w-3.5 text-brand" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                    {onQuickBuy && (
                        <Button size="sm" className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold h-9 text-xs shadow-xs" onClick={() => onQuickBuy(product)}>
                            <Zap className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" /> Buy Now
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}

export function ProductGrid({ products, loading, count = 8, columns = 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4', onQuickBuy }) {
    if (loading) {
        return (
            <div className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 ${columns}`}>
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i}>
                        <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                        <Skeleton className="mt-3 h-4 w-3/4" />
                        <Skeleton className="mt-2 h-4 w-1/2" />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 ${columns}`}>
            {products.map((p) => (
                <ProductCard key={p._id} product={p} onQuickBuy={onQuickBuy} />
            ))}
        </div>
    );
}
