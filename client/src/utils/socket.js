import { io } from 'socket.io-client';

const PRODUCTION_SOCKET_URL = 'https://quiz-backend-qgro.onrender.com';

const isProductionDomain = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('render.com') ||
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (isProductionDomain ? PRODUCTION_SOCKET_URL : 'http://localhost:5000');

const socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 60000,
    autoConnect: false,
    forceNew: false
});

socket.on('connect', () => {
    console.log('[SOCKET] Connected to server successfully. Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.warn('[SOCKET] Disconnected from server. Reason:', reason);
});

socket.on('connect_error', (err) => {
    console.error('[SOCKET] Connection error:', err.message);
    if (err.message && err.message.toLowerCase().includes('authentication failed')) {
        console.warn('[SOCKET] Authentication failed. Disconnecting socket to stop loop.');
        socket.disconnect();
    }
});

socket.on('error_alert', (data) => {
    console.error('[SOCKET ERROR ALERT]:', data?.msg || data);
    if (data?.code === 'SESSION_EXPIRED') {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } catch (_) {}
        window.location.href = '/login?expired=true';
    }
});

export const ensureSocketConnected = () => {
    if (!socket.connected) {
        console.log('[SOCKET] Connecting socket...');
        socket.connect();
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket.connected) {
        console.log('[SOCKET] Manually disconnecting socket...');
        socket.disconnect();
    }
};

export default socket;

