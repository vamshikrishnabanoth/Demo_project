import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import socket from '../utils/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setThemeState] = useState(() => localStorage.getItem('app-theme') || 'celestial');
    const [font, setFontState]   = useState(() => localStorage.getItem('app-font-key') || 'segoe');

    // ── Apply theme & font to DOM ────────────────────────────────────────────
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-font', font);
        localStorage.setItem('app-font-key', font);
    }, [font]);

    // ── Restore session on mount ─────────────────────────────────────────────
    useEffect(() => {
        const checkUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await api.get('/auth/me');
                setUser(res.data);
            } catch (err) {
                // Only clear token if the server explicitly tells us the token is invalid/expired (401 or 403)
                // If it's a temporary network error or 5xx server error, keep the token so we don't force log out!
                if (err.response?.status === 401 || err.response?.status === 403) {
                    console.warn('[AuthContext] Session expired/invalid. Clearing token.', err);
                    localStorage.removeItem('token');
                } else {
                    console.error('[AuthContext] Network or server error during auth hydration:', err);
                }
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, []);

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

    const logout = useCallback(() => {
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

    const setTheme = useCallback((t) => setThemeState(t), []);
    const setFont  = useCallback((f) => setFontState(f), []);

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, register, logout, setRole,
            theme, setTheme,
            font, setFont,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
