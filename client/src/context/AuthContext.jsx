import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import socket, { ensureSocketConnected } from '../utils/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    // ── Restore session on mount via secure cookie ────────────────────────────
    const checkUser = useCallback(async () => {
        try {
            const res = await api.get('/auth/me');
            setUser(res.data);
            setAuthError(null);
        } catch (err) {
            // If the server explicitly tells us the token is invalid/expired (401 or 403)
            if (err.response?.status === 401 || err.response?.status === 403) {
                setUser(null);
                try { localStorage.removeItem('token'); } catch (_) {}
            } else {
                console.error('[AuthContext] Network or server error during auth hydration:', err);
                setAuthError(err);
            }
        } finally {
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
        if (!user) return;

        ensureSocketConnected();

        socket.emit('identify', user.id);

        const handleConnect = () => socket.emit('identify', user.id);
        socket.on('connect', handleConnect);

        return () => socket.off('connect', handleConnect);
    }, [user]);

    // ── Auth actions ─────────────────────────────────────────────────────────

    const login = useCallback(async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        if (res.data?.token) {
            try { localStorage.setItem('token', res.data.token); } catch (_) {}
        }
        const userData = res.data.user ?? (await api.get('/auth/me')).data;
        setUser(userData);
        if (socket.connected) {
            socket.disconnect();
        }
        ensureSocketConnected();
        return userData;
    }, []);


    const setRole = useCallback(async (role) => {
        const res = await api.post('/auth/set-role', { role });
        if (res.data?.token) {
            try { localStorage.setItem('token', res.data.token); } catch (_) {}
        }
        setUser(prev => ({ ...prev, role: res.data.role }));
        return res.data;
    }, []);

    // Merge partial user data into context (used after profile/admin edits)
    const updateUser = useCallback((partialData) => {
        setUser(prev => prev ? { ...prev, ...partialData } : prev);
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

        // ── Strict Account Isolation & Session Security ─────────────────────────
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('quiz_docket_inputs'); // Clean legacy un-scoped key
            if (window.indexedDB) {
                window.indexedDB.deleteDatabase('pending_audio_recordings');
            }
        } catch (e) {
            console.error('Failed to purge un-scoped session storage on logout:', e);
        }

        setUser(null);
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user, loading, authError, retryAuth,
            login, logout, setRole, updateUser,
            font: 'inter',
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
