import { io } from 'socket.io-client';

const PRODUCTION_SOCKET_URL = 'https://demo-project-3izc.onrender.com';

const isProductionDomain = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('render.com') ||
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (isProductionDomain ? PRODUCTION_SOCKET_URL : 'http://localhost:5000');

const socket = io(SOCKET_URL, {
    auth: (cb) => {
        const token = localStorage.getItem('token') || '';
        cb({ token });
    },
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
    if (reason === 'io server disconnect') {
        // Server forcefully disconnected due to auth failure; don't auto-reconnect without fresh token
        const token = localStorage.getItem('token');
        if (token) socket.connect();
    }
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?expired=true';
    }
});

export const ensureSocketConnected = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('[SOCKET] Refusing connect: No auth token found.');
        if (socket.connected) socket.disconnect();
        return socket;
    }
    if (!socket.connected) {
        console.log('[SOCKET] Connecting socket with auth token...');
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

// Only connect on module import if a valid token exists
if (typeof window !== 'undefined' && localStorage.getItem('token')) {
    socket.connect();
}

export default socket;
