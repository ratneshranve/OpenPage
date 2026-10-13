import crypto from 'crypto';
import { config } from '../config/env.js';
import { Otp, CheckoutSession } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { hmac, normalizeEmail, safeEqual, addMinutes } from '../utils/helpers.js';
import { sendNow, isSmtpConfigured } from './email.service.js';
import { getSettings } from './settings.service.js';
import { logger } from '../utils/logger.js';

const { otp } = config;

// The code is bound to the checkout session and email: a code for one cannot verify the other.
const hashCode = (sessionId, email, code) => hmac(otp.secret, `${sessionId}:${email}:${code}`);

export const sendCheckoutOtp = async (session, rawEmail, ip) => {
    const email = normalizeEmail(rawEmail);
    const hourAgo = new Date(Date.now() - 3600 * 1000);

    const [sentToEmail, sentFromIp, latest] = await Promise.all([
        Otp.countDocuments({ email, createdAt: { $gte: hourAgo } }),
        Otp.countDocuments({ ip, createdAt: { $gte: hourAgo } }),
        Otp.findOne({ checkoutSession: session._id, email }).sort({ createdAt: -1 }).lean(),
    ]);

    if (latest) {
        const elapsed = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
        if (elapsed < otp.resendCooldownSeconds) {
            const retryAfter = Math.ceil(otp.resendCooldownSeconds - elapsed);
            throw ApiError.tooMany(`Please wait ${retryAfter} seconds before requesting a new code.`, { retryAfter });
        }
    }
    if (sentToEmail >= otp.maxSendsPerHour) throw ApiError.tooMany('Too many codes have been requested for this email. Please try again in an hour.');
    if (sentFromIp >= otp.maxSendsPerHour * 4) throw ApiError.tooMany('Too many verification requests from this network. Please try again later.');

    // Issuing a new code invalidates any earlier unused code for this checkout.
    await Otp.updateMany({ checkoutSession: session._id, status: 'pending' }, { $set: { status: 'superseded' } });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const record = await Otp.create({
        email,
        checkoutSession: session._id,
        codeHash: hashCode(session._id, email, code),
        expiresAt: new Date(Date.now() + otp.ttlSeconds * 1000),
        ip,
    });

    // Changing the checkout email clears any previous verification.
    if (session.email !== email) {
        await CheckoutSession.updateOne({ _id: session._id }, { $set: { email, lastActivityAt: new Date() }, $unset: { emailVerifiedAt: 1, verificationExpiresAt: 1, otp: 1 } });
    }

    const result = await sendNow({
        to: email,
        templateKey: 'otp_verification',
        type: 'otp_verification',
        checkoutSession: session._id,
        data: { code, expiresInMinutes: Math.round(otp.ttlSeconds / 60) },
        logData: { otpId: String(record._id) },
    });
    if (!isSmtpConfigured() && !config.isProduction) {
        // Development only, when no SMTP server is configured, so checkout can be tested locally.
        console.log(`\n[DEV ONLY] Checkout verification code for ${email}: ${code}\n`);
    }
    if (!result.ok) {
        await Otp.updateOne({ _id: record._id }, { $set: { status: 'superseded' } });
        logger.error(`OTP email could not be sent to ${email}`);
        throw ApiError.unavailable('We could not send the verification email right now. Please check the address and try again shortly.');
    }
    return { cooldownSeconds: otp.resendCooldownSeconds, expiresInSeconds: otp.ttlSeconds };
};

export const verifyCheckoutOtp = async (session, rawEmail, code) => {
    const email = normalizeEmail(rawEmail);
    const record = await Otp.findOne({ checkoutSession: session._id, email, status: 'pending' }).sort({ createdAt: -1 });
    if (!record) throw ApiError.badRequest('This verification code has expired or was replaced. Please request a new code.');
    if (record.expiresAt < new Date()) {
        record.status = 'expired';
        await record.save();
        throw new ApiError(400, 'This verification code has expired. Please request a new code.', null, 'OTP_EXPIRED');
    }

    // Count the attempt atomically before comparing, so parallel guesses cannot exceed the limit.
    const counted = await Otp.findOneAndUpdate(
        { _id: record._id, status: 'pending', attempts: { $lt: otp.maxAttempts } },
        { $inc: { attempts: 1 } },
        { new: true }
    );
    if (!counted) {
        await Otp.updateOne({ _id: record._id }, { $set: { status: 'locked' } });
        throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.', null, 'OTP_LOCKED');
    }

    if (!safeEqual(hashCode(session._id, email, String(code)), counted.codeHash)) {
        const left = otp.maxAttempts - counted.attempts;
        if (left <= 0) await Otp.updateOne({ _id: record._id }, { $set: { status: 'locked' } });
        throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Please request a new code.', { attemptsLeft: left }, 'OTP_INVALID');
    }

    const used = await Otp.findOneAndUpdate({ _id: record._id, status: 'pending' }, { $set: { status: 'used', usedAt: new Date() } });
    if (!used) throw ApiError.badRequest('This verification code has already been used. Please request a new code.');

    const { verificationValidMinutes } = await getSettings('checkout');
    const now = new Date();
    await CheckoutSession.updateOne(
        { _id: session._id },
        { $set: { email, emailVerifiedAt: now, verificationExpiresAt: addMinutes(now, verificationValidMinutes), otp: record._id, lastActivityAt: now } }
    );
    return { email, verifiedUntil: addMinutes(now, verificationValidMinutes) };
};
