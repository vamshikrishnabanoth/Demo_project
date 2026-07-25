import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    // Dynamic theme setup with localStorage persistence
    const [theme, setThemeState] = useState(() => {
        return localStorage.getItem('app-theme') || 'india';
    });

    const setTheme = (newTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // ── Restore session on mount ─────────────────────────────────────────────
    const checkUser = useCallback(async () => {
        console.log('[DIAGNOSTIC-AUTH] Hydration phase initiated.');
        const token = localStorage.getItem('token');
        console.log('[DIAGNOSTIC-AUTH] Retrieved token from localStorage:', token ? `${token.slice(0, 15)}...` : 'NONE');
        if (!token) {
            console.log('[DIAGNOSTIC-AUTH] No token found. Skipping session hydration.');
            setLoading(false);
            return;
        }
        try {
            console.log('[DIAGNOSTIC-AUTH] Dispatching GET /auth/me request to backend...');
            const startTime = Date.now();
            const res = await api.get('/auth/me');
            console.log(`[DIAGNOSTIC-AUTH] GET /auth/me succeeded in ${Date.now() - startTime}ms. Payload:`, res.data);
            setUser(res.data);
            setAuthError(null);
        } catch (err) {
            console.error('[DIAGNOSTIC-AUTH] Hydration failed! Catching error details:', {
                message: err.message,
                code: err.code,
                status: err.response?.status,
                statusText: err.response?.statusText,
                responseBody: err.response?.data
            });
            
            // Only clear token if the server explicitly tells us the token is invalid/expired (401 or 403)
            // If it's a temporary network error or 5xx server error, keep the token so we don't force log out!
            if (err.response?.status === 401 || err.response?.status === 403) {
                console.warn('[AuthContext] Session expired/invalid. Clearing token.', err);
                localStorage.removeItem('token');
            } else {
                console.error('[AuthContext] Network or server error during auth hydration:', err);
                setAuthError(err);
            }
        } finally {
            console.log('[DIAGNOSTIC-AUTH] Hydration completed. Setting loading state to FALSE.');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkUser();
    }, [checkUser]);

    const retryAuth = useCallback(async () => {
        setAuthError(null);
        setLoading(true);
        await checkUser();
    }, [checkUser]);

    // ── Socket: identify user & re-identify on reconnect ────────────────────
    useEffect(() => {
        if (!user || !socket) return;

        socket.emit('identify', user.id);

        const handleConnect = () => socket.emit('identify', user.id);
        socket.on('connect', handleConnect);

        return () => socket.off('connect', handleConnect);
    }, [user]);

    // ── Auth actions ─────────────────────────────────────────────────────────

    const login = useCallback(async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        // Use token from login response directly — avoids a second round-trip to /me
        // Fall back to /me if user data not included in login response
        const userData = res.data.user ?? (await api.get('/auth/me')).data;
        setUser(userData);
        // Reconnect socket so it picks up the new auth token via the dynamic auth callback
        if (socket.connected) {
            socket.disconnect();
        }
        socket.connect();
        return userData;
    }, []);

    const register = useCallback(async (username, email, password) => {
        const res = await api.post('/auth/register-public', { username, email, password });
        localStorage.setItem('token', res.data.token);
        const userData = res.data.user ?? (await api.get('/auth/me')).data;
        setUser(userData);
        // Reconnect socket so it picks up the new auth token
        if (socket.connected) {
            socket.disconnect();
        }
        socket.connect();
        return userData;
    }, []);

    const setRole = useCallback(async (role) => {
        const res = await api.post('/auth/set-role', { role });
        setUser(prev => ({ ...prev, role: res.data.role }));
        return res.data;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch (err) {
            console.error('Failed to notify backend of secure logout:', err);
        }
        if (user && socket) {
            socket.emit('logout', user.id);
            socket.disconnect();
        }
        localStorage.removeItem('token');
        setUser(null);
        setTimeout(() => {
            if (socket) socket.connect();
        }, 100);
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user, loading, authError, retryAuth,
            login, register, logout, setRole,
            theme, setTheme,
            font: 'inter',
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
