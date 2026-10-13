import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { money } from '../../lib/format';
import { BookCover } from '../ui';

/** Renders a server-calculated quote. Every number shown here comes from the backend. */
export default function OrderSummary({ quote, onRemove, compact }) {
    if (!quote) return null;
    const c = quote.currency;
    return (
        <div>
            <ul className="divide-y divide-line">
                {quote.items.map((i) => (
                    <li key={i.product} className="flex gap-3 py-3">
                        <Link to={`/ebooks/${i.slug}`} className="block w-14 shrink-0">
                            <BookCover src={i.coverImage} title={i.title} className="rounded-md" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <Link to={`/ebooks/${i.slug}`} className="line-clamp-2 text-sm font-medium text-ink no-underline hover:text-accent">
                                {i.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">{i.format} eBook</p>
                            {i.discount > 0 && i.offerName && <p className="mt-0.5 text-xs text-brand">{i.offerName}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold">{money(i.total, c)}</p>
                            {i.discount > 0 && <p className="text-xs text-muted line-through">{money(i.unitPrice, c)}</p>}
                            {onRemove && (
                                <button type="button" onClick={() => onRemove(String(i.product))} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-danger" aria-label={`Remove ${i.title}`}>
                                    <X className="h-3.5 w-3.5" /> Remove
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <dl className={`space-y-2 border-t border-line pt-4 text-sm ${compact ? '' : 'mt-1'}`}>
                <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd>{money(quote.subtotal, c)}</dd>
                </div>
                {quote.automaticDiscount > 0 && (
                    <div className="flex justify-between text-brand">
                        <dt>Offer discount</dt>
                        <dd>-{money(quote.automaticDiscount, c)}</dd>
                    </div>
                )}
                {quote.couponDiscount > 0 && (
                    <div className="flex justify-between text-brand">
                        <dt>Coupon {quote.coupon?.code && <code className="rounded bg-brand-pale px-1">{quote.coupon.code}</code>}</dt>
                        <dd>-{money(quote.couponDiscount, c)}</dd>
                    </div>
                )}
                {quote.tax && quote.tax.amount > 0 && (
                    <div className="flex justify-between text-muted">
                        <dt>
                            {quote.tax.label} ({quote.tax.rate}%){quote.tax.inclusive ? ' included' : ''}
                        </dt>
                        <dd>{quote.tax.inclusive ? money(quote.tax.amount, c) : `+${money(quote.tax.amount, c)}`}</dd>
                    </div>
                )}
                <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
                    <dt>Total</dt>
                    <dd>{money(quote.total, c)}</dd>
                </div>
            </dl>
        </div>
    );
}
