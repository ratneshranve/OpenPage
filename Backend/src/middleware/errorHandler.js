import multer from 'multer';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFound = (req, res) =>
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Server error';
    let code = err.code && typeof err.code === 'string' ? err.code : undefined;
    let details = err.details || undefined;

    if (err instanceof multer.MulterError) {
        statusCode = 400;
        message = err.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is larger than the allowed size.' : `Upload error: ${err.message}`;
        code = 'UPLOAD_ERROR';
    } else if (err.name === 'ValidationError' && err.errors) {
        statusCode = 400;
        details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
        message = details[0]?.message || 'Validation failed';
        code = 'VALIDATION_ERROR';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}`;
        code = 'BAD_REQUEST';
    } else if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern || {})[0] || 'value';
        message = `A record with this ${field} already exists.`;
        code = 'DUPLICATE';
    } else if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Malformed JSON body';
        code = 'BAD_REQUEST';
    }

    if (statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl} ${statusCode} - ${err.stack || err.message}`);
        if (config.isProduction) message = 'Something went wrong on our side. Please try again.';
    } else {
        logger.debug(`${req.method} ${req.originalUrl} ${statusCode} - ${message}`);
    }

    res.status(statusCode).json({ success: false, code: code || (statusCode >= 500 ? 'SERVER_ERROR' : 'ERROR'), message, details });
};
