import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { Button } from '../ui';

export default function CouponForm({ applied, coupon, onApply, onRemove, loading }) {
    const [code, setCode] = useState('');
    if (applied) {
        return (
            <div className="flex items-center justify-between rounded-lg border border-brand-tint bg-brand-pale px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-brand" /> <code className="font-semibold">{applied}</code>
                    {coupon?.valid && <span className="text-muted">{coupon.message}</span>}
                </span>
                <button type="button" onClick={onRemove} className="rounded p-1 text-muted hover:text-danger" aria-label="Remove coupon">
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    }
    return (
        <form
            className="flex gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) onApply(code.trim().toUpperCase());
            }}
        >
            <label htmlFor="coupon" className="sr-only">
                Coupon code
            </label>
            <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon code" className="input h-10 uppercase" maxLength={40} autoComplete="off" />
            <Button type="submit" variant="outline" size="sm" className="h-10" loading={loading}>
                Apply
            </Button>
        </form>
    );
}
