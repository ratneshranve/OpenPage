import { ApiError } from '../utils/ApiError.js';
import { randomToken, safeEqual } from '../utils/helpers.js';
import { CSRF_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE, cookieBase } from './auth.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated requests.
 * The client fetches GET /api/v1/auth/csrf, keeps the token in memory and sends it
 * back in the X-CSRF-Token header. A cross-site page can neither read the token
 * nor set the header, so forged form posts are rejected.
 */
export const issueCsrfToken = (req, res) => {
    let token = req.cookies?.[CSRF_COOKIE];
    if (!token) {
        token = randomToken(24);
        res.cookie(CSRF_COOKIE, token, { ...cookieBase(), maxAge: 24 * 3600 * 1000, path: '/' });
    }
    return token;
};

export const csrfProtection = (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const path = req.path || '';

    // Public storefront endpoints (checkout, orders, payments, forms) do not rely on 
    // authentication cookies and should never fail due to cross-site cookie restrictions 
    // or strict browser tracking protection (e.g. mobile in-app webviews, Safari, Chrome).
    if (
        path.startsWith('/checkout') ||
        path.startsWith('/payments') ||
        path.startsWith('/contact') ||
        path.startsWith('/engagement') ||
        path.startsWith('/newsletter') ||
        path.startsWith('/webhooks')
    ) {
        return next();
    }

    // CSRF protection is only necessary for authenticated cookie sessions (Admin or user dashboard)
    const hasAuthCookie = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    if (!hasAuthCookie && !req.cookies?.[CSRF_COOKIE]) {
        return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get('x-csrf-token');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
        return next(new ApiError(403, 'Your session security token has expired. Please refresh the page and try again.', null, 'CSRF'));
    }
    next();
};
