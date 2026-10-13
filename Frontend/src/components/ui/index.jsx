import { forwardRef, useEffect, useId, useRef } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { money, percentOff } from '../../lib/format';

export const cn = clsx;

export const Spinner = ({ className, label = 'Loading' }) => (
    <Loader2 className={cn('animate-spin', className || 'h-5 w-5')} aria-label={label} role="status" />
);

const variants = {
    primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
    secondary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
    outline: 'border border-line bg-white text-ink hover:bg-surface',
    ghost: 'text-ink hover:bg-surface',
    danger: 'bg-danger text-white hover:bg-red-800 shadow-sm',
    'outline-danger': 'border border-red-200 bg-white text-danger hover:bg-danger-pale',
    link: 'text-accent hover:text-accent-hover underline-offset-4 hover:underline px-0',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]', lg: 'h-12 px-6 text-base' };

/** Disables itself while loading to prevent duplicate submissions. */
export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, as: As = 'button', type, ...props }, ref) {
    return (
        <As
            ref={ref}
            type={As === 'button' ? type || 'button' : undefined}
            disabled={As === 'button' ? disabled || loading : undefined}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-semibold no-underline transition disabled:cursor-not-allowed disabled:opacity-60',
                variants[variant],
                variant !== 'link' && sizes[size],
                variant === 'primary' || variant === 'secondary' || variant === 'danger' ? 'hover:text-white' : '',
                className
            )}
            {...props}
        >
            {loading && <Spinner className="h-4 w-4" />}
            {children}
        </As>
    );
});

export function Field({ label, error, hint, children, required, className, id }) {
    return (
        <div className={className}>
            {label && (
                <label htmlFor={id} className="label">
                    {label}
                    {required && <span className="text-danger"> *</span>}
                </label>
            )}
            {children}
            {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
            {error && (
                <p className="mt-1.5 flex items-center gap-1 text-sm text-danger" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    {error}
                </p>
            )}
        </div>
    );
}

export const Input = forwardRef(function Input({ label, error, hint, className, required, id: idProp, ...props }, ref) {
    const auto = useId();
    const id = idProp || auto;
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className} id={id}>
            <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-required={required} className={cn('input', error && 'input-error')} {...props} />
        </Field>
    );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, required, rows = 4, id: idProp, ...props }, ref) {
    const auto = useId();
    const id = idProp || auto;
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className} id={id}>
            <textarea ref={ref} id={id} rows={rows} aria-invalid={Boolean(error)} className={cn('input', error && 'input-error')} {...props} />
        </Field>
    );
});

export const Select = forwardRef(function Select({ label, error, hint, className, required, options = [], placeholder, id: idProp, ...props }, ref) {
    const auto = useId();
    const id = idProp || auto;
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className} id={id}>
            <select ref={ref} id={id} aria-invalid={Boolean(error)} className={cn('input pr-8', error && 'input-error')} {...props}>
                {placeholder !== undefined && <option value="">{placeholder}</option>}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </Field>
    );
});

export const Checkbox = forwardRef(function Checkbox({ label, description, error, className, id: idProp, ...props }, ref) {
    const auto = useId();
    const id = idProp || auto;
    return (
        <div className={className}>
            <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
                <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line accent-[var(--color-brand)]" aria-invalid={Boolean(error)} {...props} />
                <span className="text-sm leading-6 text-ink-soft">
                    {label}
                    {description && <span className="block text-muted">{description}</span>}
                </span>
            </label>
            {error && (
                <p className="mt-1 text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
});

export function Toggle({ checked, onChange, label, description, disabled }) {
    const id = useId();
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <label htmlFor={id} className="text-sm font-medium text-ink">
                    {label}
                </label>
                {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={Boolean(checked)}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-brand' : 'bg-gray-300')}
            >
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
            </button>
        </div>
    );
}

const badgeTones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-brand-tint text-brand-hover',
    blue: 'bg-accent-tint text-accent-hover',
    red: 'bg-red-100 text-danger',
    yellow: 'bg-yellow-100 text-warn',
    navy: 'bg-ink text-white',
};
export const Badge = ({ tone = 'gray', children, className }) => <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>{children}</span>;

const STATUS_TONES = {
    paid: 'green', sent: 'green', active: 'green', published: 'green', live: 'green', processed: 'green', captured: 'green', subscribed: 'green', approved: 'green', resolved: 'green', done: 'green', used: 'green',
    pending: 'yellow', queued: 'yellow', processing: 'yellow', scheduled: 'blue', draft: 'gray', requested: 'yellow', under_review: 'blue', sending: 'blue', attempted: 'yellow', authorized: 'blue', open: 'blue', created: 'gray', not_started: 'gray', partial: 'yellow', partially_refunded: 'yellow',
    failed: 'red', cancelled: 'gray', rejected: 'red', suspended: 'red', revoked: 'red', refunded: 'gray', unpublished: 'gray', archived: 'gray', expired: 'gray', paused: 'yellow', inactive: 'gray', unsubscribed: 'gray', suppressed: 'gray', exhausted: 'gray', closed: 'gray', ignored: 'gray', none: 'gray', received: 'blue',
};
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONES[status] || 'gray'}>{String(status || '—').replace(/_/g, ' ')}</Badge>;

const alertTones = {
    info: { cls: 'border-accent-tint bg-accent-pale text-ink', Icon: Info, icon: 'text-accent' },
    success: { cls: 'border-brand-tint bg-brand-pale text-ink', Icon: CheckCircle2, icon: 'text-brand' },
    error: { cls: 'border-red-200 bg-danger-pale text-ink', Icon: AlertCircle, icon: 'text-danger' },
    warning: { cls: 'border-yellow-200 bg-warn-pale text-ink', Icon: TriangleAlert, icon: 'text-warn' },
};
export function Alert({ tone = 'info', title, children, className, action }) {
    const t = alertTones[tone];
    return (
        <div className={cn('flex gap-3 rounded-xl border p-4', t.cls, className)} role={tone === 'error' ? 'alert' : 'status'}>
            <t.Icon className={cn('mt-0.5 h-5 w-5 shrink-0', t.icon)} aria-hidden />
            <div className="min-w-0 flex-1 text-sm leading-6">
                {title && <p className="font-semibold text-ink">{title}</p>}
                {children && <div className="text-ink-soft">{children}</div>}
                {action && <div className="mt-3">{action}</div>}
            </div>
        </div>
    );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.activeElement;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        ref.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            prev?.focus?.();
        };
    }, [open, onClose]);
    if (!open) return null;
    const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cn('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl', widths[size])}>
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
            </div>
        </div>
    );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', loading, onConfirm, onClose, children }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant={tone} onClick={onConfirm} loading={loading}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {message && <p className="text-sm leading-6 text-ink-soft">{message}</p>}
            {children}
        </Modal>
    );
}

export const EmptyState = ({ icon: Icon, title, children, action }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        {Icon && <Icon className="mb-3 h-10 w-10 text-muted" aria-hidden />}
        <p className="text-base font-semibold text-ink">{title}</p>
        {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);

export function Pagination({ page, pages, onChange }) {
    if (!pages || pages <= 1) return null;
    return (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="px-3 text-sm text-muted">
                Page {page} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
                Next <ChevronRight className="h-4 w-4" />
            </Button>
        </nav>
    );
}

export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-lg bg-gray-100', className)} />;

export const PageLoader = ({ label = 'Loading…' }) => (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted" role="status">
        <Spinner /> <span>{label}</span>
    </div>
);

/** Shows the real paid price; the original price only when a genuine discount exists. */
export function Price({ product, size = 'md' }) {
    const final = product.finalPrice ?? product.price;
    const original = product.displayOriginalPrice;
    const off = percentOff(original, final);
    const big = size === 'lg';
    return (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn('font-bold text-ink', big ? 'text-3xl' : 'text-lg')}>{money(final, product.currency)}</span>
            {original && off > 0 && (
                <>
                    <span className={cn('text-muted line-through', big ? 'text-lg' : 'text-sm')}>
                        <span className="sr-only">Original price </span>
                        {money(original, product.currency)}
                    </span>
                    <Badge tone="green">{off}% off</Badge>
                </>
            )}
        </div>
    );
}

export function Tabs({ tabs, value, onChange }) {
    return (
        <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
            {tabs.map((t) => (
                <button
                    key={t.value}
                    role="tab"
                    type="button"
                    aria-selected={value === t.value}
                    onClick={() => onChange(t.value)}
                    className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition', value === t.value ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}
                >
                    {t.label}
                    {t.count != null && <span className="ml-1.5 rounded-full bg-surface px-1.5 text-xs">{t.count}</span>}
                </button>
            ))}
        </div>
    );
}

export function BookCover({ src, title, className }) {
    if (src) return <img src={src} alt={`Cover of ${title}`} loading="lazy" decoding="async" className={cn('aspect-[3/4] w-full rounded-xl object-cover', className)} />;
    // Placeholder cover for products without an uploaded image.
    return (
        // Text sizes follow the cover's width (container units) so thumbnails stay legible.
        <div className={cn('w-full rounded-xl [container-type:inline-size]', className)} role="img" aria-label={`Cover of ${title}`}>
            <div className="flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-[inherit] bg-gradient-to-br from-accent to-brand p-[7cqw] text-white">
                <span className="text-[6cqw] font-semibold uppercase tracking-wider opacity-80">OpenPage</span>
                <span className="line-clamp-4 text-[9cqw] font-bold leading-snug">{title}</span>
            </div>
        </div>
    );
}
