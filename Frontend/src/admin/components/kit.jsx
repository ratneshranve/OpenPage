import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ImagePlus, Plus, Search, Trash2, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { Alert, Button, EmptyState, Input, Pagination, Spinner, cn } from '../../components/ui';
import { api, get, errorMessage, apiOrigin } from '../../lib/api';

/** Loads admin data and exposes reload/setData. */
export function useAdminData(url, params, { skip } = {}) {
    const [state, setState] = useState({ loading: !skip, data: null, error: '' });
    const key = JSON.stringify(params || {});
    const load = useCallback(async () => {
        if (skip || !url) return;
        setState((s) => ({ ...s, loading: true, error: '' }));
        try {
            const data = await get(url, params);
            setState({ loading: false, data, error: '' });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
        }
    }, [url, key, skip]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        load();
    }, [load]);
    return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })) };
}

/** Runs a mutation with toast feedback and a busy flag. */
export function useAction() {
    const [busy, setBusy] = useState('');
    const run = useCallback(async (key, fn, { success } = {}) => {
        setBusy(key);
        try {
            const r = await fn();
            const msg = success || r?.message;
            if (msg) toast.success(msg);
            return r;
        } catch (err) {
            toast.error(errorMessage(err));
            return undefined;
        } finally {
            setBusy('');
        }
    }, []);
    return { busy, run };
}

export function PageHeader({ title, description, actions, back }) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {back && (
                    <Link to={back.to} className="text-sm">
                        ← {back.label}
                    </Link>
                )}
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

export const Panel = ({ title, description, actions, children, className }) => (
    <section className={cn('card p-5', className)}>
        {(title || actions) && (
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                    {title && <h2 className="font-semibold">{title}</h2>}
                    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                {actions}
            </div>
        )}
        {children}
    </section>
);

export const StatCard = ({ label, value, hint, tone = 'ink', icon: Icon }) => (
    <div className="card p-4">
        <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{label}</p>
            {Icon && <Icon className={cn('h-5 w-5', tone === 'green' ? 'text-brand' : tone === 'blue' ? 'text-accent' : tone === 'red' ? 'text-danger' : 'text-muted')} />}
        </div>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
);

/**
 * Responsive table: a real table on wide screens, stacked cards on phones.
 * columns: [{ key, label, render?, className? }]
 */
export function DataTable({ columns, rows, loading, error, empty = 'Nothing here yet.', onRowClick, rowKey = (r) => r._id || r.id, pagination, onPage }) {
    if (error) return <Alert tone="error">{error}</Alert>;
    if (loading && !rows) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
                <Spinner /> Loading…
            </div>
        );
    }
    if (!rows?.length) return <EmptyState title={empty} />;
    return (
        <div className={cn(loading && 'opacity-60 transition')}>
            <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} scope="col" className={cn('px-4 py-3 font-semibold', c.className)}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((r) => (
                            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn(onRowClick && 'cursor-pointer hover:bg-surface')}>
                                {columns.map((c) => (
                                    <td key={c.key} className={cn('px-4 py-3 align-top', c.className)}>
                                        {c.render ? c.render(r) : r[c.key] ?? '—'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="space-y-3 md:hidden">
                {rows.map((r) => (
                    <li key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('card space-y-1.5 p-4 text-sm', onRowClick && 'cursor-pointer')}>
                        {columns.map((c) => (
                            <div key={c.key} className="flex justify-between gap-3">
                                <span className="text-muted">{c.label}</span>
                                <span className="min-w-0 text-right">{c.render ? c.render(r) : r[c.key] ?? '—'}</span>
                            </div>
                        ))}
                    </li>
                ))}
            </ul>
            {pagination && onPage && <Pagination page={pagination.page} pages={pagination.pages} onChange={onPage} />}
            {pagination && <p className="mt-2 text-center text-xs text-muted">{pagination.total} total</p>}
        </div>
    );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
    const [v, setV] = useState(value || '');
    const t = useRef(null);
    useEffect(() => setV(value || ''), [value]);
    return (
        <div className={cn('relative', className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
                type="search"
                value={v}
                aria-label={placeholder}
                onChange={(e) => {
                    setV(e.target.value);
                    clearTimeout(t.current);
                    t.current = setTimeout(() => onChange(e.target.value), 350);
                }}
                placeholder={placeholder}
                className="input h-10 pl-9 text-sm"
            />
        </div>
    );
}

export function FilterSelect({ value, onChange, options, label }) {
    return (
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="input h-10 w-auto text-sm">
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

/** Editable list of strings. */
export function StringListEditor({ label, value = [], onChange, placeholder, hint }) {
    const [draft, setDraft] = useState('');
    const add = () => {
        if (!draft.trim()) return;
        onChange([...value, draft.trim()]);
        setDraft('');
    };
    const move = (i, d) => {
        const next = [...value];
        [next[i], next[i + d]] = [next[i + d], next[i]];
        onChange(next);
    };
    return (
        <div>
            {label && <p className="label">{label}</p>}
            <ul className="space-y-1.5">
                {value.map((item, i) => (
                    <li key={`${i}-${item}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                        <span className="flex-1">{item}</span>
                        <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-muted hover:text-danger" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                ))}
            </ul>
            <div className="mt-2 flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={placeholder || 'Add item'} className="input h-9 text-sm" />
                <Button size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
    );
}

/** Editable list of objects with the given fields. */
export function ObjectListEditor({ label, value = [], onChange, fields, newItem, itemLabel = 'item' }) {
    const update = (i, key, v) => onChange(value.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
    return (
        <div>
            {label && <p className="label">{label}</p>}
            <div className="space-y-3">
                {value.map((row, i) => (
                    <div key={i} className="rounded-xl border border-line p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {fields.map((f) =>
                                f.type === 'textarea' ? (
                                    <label key={f.key} className="sm:col-span-2">
                                        <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
                                        <textarea rows={f.rows || 3} value={row[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)} className="input text-sm" />
                                    </label>
                                ) : f.type === 'checkbox' ? (
                                    <label key={f.key} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={row[f.key] !== false} onChange={(e) => update(i, f.key, e.target.checked)} /> {f.label}
                                    </label>
                                ) : f.type === 'image' ? (
                                    <div key={f.key} className="sm:col-span-2">
                                        <ImageField label={f.label} value={row[f.key]} onChange={(url) => update(i, f.key, url)} folder={f.folder || 'site'} compact />
                                    </div>
                                ) : (
                                    <label key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                                        <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
                                        <input type={f.type || 'text'} value={row[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)} className="input h-9 text-sm" placeholder={f.placeholder} />
                                    </label>
                                )
                            )}
                        </div>
                        <div className="mt-2 flex justify-end gap-1">
                            <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => { const n = [...value]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}><ArrowUp className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" disabled={i === value.length - 1} onClick={() => { const n = [...value]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); }}><ArrowDown className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /> Remove</Button>
                        </div>
                    </div>
                ))}
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => onChange([...value, { ...newItem }])}>
                <Plus className="h-4 w-4" /> Add {itemLabel}
            </Button>
        </div>
    );
}

export const uploadImages = async (files, folder) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('images', f));
    fd.append('folder', folder);
    const r = await api.post('/admin/media/images', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.data.map((d) => d.url);
};

/** Image URL field with an upload button (images go to public storage). */
export function ImageField({ label, value, onChange, folder = 'images', hint, compact }) {
    const id = useId();
    const [busy, setBusy] = useState(false);
    const onFile = async (e) => {
        if (!e.target.files?.length) return;
        setBusy(true);
        try {
            const [url] = await uploadImages(e.target.files, folder);
            onChange(url);
            toast.success('Image uploaded.');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setBusy(false);
            e.target.value = '';
        }
    };
    return (
        <div>
            {label && <label htmlFor={id} className={compact ? 'mb-1 block text-xs font-medium text-muted' : 'label'}>{label}</label>}
            <div className="flex items-center gap-3">
                {value ? <img src={value} alt="" className={cn('rounded-lg object-cover ring-1 ring-line', compact ? 'h-10 w-10' : 'h-16 w-16')} /> : <div className={cn('flex items-center justify-center rounded-lg bg-surface text-muted', compact ? 'h-10 w-10' : 'h-16 w-16')}><ImagePlus className="h-5 w-5" /></div>}
                <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" className="input h-9 flex-1 text-sm" />
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface">
                    {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Upload
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={onFile} disabled={busy} />
                </label>
            </div>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
    );
}

/** Money input in rupees that stores paise. */
export function MoneyInput({ label, value, onChange, hint, required, error }) {
    return (
        <Input
            label={label}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={value == null ? '' : value / 100}
            onChange={(e) => onChange(e.target.value === '' ? null : Math.round(Number(e.target.value) * 100))}
            hint={hint}
            required={required}
            error={error}
        />
    );
}

/** datetime-local helpers (local time in the browser). */
export const toLocalInput = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    const off = dt.getTimezoneOffset();
    return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const downloadCsv = async (url, params, filename) => {
    try {
        const r = await api.get(url, { params, responseType: 'blob' });
        const href = URL.createObjectURL(r.data);
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
    } catch (err) {
        toast.error(errorMessage(err));
    }
};

export const KeyValue = ({ items }) => (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {items.filter(Boolean).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line/70 py-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-right font-medium">{v ?? '—'}</dd>
            </div>
        ))}
    </dl>
);

export { apiOrigin };
