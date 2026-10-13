export const sendResponse = (res, statusCode, message, data = null) =>
    res.status(statusCode).json({ success: true, message, data });

export const ok = (res, data = null, message = 'OK') => sendResponse(res, 200, message, data);
export const created = (res, data = null, message = 'Created') => sendResponse(res, 201, message, data);
