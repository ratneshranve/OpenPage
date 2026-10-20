import axios from 'axios';

/**
 * Central API client.
 *  - Cookies carry the session (HTTP-only); the browser never sees access tokens.
 *  - A CSRF token is fetched once and sent with every state-changing request.
 *  - A 401 triggers one silent refresh, then the original request is retried.
 */
const baseURL = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/v1`;

export const api = axios.create({ baseURL, withCredentials: true, timeout: 30000 });

let csrfToken = null;
let csrfPromise = null;
const fetchCsrf = async () => {
    if (!csrfPromise) {
        csrfPromise = axios
            .get(`${baseURL}/auth/csrf`, { withCredentials: true })
            .then((r) => {
                csrfToken = r.data?.data?.csrfToken || null;
                return csrfToken;
            })
            .catch(() => null)
            .finally(() => {
                csrfPromise = null;
            });
    }
    return csrfPromise;
};

api.interceptors.request.use(async (config) => {
    const method = (config.method || 'get').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        if (!csrfToken) {
            try {
                await fetchCsrf();
            } catch {
                // Ignore CSRF fetch failures; public endpoints operate without cookies
            }
        }
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }
    const session = localStorage.getItem('op_checkout_session');
    if (session && config.url?.startsWith('/checkout')) config.headers['X-Checkout-Session'] = session;
    return config;
});

let refreshing = null;
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/admin/login', '/auth/logout', '/auth/csrf'];

api.interceptors.response.use(
    (r) => r,
    async (error) => {
        const { config, response } = error;
        if (!config || !response) return Promise.reject(error);
        if (response.status === 403 && response.data?.code === 'CSRF' && !config._csrfRetry) {
            config._csrfRetry = true;
            csrfToken = null;
            const freshToken = await fetchCsrf();
            if (freshToken) {
                config.headers['X-CSRF-Token'] = freshToken;
            }
            return api(config);
        }
        if (response.status === 401 && !config._retried && !NO_REFRESH.some((p) => config.url?.startsWith(p))) {
            config._retried = true;
            try {
                refreshing = refreshing || api.post('/auth/refresh').finally(() => (refreshing = null));
                const r = await refreshing;
                if (!r.data?.data?.user) throw new Error('signed out');
                return api(config);
            } catch {
                window.dispatchEvent(new Event('op:session-expired'));
            }
        }
        return Promise.reject(error);
    }
);

/** Human-readable message from an API error. */
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
    if (!err?.response) return err?.code === 'ECONNABORTED' ? 'The request timed out. Please check your connection and try again.' : 'Unable to reach the server. Please check your connection.';
    return err.response.data?.message || fallback;
};
export const errorCode = (err) => err?.response?.data?.code;
export const errorDetails = (err) => err?.response?.data?.details;

/** Unwraps { success, data } responses. */
export const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);

export const apiOrigin = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
