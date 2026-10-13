import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export const ACCESS_COOKIE = 'op_at';
export const REFRESH_COOKIE = 'op_rt';
export const CSRF_COOKIE = 'op_csrf';

export const cookieBase = () => ({
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
});

const readAccessToken = (req) => req.cookies?.[ACCESS_COOKIE] || null;

const loadUser = async (req) => {
    const token = readAccessToken(req);
    if (!token) return null;
    let payload;
    try {
        payload = jwt.verify(token, config.jwtSecret, { audience: 'openpage', issuer: 'openpage-api' });
    } catch {
        return null;
    }
    const user = await User.findById(payload.sub);
    // tokenVersion check gives immediate revocation (logout-all, suspension, password change).
    if (!user || user.tokenVersion !== payload.tv || user.status !== 'active') return null;
    return user;
};

export const optionalAuth = async (req, _res, next) => {
    try {
        req.user = await loadUser(req);
        next();
    } catch (err) {
        next(err);
    }
};

export const requireAuth = async (req, _res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) throw ApiError.unauthorized();
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

/** Server-side role check. Always used for /admin routes regardless of what the UI shows. */
export const requireAdmin = async (req, res, next) => {
    await requireAuth(req, res, (err) => {
        if (err) return next(err);
        if (req.user.role !== 'admin') return next(ApiError.forbidden());
        next();
    });
};
