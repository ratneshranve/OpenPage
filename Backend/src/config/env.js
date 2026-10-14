import dotenv from 'dotenv';

dotenv.config();

const str = (key, fallback = '') => {
    const value = process.env[key];
    return value === undefined || value === null ? fallback : String(value).trim();
};
const num = (key, fallback) => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
};
const bool = (key, fallback = false) => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase());
};
const list = (key) => str(key).split(',').map((v) => v.trim()).filter(Boolean);
const trimSlash = (value) => value.replace(/\/+$/, '');

const nodeEnv = str('NODE_ENV', 'development');
const port = num('PORT', 5000);
const frontendUrl = trimSlash(str('FRONTEND_URL', 'http://localhost:5173'));

export const config = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    appName: str('APP_NAME', 'OpenPage'),
    frontendUrl,
    apiBaseUrl: trimSlash(str('API_BASE_URL', `http://localhost:${port}`)),
    appBaseUrl: trimSlash(str('APP_BASE_URL', frontendUrl)),
    serveFrontend: bool('SERVE_FRONTEND', false),
    trustProxy: num('TRUST_PROXY', 1),
    cookieSameSite: str('COOKIE_SAME_SITE', nodeEnv === 'production' ? 'none' : 'lax').toLowerCase(),

    mongodbUri: str('MONGODB_URI'),

    jwtSecret: str('JWT_SECRET'),
    sessionSecret: str('SESSION_SECRET'),
    accessTokenTtlMinutes: num('ACCESS_TOKEN_TTL_MINUTES', 15),
    refreshTokenTtlDays: num('REFRESH_TOKEN_TTL_DAYS', 30),
    bcryptRounds: num('BCRYPT_ROUNDS', 12),

    otp: {
        secret: str('OTP_SECRET'),
        ttlSeconds: num('OTP_TTL_SECONDS', 300),
        resendCooldownSeconds: num('OTP_RESEND_COOLDOWN_SECONDS', 60),
        maxAttempts: num('OTP_MAX_ATTEMPTS', 5),
        maxSendsPerHour: num('OTP_MAX_SENDS_PER_HOUR', 5),
    },

    razorpay: {
        keyId: str('RAZORPAY_KEY_ID'),
        keySecret: str('RAZORPAY_KEY_SECRET'),
        webhookSecret: str('RAZORPAY_WEBHOOK_SECRET'),
    },

    smtp: {
        host: str('SMTP_HOST'),
        port: num('SMTP_PORT', 587),
        secure: process.env.SMTP_SECURE !== undefined ? bool('SMTP_SECURE') : num('SMTP_PORT', 587) === 465,
        user: str('SMTP_USER'),
        pass: str('SMTP_PASS'),
        fromName: str('SMTP_FROM_NAME', 'OpenPage'),
        fromEmail: str('SMTP_FROM_EMAIL'),
        replyTo: str('SMTP_REPLY_TO'),
    },
    brevoApiKey: str('BREVO_API_KEY'),

    storage: {
        provider: str('STORAGE_PROVIDER', 'local').toLowerCase(),
        endpoint: str('STORAGE_ENDPOINT'),
        region: str('STORAGE_REGION', 'auto'),
        bucket: str('STORAGE_BUCKET'),
        accessKeyId: str('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: str('STORAGE_SECRET_ACCESS_KEY'),
        publicAssetsBaseUrl: trimSlash(str('STORAGE_PUBLIC_ASSETS_BASE_URL')),
        localRoot: str('STORAGE_LOCAL_ROOT', 'storage'),
        cloudinary: {
            cloudName: str('CLOUDINARY_CLOUD_NAME'),
            apiKey: str('CLOUDINARY_API_KEY'),
            apiSecret: str('CLOUDINARY_API_SECRET'),
            folder: str('CLOUDINARY_FOLDER', 'openpage'),
        },
        maxEbookUploadMb: num('MAX_EBOOK_UPLOAD_MB', 100),
        maxImageUploadMb: num('MAX_IMAGE_UPLOAD_MB', 5),
    },
    downloadTokenSecret: str('DOWNLOAD_TOKEN_SECRET'),
    downloadLinkTtlMinutes: num('DOWNLOAD_LINK_TTL_MINUTES', 60),

    firebase: {
        projectId: str('FIREBASE_PROJECT_ID'),
        clientEmail: str('FIREBASE_CLIENT_EMAIL'),
        privateKey: str('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        webApiKey: str('FIREBASE_WEB_API_KEY'),
        authDomain: str('FIREBASE_AUTH_DOMAIN'),
        messagingSenderId: str('FIREBASE_MESSAGING_SENDER_ID'),
        appId: str('FIREBASE_APP_ID'),
        vapidKey: str('FIREBASE_VAPID_KEY'),
    },

    metaPixel: {
        pixelId: str('META_PIXEL_ID'),
        enabled: bool('META_PIXEL_ENABLED', false),
    },
    googleAds: {
        tagId: str('GOOGLE_ADS_TAG_ID'),
        conversionId: str('GOOGLE_ADS_CONVERSION_ID'),
        conversionLabel: str('GOOGLE_ADS_CONVERSION_LABEL'),
        enabled: bool('GOOGLE_ADS_TRACKING_ENABLED', false),
    },
    adsense: {
        clientId: str('GOOGLE_ADSENSE_CLIENT_ID'),
        enabled: bool('GOOGLE_ADSENSE_ENABLED', false),
    },

    jobs: {
        redisUrl: str('REDIS_URL'),
        queueEnabled: bool('JOB_QUEUE_ENABLED', false),
        emailRetryLimit: num('EMAIL_RETRY_LIMIT', 5),
        emailRetryDelaySeconds: num('EMAIL_RETRY_DELAY_SECONDS', 60),
        automationEnabled: bool('AUTOMATION_ENABLED', true),
        workersEnabled: bool('JOB_WORKERS_ENABLED', true),
    },

    corsAllowedOrigins: list('CORS_ALLOWED_ORIGINS'),
    rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    rateLimitMaxRequests: num('RATE_LIMIT_MAX_REQUESTS', 600),
    logLevel: str('LOG_LEVEL', 'info'),
};

export const integrationStatus = () => ({
    razorpay: Boolean(config.razorpay.keyId && config.razorpay.keySecret),
    razorpayWebhook: Boolean(config.razorpay.webhookSecret),
    smtp: Boolean(config.brevoApiKey || (config.smtp.host && config.smtp.fromEmail)),
    firebaseAdmin: Boolean(config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey),
    firebaseWeb: Boolean(config.firebase.webApiKey && config.firebase.appId && config.firebase.vapidKey),
    s3Storage: config.storage.provider === 's3' && Boolean(config.storage.bucket && config.storage.accessKeyId),
    cloudinaryStorage: config.storage.provider === 'cloudinary' && Boolean(config.storage.cloudinary.cloudName && config.storage.cloudinary.apiKey && config.storage.cloudinary.apiSecret),
});
