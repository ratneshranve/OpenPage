import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo from '../components/layout/Seo';
import OrderSummary from '../components/shop/OrderSummary';
import CouponForm from '../components/shop/CouponForm';
import { Alert, Button, EmptyState, Skeleton } from '../components/ui';
import { useCart } from '../context/CartContext';
import { post, errorMessage } from '../lib/api';

export default function Cart() {
    const { items, coupon, remove, removeMany, setCoupon } = useCart();
    const navigate = useNavigate();
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [couponLoading, setCouponLoading] = useState(false);
    const [error, setError] = useState('');

    const ids = items.map((i) => i.id);
    const idsKey = ids.join(',');

    const refresh = useCallback(
        async (code = coupon) => {
            if (!idsKey) return setQuote(null);
            const r = await post('/checkout/validate-coupon', { productIds: idsKey.split(','), couponCode: code || null });
            const q = r.data;
            // Drop products that are no longer available.
            if (q.invalidItems.length) {
                removeMany(q.invalidItems.map((i) => i.productId));
                toast(`${q.invalidItems.length} unavailable item${q.invalidItems.length > 1 ? 's were' : ' was'} removed from your cart.`, { icon: 'ℹ️' });
            }
            setQuote(q);
            return q;
        },
        [idsKey, coupon, removeMany]
    );

    useEffect(() => {
        setLoading(true);
        setError('');
        refresh()
            .catch((err) => setError(errorMessage(err)))
            .finally(() => setLoading(false));
    }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const applyCoupon = async (code) => {
        setCouponLoading(true);
        try {
            const q = await refresh(code);
            if (q.coupon?.valid) {
                setCoupon(code);
                toast.success('Offer applied successfully.');
            } else toast.error(q.coupon?.message || 'This coupon code is not valid.');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            setCouponLoading(false);
        }
    };

    const removeCoupon = async () => {
        setCoupon('');
        await refresh('').catch(() => {});
    };

    if (!items.length) {
        return (
            <div className="container-page py-12">
                <Seo title="Your cart" noindex />
                <h1 className="mb-6 text-3xl font-bold">Your cart</h1>
                <EmptyState icon={ShoppingCart} title="Your cart is empty" action={<Button as={Link} to="/ebooks">Browse eBooks</Button>}>
                    Find a practical guide and it will appear here.
                </EmptyState>
            </div>
        );
    }

    return (
        <div className="container-page py-10">
            <Seo title="Your cart" noindex />
            <h1 className="text-3xl font-bold">Your cart</h1>
            <p className="mt-1 text-sm text-muted">Digital products. No shipping required: you receive a secure download link by email.</p>
            {error && <Alert tone="error" className="mt-6" title="Could not update your cart">{error}</Alert>}
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
                <div className="card p-5">
                    {loading && !quote ? (
                        <div className="space-y-4">
                            {ids.map((id) => <Skeleton key={id} className="h-16" />)}
                        </div>
                    ) : (
                        <OrderSummary quote={quote} onRemove={(id) => remove(id)} />
                    )}
                </div>
                <aside className="space-y-4">
                    <div className="card space-y-4 p-5">
                        <h2 className="font-semibold">Have a coupon?</h2>
                        <CouponForm applied={coupon && quote?.coupon?.valid ? coupon : ''} coupon={quote?.coupon} onApply={applyCoupon} onRemove={removeCoupon} loading={couponLoading} />
                        {coupon && quote?.coupon && !quote.coupon.valid && <Alert tone="warning">{quote.coupon.message}</Alert>}
                        <Button size="lg" className="w-full" disabled={!quote || loading || !quote.items.length} onClick={() => navigate('/checkout')}>
                            Proceed to checkout <ArrowRight className="h-4 w-4" />
                        </Button>
                        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                            <Lock className="h-3.5 w-3.5" /> Prices are confirmed securely at checkout
                        </p>
                    </div>
                    <Link to="/ebooks" className="block text-center text-sm">
                        Continue shopping
                    </Link>
                </aside>
            </div>
        </div>
    );
}
