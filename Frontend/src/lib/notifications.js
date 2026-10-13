import { post } from './api';

/**
 * Firebase Cloud Messaging web push. The SDK is loaded lazily, and permission is requested
 * only from an explicit click (never on page load).
 */
const INSTALLATION_KEY = 'op_installation_id';
const TOKEN_KEY = 'op_push_token';

export const installationId = () => {
    try {
        let id = localStorage.getItem(INSTALLATION_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(INSTALLATION_KEY, id);
        }
        return id;
    } catch {
        return undefined;
    }
};

export const pushSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export const pushState = () => {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
        return Notification.permission === 'granted' && localStorage.getItem(TOKEN_KEY) ? 'subscribed' : 'not_subscribed';
    } catch {
        return 'not_subscribed';
    }
};

const swUrl = (fb) => `/firebase-messaging-sw.js?${new URLSearchParams({ apiKey: fb.apiKey, authDomain: fb.authDomain || '', projectId: fb.projectId, messagingSenderId: fb.messagingSenderId, appId: fb.appId })}`;

export const enablePush = async (fb) => {
    if (!pushSupported()) throw new Error('This browser does not support notifications.');
    if (!fb) throw new Error('Notifications are not configured.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Notification permission was not granted.');
    const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
    const app = getApps()[0] || initializeApp({ apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, messagingSenderId: fb.messagingSenderId, appId: fb.appId });
    const registration = await navigator.serviceWorker.register(swUrl(fb));
    const token = await getToken(getMessaging(app), { vapidKey: fb.vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('Could not register this browser for notifications.');
    await post('/notifications/register', { token, installationId: installationId(), permission: 'granted' });
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        /* ignore */
    }
    return token;
};

export const disablePush = async () => {
    let token;
    try {
        token = localStorage.getItem(TOKEN_KEY) || undefined;
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* ignore */
    }
    await post('/notifications/unregister', { token, installationId: installationId() });
};

export const currentPushToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};
