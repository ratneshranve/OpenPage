import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User, RefreshSession, ActionToken, Order, Entitlement } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { addMinutes, clientIp, normalizeEmail, randomToken, sha256 } from '../utils/helpers.js';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieBase } from '../middleware/auth.js';
import { queueEmail } from './email.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Pre-computed hash so unknown-email logins take the same time as wrong-password logins.
const DUMMY_HASH = bcrypt.hashSync('openpage-timing-equaliser', 10);

export const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

const signAccessToken = (user) =>
    jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion }, config.jwtSecret, {
        expiresIn: `${config.accessTokenTtlMinutes}m`,
        audience: 'openpage',
        issuer: 'openpage-api',
    });

const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), path: '/', maxAge: config.accessTokenTtlMinutes * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), path: '/api/v1/auth', maxAge: config.refreshTokenTtlDays * 24 * 3600 * 1000 });
};

export const clearAuthCookies = (res) => {
    res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/v1/auth' });
};

export const issueSession = async (user, req, res) => {
    const refreshToken = randomToken(48);
    await RefreshSession.create({
        user: user._id,
        tokenHash: sha256(refreshToken),
        expiresAt: addMinutes(new Date(), config.refreshTokenTtlDays * 24 * 60),
        userAgent: req.get('user-agent')?.slice(0, 300),
        ip: clientIp(req),
        lastUsedAt: new Date(),
    });
    setAuthCookies(res, signAccessToken(user), refreshToken);
};

export const register = async ({ name, email, password, marketingEmails }, req, res) => {
    email = normalizeEmail(email);
    const existing = await User.findOne({ email }).select('+passwordHash');
    if (existing?.passwordHash) {
        // Generic response; do not reveal whether the email is registered.
        throw ApiError.conflict('We could not create an account with these details. If you already have an account, sign in or reset your password.');
    }
    const now = new Date();
    const consents = [{ type: 'terms', granted: true, source: 'registration' }];
    if (marketingEmails) consents.push({ type: 'marketing_email', granted: true, source: 'registration', at: now });
    const user = existing || new User({ email });
    user.name = name;
    user.passwordHash = await hashPassword(password);
    user.marketingEmails = Boolean(marketingEmails);
    user.consents.push(...consents);
    await user.save();
    await queueEmail({ to: email, templateKey: 'account_verification', type: 'account_verification', user: user._id, data: { userId: String(user._id) }, dedupeKey: `verify:${user._id}:${Date.now()}` });
    await issueSession(user, req, res);
    return user;
};

export const login = async ({ email, password }, req, res, { adminOnly = false } = {}) => {
    email = normalizeEmail(email);
    const user = await User.findOne({ email }).select('+passwordHash');
    const generic = ApiError.unauthorized('Incorrect email or password.');
    if (!user || !user.passwordHash) {
        await bcrypt.compare(password, DUMMY_HASH);
        throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw ApiError.tooMany(`Too many failed attempts. Try again after ${user.lockedUntil.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} or reset your password.`);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        user.failedLoginCount += 1;
        if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
            user.lockedUntil = addMinutes(new Date(), LOCK_MINUTES);
            user.failedLoginCount = 0;
        }
        await user.save();
        throw generic;
    }
    if (user.status !== 'active') throw ApiError.forbidden('This account has been suspended. Please contact support.');
    if (adminOnly && user.role !== 'admin') throw generic;
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();
    await issueSession(user, req, res);
    return user;
};

/** Rotates the refresh token. Re-use of an already-rotated token revokes every session for the user. */
export const refresh = async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized('Session expired. Please sign in again.');
    const session = await RefreshSession.findOne({ tokenHash: sha256(token) });
    if (!session || session.expiresAt < new Date()) {
        clearAuthCookies(res);
        throw ApiError.unauthorized('Session expired. Please sign in again.');
    }
    if (session.revokedAt) {
        if (session.replacedBy) {
            // Possible token theft: revoke the whole family.
            await RefreshSession.updateMany({ user: session.user, revokedAt: null }, { $set: { revokedAt: new Date() } });
            await User.updateOne({ _id: session.user }, { $inc: { tokenVersion: 1 } });
        }
        clearAuthCookies(res);
        throw ApiError.unauthorized('Session expired. Please sign in again.');
    }
    const user = await User.findById(session.user);
    if (!user || user.status !== 'active') {
        clearAuthCookies(res);
        throw ApiError.unauthorized('Session expired. Please sign in again.');
    }
    const next = randomToken(48);
    session.revokedAt = new Date();
    session.replacedBy = sha256(next);
    await session.save();
    await RefreshSession.create({
        user: user._id,
        tokenHash: sha256(next),
        expiresAt: session.expiresAt,
        userAgent: req.get('user-agent')?.slice(0, 300),
        ip: clientIp(req),
        lastUsedAt: new Date(),
    });
    setAuthCookies(res, signAccessToken(user), next);
    return user;
};

export const logout = async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await RefreshSession.updateOne({ tokenHash: sha256(token) }, { $set: { revokedAt: new Date() } });
    clearAuthCookies(res);
};

/** Revokes all sessions and invalidates every outstanding access token immediately. */
export const revokeAllSessions = async (userId) => {
    await RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
};

export const forgotPassword = async (email) => {
    email = normalizeEmail(email);
    const user = await User.findOne({ email, status: 'active' }).lean();
    // Always the same response to the caller.
    if (!user) return;
    const recent = await ActionToken.countDocuments({ user: user._id, purpose: 'reset_password', createdAt: { $gte: new Date(Date.now() - 3600 * 1000) } });
    if (recent >= 3) return;
    await queueEmail({ to: email, templateKey: 'password_reset', type: 'password_reset', user: user._id, data: { userId: String(user._id) } });
};

const consumeActionToken = async (token, purpose) => {
    const doc = await ActionToken.findOneAndUpdate(
        { tokenHash: sha256(String(token || '')), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
        { new: true }
    );
    if (!doc) throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.');
    return doc;
};

export const resetPassword = async ({ token, password }) => {
    const doc = await consumeActionToken(token, 'reset_password');
    const user = await User.findById(doc.user).select('+passwordHash');
    if (!user || user.status !== 'active') throw ApiError.badRequest('This link is invalid or has expired.');
    user.passwordHash = await hashPassword(password);
    user.passwordChangedAt = new Date();
    // Completing a reset from the inbox also proves control of the email address.
    if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
    }
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    await user.save();
    await revokeAllSessions(user._id);
};

export const verifyEmail = async (token) => {
    const doc = await consumeActionToken(token, 'verify_email');
    const user = await User.findById(doc.user);
    if (!user) throw ApiError.badRequest('This link is invalid or has expired.');
    if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();
        await linkGuestPurchases(user);
        await queueEmail({ to: user.email, templateKey: 'welcome', type: 'welcome', user: user._id, data: { customerName: user.name, libraryUrl: `${config.frontendUrl}/account/library` }, dedupeKey: `welcome:${user._id}` });
    }
    return user;
};

/** Attaches guest purchases made with this (now verified) email to the account. */
export const linkGuestPurchases = async (user) => {
    if (!user.emailVerified) return 0;
    const res = await Order.updateMany({ email: user.email, user: null }, { $set: { user: user._id } });
    await Entitlement.updateMany({ email: user.email, user: null }, { $set: { user: user._id } });
    return res.modifiedCount;
};

export const resendVerification = async (user) => {
    if (user.emailVerified) return;
    const recent = await ActionToken.countDocuments({ user: user._id, purpose: 'verify_email', createdAt: { $gte: new Date(Date.now() - 3600 * 1000) } });
    if (recent >= 3) throw ApiError.tooMany('Verification email already sent several times. Please check your inbox and spam folder.');
    await queueEmail({ to: user.email, templateKey: 'account_verification', type: 'account_verification', user: user._id, data: { userId: String(user._id) } });
};

export const changePassword = async (user, { currentPassword, newPassword }, req, res) => {
    const full = await User.findById(user._id).select('+passwordHash');
    if (!full.passwordHash || !(await bcrypt.compare(currentPassword, full.passwordHash))) throw ApiError.badRequest('Your current password is incorrect.');
    full.passwordHash = await hashPassword(newPassword);
    full.passwordChangedAt = new Date();
    await full.save();
    await revokeAllSessions(full._id);
    const fresh = await User.findById(full._id);
    await issueSession(fresh, req, res);
};
