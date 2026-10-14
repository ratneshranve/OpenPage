import { api } from './api';

const SESSION_KEY = 'op_checkout_session';
const ORDER_TOKENS_KEY = 'op_order_tokens';

export const getSessionToken = () => {
    try {
        return localStorage.getItem(SESSION_KEY);
    } catch {
        return null;
    }
};
export const setSessionToken = (t) => {
    try {
        if (t) localStorage.setItem(SESSION_KEY, t);
        else localStorage.removeItem(SESSION_KEY);
    } catch {
        /* ignore */
    }
};

/** Remembers which checkout session created an order, so its status page stays viewable. */
export const rememberOrderToken = (orderNumber, token) => {
    try {
        const map = JSON.parse(localStorage.getItem(ORDER_TOKENS_KEY) || '{}');
        map[orderNumber] = token;
        const entries = Object.entries(map).slice(-20);
        localStorage.setItem(ORDER_TOKENS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
        /* ignore */
    }
};
export const orderToken = (orderNumber) => {
    try {
        return JSON.parse(localStorage.getItem(ORDER_TOKENS_KEY) || '{}')[orderNumber] || getSessionToken();
    } catch {
        return null;
    }
};

export const fetchOrderStatus = (orderNumber) =>
    api.get(`/checkout/order-status/${encodeURIComponent(orderNumber)}`, { headers: { 'X-Checkout-Session': orderToken(orderNumber) || '' } }).then((r) => r.data.data);

export const markTracked = (orderNumber) =>
    api.post(`/checkout/order-status/${encodeURIComponent(orderNumber)}/tracked`, {}, { headers: { 'X-Checkout-Session': orderToken(orderNumber) || '' } }).catch(() => {});

let razorpayPromise = null;
export const loadRazorpay = () => {
    if (window.Razorpay) return Promise.resolve(true);
    if (!razorpayPromise) {
        razorpayPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.async = true;
            s.onload = () => resolve(true);
            s.onerror = () => {
                razorpayPromise = null;
                reject(new Error('Could not load the payment window. Please check your connection or disable blockers and try again.'));
            };
            document.body.appendChild(s);
        });
    }
    return razorpayPromise;
};

const PENDING_ORDER_KEY = 'op_pending_order';

export const savePendingOrder = (order) => {
    try {
        if (!order || !order.orderNumber) return;
        const data = {
            orderNumber: order.orderNumber,
            total: order.amount || order.total,
            currency: order.currency || 'INR',
            itemsCount: order.items?.length || 1,
            paymentMethod: order.paymentMethod || 'manual_upi',
            savedAt: Date.now(),
        };
        localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(data));
    } catch {
        /* ignore */
    }
};

export const getPendingOrder = () => {
    try {
        const raw = localStorage.getItem(PENDING_ORDER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Expose if saved within the last 24 hours
        if (Date.now() - parsed.savedAt > 24 * 3600 * 1000) {
            localStorage.removeItem(PENDING_ORDER_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

export const clearPendingOrder = (orderNumber) => {
    try {
        const current = getPendingOrder();
        if (!orderNumber || current?.orderNumber === orderNumber) {
            localStorage.removeItem(PENDING_ORDER_KEY);
        }
    } catch {
        /* ignore */
    }
};

