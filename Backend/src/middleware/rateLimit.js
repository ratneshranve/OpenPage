import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const handler = (_req, res, _next, options) =>
    res.status(options.statusCode).json({
        success: false,
        code: 'RATE_LIMITED',
        message: options.message,
    });

const make = (windowMs, limit, message) =>
    rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message, handler });

export const globalLimiter = make(config.rateLimitWindowMs, config.rateLimitMaxRequests, 'Too many requests. Please slow down and try again shortly.');
export const authLimiter = make(15 * 60 * 1000, 20, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
export const otpLimiter = make(60 * 60 * 1000, 20, 'Too many verification requests from this network. Please try again later.');
export const formLimiter = make(60 * 60 * 1000, 15, 'Too many submissions. Please try again later.');
export const downloadLimiter = make(60 * 60 * 1000, 60, 'Too many download requests. Please try again later.');
export const checkoutLimiter = make(15 * 60 * 1000, 60, 'Too many checkout requests. Please wait a moment and try again.');
