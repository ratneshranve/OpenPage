import { ApiError } from '../utils/ApiError.js';
import { randomToken, safeEqual } from '../utils/helpers.js';
import { CSRF_COOKIE, cookieBase } from './auth.js';

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
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get('x-csrf-token');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
        return next(new ApiError(403, 'Your session security token has expired. Please refresh the page and try again.', null, 'CSRF'));
    }
    next();
};
