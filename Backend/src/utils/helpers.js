import crypto from 'crypto';

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const slugify = (value) =>
    String(value || '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
};

export const paginated = (items, total, { page, limit }) => ({
    items,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
});

/** Random URL-safe token. */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(String(value)).digest('hex');

export const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/** Short human-friendly reference, e.g. OP-7K3M9Q2A. Unambiguous alphabet. */
export const humanRef = (prefix, length = 8) => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
    return `${prefix}-${out}`;
};

export const formatMoney = (amountMinor, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((amountMinor || 0) / 100);

export const pick = (obj, keys) =>
    keys.reduce((acc, key) => {
        if (obj[key] !== undefined) acc[key] = obj[key];
        return acc;
    }, {});

export const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

export const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + minutes * 60000);
