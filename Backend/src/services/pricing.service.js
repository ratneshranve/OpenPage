import mongoose from 'mongoose';
import { Product, Offer, Order, OfferRedemption } from '../models/index.js';
import { getSettings } from './settings.service.js';
import { normalizeEmail } from '../utils/helpers.js';

/** Razorpay's minimum chargeable amount (₹1). Discounts never push a total below this. */
export const MIN_PAYABLE = 100;

export const activeOfferFilter = (now = new Date()) => ({
    active: true,
    paused: { $ne: true },
    $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        { $or: [{ redemptionLimit: null }, { $expr: { $lt: ['$redemptionCount', '$redemptionLimit'] } }] },
    ],
});

const productMatches = (offer, product) => {
    if (offer.appliesTo === 'all') return true;
    if (offer.appliesTo === 'products') return offer.products.some((id) => String(id) === String(product._id));
    if (offer.appliesTo === 'categories') return Boolean(product.category) && offer.categories.some((id) => String(id) === String(product.category));
    return false;
};

/**
 * Checks customer-dependent conditions. Returns { ok, reason, pending } where pending means
 * the condition can only be confirmed once the email is verified.
 */
const checkCustomerConditions = async (offer, { email, subtotal }) => {
    if (offer.minOrderAmount && subtotal < offer.minOrderAmount) return { ok: false, reason: 'min_order' };
    const needsEmail = offer.firstPurchaseOnly || offer.perCustomerLimit || offer.audienceEmails?.length;
    if (!needsEmail) return { ok: true };
    if (!email) return { ok: true, pending: true };
    if (offer.audienceEmails?.length && !offer.audienceEmails.includes(email)) return { ok: false, reason: 'audience' };
    if (offer.firstPurchaseOnly && (await Order.exists({ email, status: { $in: ['paid', 'partially_refunded', 'refunded'] } }))) return { ok: false, reason: 'first_purchase' };
    if (offer.perCustomerLimit) {
        const used = await OfferRedemption.countDocuments({ offer: offer._id, email });
        if (used >= offer.perCustomerLimit) return { ok: false, reason: 'per_customer' };
    }
    return { ok: true };
};

const REASONS = {
    min_order: (o) => `This code requires a minimum order of ₹${(o.minOrderAmount / 100).toFixed(0)}.`,
    audience: () => 'This code is not available for your email address.',
    first_purchase: () => 'This code is only valid on your first purchase.',
    per_customer: () => 'You have already used this code the maximum number of times.',
    not_found: () => 'This coupon code is not valid.',
    inactive: () => 'This coupon code has expired or is not active.',
    no_items: () => 'This code does not apply to the items in your cart.',
    worse: () => 'A better offer is already applied to your cart.',
};

/** Discount for a set of lines under one offer, before the max-discount cap. */
const offerDiscountFor = (offer, lines) => {
    if (!lines.length) return [];
    if (offer.discountType === 'percentage') {
        return lines.map((l) => Math.floor((l.base * Math.min(100, offer.value)) / 100));
    }
    if (offer.discountType === 'fixed') {
        if (offer.couponCode) {
            // Coupon: fixed amount off the eligible subtotal, spread proportionally.
            const sum = lines.reduce((s, l) => s + l.base, 0);
            const total = Math.min(offer.value, sum);
            let given = 0;
            return lines.map((l, idx) => {
                const share = idx === lines.length - 1 ? total - given : Math.floor((total * l.base) / sum);
                given += share;
                return share;
            });
        }
        return lines.map((l) => Math.min(offer.value, l.base));
    }
    if (offer.discountType === 'bundle') {
        const needed = offer.products.map(String);
        const present = lines.filter((l) => needed.includes(String(l.product._id)));
        if (needed.length < 2 || present.length !== needed.length) return lines.map(() => 0);
        const sum = present.reduce((s, l) => s + l.base, 0);
        const total = Math.max(0, sum - offer.value);
        let given = 0;
        return lines.map((l) => {
            if (!needed.includes(String(l.product._id))) return 0;
            const isLast = l === present[present.length - 1];
            const share = isLast ? total - given : Math.floor((total * l.base) / sum);
            given += share;
            return share;
        });
    }
    return lines.map(() => 0);
};

const capDiscounts = (offer, discounts) => {
    const total = discounts.reduce((s, d) => s + d, 0);
    if (!offer.maxDiscountAmount || total <= offer.maxDiscountAmount) return discounts;
    const ratio = offer.maxDiscountAmount / total;
    let given = 0;
    return discounts.map((d, idx) => {
        const v = idx === discounts.length - 1 ? offer.maxDiscountAmount - given : Math.floor(d * ratio);
        given += v;
        return Math.max(0, v);
    });
};

/**
 * Prices a cart. Every amount comes from MongoDB; nothing from the browser is trusted.
 * @param {{ productIds: string[], couponCode?: string, email?: string }} input
 */
export const priceCart = async ({ productIds = [], couponCode, email }) => {
    email = email ? normalizeEmail(email) : null;
    const uniqueIds = [...new Set(productIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
    const products = await Product.find({ _id: { $in: uniqueIds } }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const invalidItems = [];
    const lines = [];
    let currency = null;
    for (const id of uniqueIds) {
        const p = byId.get(id);
        if (!p || p.status !== 'published' || !p.file?.key || p.price < MIN_PAYABLE) {
            invalidItems.push({ productId: id, title: p?.title, reason: !p ? 'not_found' : p.status !== 'published' ? 'unavailable' : 'not_purchasable' });
            continue;
        }
        if (currency && p.currency !== currency) {
            invalidItems.push({ productId: id, title: p.title, reason: 'currency_mismatch' });
            continue;
        }
        currency = p.currency;
        lines.push({ product: p, base: p.price, auto: 0, autoOffer: null, coupon: 0 });
    }
    currency = currency || (await getSettings('general')).currency || 'INR';
    const subtotal = lines.reduce((s, l) => s + l.base, 0);

    // 1. Best automatic (code-free) offer per line.
    const now = new Date();
    const autoOffers = await Offer.find({ ...activeOfferFilter(now), $or: [{ couponCode: null }, { couponCode: { $exists: false } }] }).lean();
    for (const offer of autoOffers) {
        const check = await checkCustomerConditions(offer, { email, subtotal });
        if (!check.ok || check.pending) continue;
        const eligible = lines.filter((l) => productMatches(offer, l.product));
        const discounts = capDiscounts(offer, offerDiscountFor(offer, eligible));
        eligible.forEach((l, idx) => {
            if (discounts[idx] > l.auto) {
                l.auto = discounts[idx];
                l.autoOffer = offer;
            }
        });
    }

    // 2. Coupon code.
    let coupon = null;
    if (couponCode) {
        const code = String(couponCode).trim().toUpperCase();
        const offer = await Offer.findOne({ couponCode: code }).lean();
        if (!offer) coupon = { code, valid: false, message: REASONS.not_found() };
        else {
            const isActive = await Offer.exists({ _id: offer._id, ...activeOfferFilter(now) });
            if (!isActive) coupon = { code, valid: false, message: REASONS.inactive() };
            else {
                const check = await checkCustomerConditions(offer, { email, subtotal });
                const eligible = lines.filter((l) => productMatches(offer, l.product) && (offer.stackable ? !l.autoOffer || l.autoOffer.stackable : true));
                if (!check.ok) coupon = { code, valid: false, message: REASONS[check.reason](offer) };
                else if (!eligible.length) coupon = { code, valid: false, message: REASONS.no_items() };
                else {
                    const bases = eligible.map((l) => ({ ...l, base: offer.stackable ? l.base - l.auto : l.base }));
                    const discounts = capDiscounts(offer, offerDiscountFor(offer, bases));
                    const couponTotal = discounts.reduce((s, d) => s + d, 0);
                    const replacedAuto = offer.stackable ? 0 : eligible.reduce((s, l) => s + l.auto, 0);
                    if (couponTotal <= 0) coupon = { code, valid: false, message: REASONS.no_items() };
                    else if (!offer.stackable && couponTotal <= replacedAuto) coupon = { code, valid: false, message: REASONS.worse() };
                    else {
                        eligible.forEach((l, idx) => {
                            l.coupon = discounts[idx];
                            if (!offer.stackable) {
                                l.auto = 0;
                                l.autoOffer = null;
                            }
                        });
                        coupon = {
                            code,
                            valid: true,
                            offerId: offer._id,
                            name: offer.name,
                            pendingVerification: Boolean(check.pending),
                            message: check.pending ? 'Code applied. Eligibility is confirmed after you verify your email.' : 'Coupon applied.',
                        };
                    }
                }
            }
        }
    }

    // 3. Line totals, never below the minimum payable amount overall.
    const items = lines.map((l) => {
        const discount = Math.min(l.base, l.auto + l.coupon);
        return {
            product: l.product._id,
            title: l.product.title,
            slug: l.product.slug,
            coverImage: l.product.coverImage?.url,
            format: l.product.file?.format || l.product.format,
            fileVersion: l.product.file?.version,
            unitPrice: l.base,
            compareAtPrice: l.product.compareAtPrice,
            discount,
            total: l.base - discount,
            appliedOffer: l.coupon ? coupon?.offerId : l.autoOffer?._id,
            offerName: l.coupon ? coupon?.name : l.autoOffer?.name,
            autoDiscount: l.auto,
            couponDiscount: l.coupon,
        };
    });
    let automaticDiscount = items.reduce((s, i) => s + i.autoDiscount, 0);
    let couponDiscount = items.reduce((s, i) => s + i.couponDiscount, 0);
    let afterDiscount = subtotal - automaticDiscount - couponDiscount;
    if (items.length && afterDiscount < MIN_PAYABLE) {
        // Give back discount (coupon first, then automatic) so the order stays payable,
        // keeping the line items consistent with the order total.
        let excess = MIN_PAYABLE - afterDiscount;
        for (const key of ['couponDiscount', 'autoDiscount']) {
            for (const item of items) {
                if (!excess) break;
                const take = Math.min(excess, item[key]);
                item[key] -= take;
                item.discount -= take;
                item.total += take;
                excess -= take;
            }
        }
        automaticDiscount = items.reduce((s, i) => s + i.autoDiscount, 0);
        couponDiscount = items.reduce((s, i) => s + i.couponDiscount, 0);
        afterDiscount = subtotal - automaticDiscount - couponDiscount;
    }

    const taxSettings = (await getSettings('checkout')).tax;
    let tax = { label: taxSettings.label, rate: taxSettings.ratePercent, inclusive: taxSettings.inclusive, amount: 0 };
    let total = afterDiscount;
    if (taxSettings.enabled && taxSettings.ratePercent > 0) {
        const r = taxSettings.ratePercent / 100;
        if (taxSettings.inclusive) tax.amount = Math.round(afterDiscount - afterDiscount / (1 + r));
        else {
            tax.amount = Math.round(afterDiscount * r);
            total = afterDiscount + tax.amount;
        }
    } else tax = null;

    const offersApplied = [...new Set(items.map((i) => i.appliedOffer && String(i.appliedOffer)).filter(Boolean))];
    return {
        currency,
        items: items.map(({ autoDiscount, couponDiscount: cd, ...rest }) => rest),
        invalidItems,
        subtotal,
        automaticDiscount,
        couponDiscount,
        discountTotal: automaticDiscount + couponDiscount,
        tax,
        total,
        coupon,
        offersApplied,
    };
};

/** Public price view for a single product (catalogue cards and product pages). */
export const decorateProductsWithOffers = async (products) => {
    if (!products.length) return products;
    const offers = await Offer.find({ ...activeOfferFilter(), $or: [{ couponCode: null }, { couponCode: { $exists: false } }], discountType: { $in: ['percentage', 'fixed'] } }).lean();
    const publicOffers = offers.filter((o) => !o.firstPurchaseOnly && !o.audienceEmails?.length && !o.minOrderAmount && !o.perCustomerLimit);
    return products.map((p) => {
        let best = null;
        for (const o of publicOffers) {
            if (!productMatches(o, p)) continue;
            let d = o.discountType === 'percentage' ? Math.floor((p.price * Math.min(100, o.value)) / 100) : Math.min(o.value, p.price);
            if (o.maxDiscountAmount) d = Math.min(d, o.maxDiscountAmount);
            d = Math.min(d, p.price - MIN_PAYABLE);
            if (d > 0 && (!best || d > best.discount)) best = { discount: d, offer: o };
        }
        if (!best) return { ...p, finalPrice: p.price, activeOffer: null };
        return {
            ...p,
            finalPrice: p.price - best.discount,
            activeOffer: { id: best.offer._id, name: best.offer.name, endsAt: best.offer.endsAt, discount: best.discount, bannerText: best.offer.bannerText },
        };
    });
};
