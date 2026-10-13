import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Validates configuration at startup. Missing core settings stop the server with a
 * clear message. Integration credentials are required in production and only
 * produce warnings in development so the store can be explored locally.
 */
export const validateConfig = () => {
    const errors = [];
    const warnings = [];

    const requireValue = (value, name) => {
        if (!value) errors.push(`${name} is required`);
    };
    const requireSecret = (value, name) => {
        if (!value) errors.push(`${name} is required`);
        else if (value.length < 32) errors.push(`${name} must be at least 32 characters`);
    };

    requireValue(config.mongodbUri, 'MONGODB_URI');
    requireSecret(config.jwtSecret, 'JWT_SECRET');
    requireSecret(config.sessionSecret, 'SESSION_SECRET');
    requireSecret(config.otp.secret, 'OTP_SECRET');
    requireSecret(config.downloadTokenSecret, 'DOWNLOAD_TOKEN_SECRET');

    for (const [name, value] of Object.entries({ FRONTEND_URL: config.frontendUrl, API_BASE_URL: config.apiBaseUrl })) {
        try {
            new URL(value);
        } catch {
            errors.push(`${name} must be a valid URL`);
        }
    }

    if (config.otp.ttlSeconds < 60 || config.otp.ttlSeconds > 3600) errors.push('OTP_TTL_SECONDS must be between 60 and 3600');
    if (config.otp.resendCooldownSeconds < 10) errors.push('OTP_RESEND_COOLDOWN_SECONDS must be at least 10');
    if (config.otp.maxAttempts < 1 || config.otp.maxAttempts > 10) errors.push('OTP_MAX_ATTEMPTS must be between 1 and 10');
    if (config.otp.maxSendsPerHour < 1 || config.otp.maxSendsPerHour > 20) errors.push('OTP_MAX_SENDS_PER_HOUR must be between 1 and 20');
    if (config.downloadLinkTtlMinutes < 5) errors.push('DOWNLOAD_LINK_TTL_MINUTES must be at least 5');

    if (!['local', 's3', 'cloudinary'].includes(config.storage.provider)) {
        errors.push('STORAGE_PROVIDER must be "local", "s3" or "cloudinary"');
    }
    if (config.storage.provider === 'cloudinary') {
        requireValue(config.storage.cloudinary.cloudName, 'CLOUDINARY_CLOUD_NAME');
        requireValue(config.storage.cloudinary.apiKey, 'CLOUDINARY_API_KEY');
        requireValue(config.storage.cloudinary.apiSecret, 'CLOUDINARY_API_SECRET');
    }
    if (config.storage.provider === 's3') {
        requireValue(config.storage.bucket, 'STORAGE_BUCKET');
        requireValue(config.storage.accessKeyId, 'STORAGE_ACCESS_KEY_ID');
        requireValue(config.storage.secretAccessKey, 'STORAGE_SECRET_ACCESS_KEY');
    }

    const integration = (ok, message) => {
        if (ok) return;
        if (config.isProduction) errors.push(message);
        else warnings.push(message);
    };
    integration(config.razorpay.keyId && config.razorpay.keySecret, 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for checkout');
    integration(config.razorpay.webhookSecret, 'RAZORPAY_WEBHOOK_SECRET is required for webhook verification');
    integration(config.smtp.host && config.smtp.fromEmail, 'SMTP_HOST and SMTP_FROM_EMAIL are required to send OTP and delivery emails');
    if (config.isProduction && config.storage.provider === 'local') {
        warnings.push('STORAGE_PROVIDER=local stores eBooks on this server disk. Use private object storage (s3) in production.');
    }
    if (config.metaPixel.enabled && !config.metaPixel.pixelId) warnings.push('META_PIXEL_ENABLED is true but META_PIXEL_ID is empty');
    if (config.googleAds.enabled && !config.googleAds.tagId) warnings.push('GOOGLE_ADS_TRACKING_ENABLED is true but GOOGLE_ADS_TAG_ID is empty');
    if (config.adsense.enabled && !config.adsense.clientId) warnings.push('GOOGLE_ADSENSE_ENABLED is true but GOOGLE_ADSENSE_CLIENT_ID is empty');
    if (config.jobs.queueEnabled) {
        warnings.push('JOB_QUEUE_ENABLED is set; OpenPage uses its built-in MongoDB-backed durable queue, so REDIS_URL is not required.');
    }

    warnings.forEach((w) => logger.warn(`[config] ${w}`));
    if (errors.length) {
        const message = `Configuration error:\n  - ${errors.join('\n  - ')}\nUpdate Backend/.env (see .env.example) and restart.`;
        const error = new Error(message);
        error.isConfigError = true;
        throw error;
    }
};
