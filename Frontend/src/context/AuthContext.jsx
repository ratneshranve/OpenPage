import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { get, post } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await get('/auth/me');
            if (data.user) return setUser(data.user);
            // Access cookie may have expired; try the refresh cookie once.
            const r = await post('/auth/refresh').catch(() => null);
            setUser(r?.data?.user || null);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onExpired = () => {
            setUser((prev) => {
                if (prev) toast.error('Your session has expired. Please sign in again.');
                return null;
            });
        };
        window.addEventListener('op:session-expired', onExpired);
        return () => window.removeEventListener('op:session-expired', onExpired);
    }, [refresh]);

    const login = async (email, password, { admin = false } = {}) => {
        const r = await post(admin ? '/auth/admin/login' : '/auth/login', { email, password });
        setUser(r.data.user);
        return r.data.user;
    };

    const register = async (payload) => {
        const r = await post('/auth/register', payload);
        setUser(r.data.user);
        return r;
    };

    const logout = async () => {
        await post('/auth/logout').catch(() => {});
        setUser(null);
    };

    return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
