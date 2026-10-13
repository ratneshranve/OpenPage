import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and replaces req[source] with the parsed zod output, so controllers only
 * ever see whitelisted, typed fields.
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
        const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
        const first = details[0];
        return next(ApiError.badRequest(first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'Invalid request', details));
    }
    if (source === 'query') {
        // req.query is a getter in Express 5-compatible setups; assign a parsed copy instead.
        req.validatedQuery = result.data;
    } else {
        req[source] = result.data;
    }
    next();
};
