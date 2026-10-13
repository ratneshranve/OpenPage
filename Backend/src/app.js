import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { razorpayWebhook } from './controllers/checkout.controller.js';
import { csrfProtection } from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { serveMedia } from './services/storage.service.js';
import { buildRobots, buildSitemap, renderSpa, distDir } from './services/seo.service.js';

const app = express();

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(
    helmet({
        // The API serves JSON and files; the SPA sets its own CSP when served from here.
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
);

const allowedOrigins = new Set([config.frontendUrl, config.appBaseUrl, ...config.corsAllowedOrigins].filter(Boolean));
app.use(
    cors({
        origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
        credentials: true,
        allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Checkout-Session'],
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    })
);

if (!config.isProduction) app.use(morgan('dev'));

app.get('/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ status: db ? 'UP' : 'DEGRADED', db, time: new Date().toISOString() });
});

// Razorpay webhooks need the exact raw bytes for signature verification, so this route is
// registered before the JSON parser and outside CSRF (it is authenticated by its signature).
app.post('/api/v1/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// Strip Mongo operators from user input (defence in depth on top of zod validation).
const scrub = (value) => {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            if (key.startsWith('$') || key.includes('.')) delete value[key];
            else value[key] = scrub(value[key]);
        }
    }
    return value;
};
app.use((req, _res, next) => {
    if (req.body) scrub(req.body);
    if (req.query) scrub(req.query);
    next();
});

app.get('/robots.txt', async (_req, res, next) => {
    try {
        res.type('text/plain').send(await buildRobots());
    } catch (err) {
        next(err);
    }
});
app.get('/sitemap.xml', async (_req, res, next) => {
    try {
        res.type('application/xml').send(await buildSitemap());
    } catch (err) {
        next(err);
    }
});
app.get('/media/*', serveMedia);

app.use('/api', (_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
});
app.use('/api/v1', globalLimiter, csrfProtection);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', publicRoutes);
app.use('/api', notFound);

// Optional: serve the built storefront with server-rendered meta tags for SEO.
if (config.serveFrontend && fs.existsSync(path.join(distDir(), 'index.html'))) {
    app.use(express.static(distDir(), { index: false, maxAge: '7d', setHeaders: (res, file) => file.endsWith('.html') && res.set('Cache-Control', 'no-cache') }));
    app.get('*', renderSpa);
}

app.use(notFound);
app.use(errorHandler);

export default app;
