export class ApiError extends Error {
    constructor(statusCode, message, details = null, code = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
    }

    static badRequest(message, details) {
        return new ApiError(400, message, details, 'BAD_REQUEST');
    }
    static unauthorized(message = 'Please sign in to continue.') {
        return new ApiError(401, message, null, 'UNAUTHORIZED');
    }
    static forbidden(message = 'You do not have permission to perform this action.') {
        return new ApiError(403, message, null, 'FORBIDDEN');
    }
    static notFound(message = 'Not found.') {
        return new ApiError(404, message, null, 'NOT_FOUND');
    }
    static conflict(message, details) {
        return new ApiError(409, message, details, 'CONFLICT');
    }
    static tooMany(message = 'Too many requests. Please wait and try again.', details) {
        return new ApiError(429, message, details, 'RATE_LIMITED');
    }
    static unavailable(message = 'This service is temporarily unavailable.') {
        return new ApiError(503, message, null, 'UNAVAILABLE');
    }
}
