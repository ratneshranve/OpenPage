import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { trackAddToCart } from '../lib/tracking';

/**
 * The cart stores only product IDs and display snapshots. Prices shown in the cart are always
 * re-quoted from the server; the browser never decides what is charged.
 */
const CartContext = createContext(null);
const KEY = 'op_cart_v1';

const load = () => {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '{}');
        return { items: Array.isArray(v.items) ? v.items : [], coupon: v.coupon || '' };
    } catch {
        return { items: [], coupon: '' };
    }
};

export function CartProvider({ children }) {
    const [state, setState] = useState(load);

    useEffect(() => {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch {
            /* storage unavailable */
        }
    }, [state]);

    // Keep tabs in sync.
    useEffect(() => {
        const onStorage = (e) => e.key === KEY && setState(load());
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const stateRef = useRef(state);
    stateRef.current = state;

    const add = useCallback((product, { silent } = {}) => {
        if (stateRef.current.items.some((i) => i.id === product._id)) {
            if (!silent) toast('Already in your cart.', { icon: '📘' });
            return;
        }
        const item = { id: product._id, title: product.title, slug: product.slug, coverImage: product.coverImage?.url, price: product.finalPrice ?? product.price, currency: product.currency };
        setState((s) => (s.items.some((i) => i.id === item.id) ? s : { ...s, items: [...s.items, item] }));
        trackAddToCart(product);
        if (!silent) toast.success('Added to cart.');
    }, []);

    const remove = useCallback((id) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })), []);
    const removeMany = useCallback((ids) => setState((s) => ({ ...s, items: s.items.filter((i) => !ids.includes(i.id)) })), []);
    const setCoupon = useCallback((coupon) => setState((s) => ({ ...s, coupon })), []);
    const replace = useCallback((items) => setState((s) => ({ ...s, items })), []);
    const clear = useCallback(() => {
        setState({ items: [], coupon: '' });
        try {
            localStorage.removeItem('op_checkout_session');
        } catch {
            /* ignore */
        }
    }, []);

    const value = useMemo(
        () => ({ items: state.items, coupon: state.coupon, count: state.items.length, has: (id) => state.items.some((i) => i.id === id), add, remove, removeMany, setCoupon, replace, clear }),
        [state, add, remove, removeMany, setCoupon, replace, clear]
    );
    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
