import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as auth from '../services/auth.service.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { REFRESH_COOKIE } from '../middleware/auth.js';
import { audit } from '../services/audit.service.js';

export const csrf = (req, res) => ok(res, { csrfToken: issueCsrfToken(req, res) });

export const register = asyncHandler(async (req, res) => {
    const user = await auth.register(req.body, req, res);
    created(res, { user: user.toSafeJSON() }, 'Account created. Please check your inbox to confirm your email.');
});

export const login = asyncHandler(async (req, res) => {
    const user = await auth.login(req.body, req, res);
    ok(res, { user: user.toSafeJSON() }, 'Signed in');
});

export const adminLogin = asyncHandler(async (req, res) => {
    try {
        const user = await auth.login(req.body, req, res, { adminOnly: true });
        req.user = user;
        await audit(req, 'admin.login', { targetType: 'User', targetId: user._id });
        ok(res, { user: user.toSafeJSON() }, 'Signed in');
    } catch (err) {
        await audit(req, 'admin.login', { outcome: 'failure', details: { email: req.body.email } });
        throw err;
    }
});

export const refresh = asyncHandler(async (req, res) => {
    // No refresh cookie simply means "not signed in", which is not an error.
    if (!req.cookies?.[REFRESH_COOKIE]) return ok(res, { user: null });
    const user = await auth.refresh(req, res);
    ok(res, { user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
    await auth.logout(req, res);
    ok(res, null, 'Signed out');
});

export const me = (req, res) => ok(res, { user: req.user ? req.user.toSafeJSON() : null });

export const forgotPassword = asyncHandler(async (req, res) => {
    await auth.forgotPassword(req.body.email);
    ok(res, null, 'If an account exists for this email, a reset link is on its way.');
});

export const resetPassword = asyncHandler(async (req, res) => {
    await auth.resetPassword(req.body);
    auth.clearAuthCookies(res);
    ok(res, null, 'Your password has been reset. Please sign in.');
});

export const verifyEmail = asyncHandler(async (req, res) => {
    const user = await auth.verifyEmail(req.body.token);
    ok(res, { email: user.email }, 'Your email has been verified.');
});

export const resendVerification = asyncHandler(async (req, res) => {
    await auth.resendVerification(req.user);
    ok(res, null, 'Verification email sent.');
});

export const changePassword = asyncHandler(async (req, res) => {
    await auth.changePassword(req.user, req.body, req, res);
    if (req.user.role === 'admin') await audit(req, 'admin.password_change', { targetType: 'User', targetId: req.user._id });
    ok(res, null, 'Password updated. Other devices have been signed out.');
});

export const logoutAll = asyncHandler(async (req, res) => {
    await auth.revokeAllSessions(req.user._id);
    auth.clearAuthCookies(res);
    ok(res, null, 'Signed out of all devices.');
});
