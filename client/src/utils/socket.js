import { io } from 'socket.io-client';

// Hardcoded production URL - change this if your backend URL changes
const PRODUCTION_SOCKET_URL = 'https://quiz-backend-qgro.onrender.com';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.PROD ? PRODUCTION_SOCKET_URL : 'http://localhost:5000');

const socket = io(SOCKET_URL, {
    auth: (cb) => {
        cb({
            token: localStorage.getItem('token') || ''
        });
    },

    // websocket first, fallback to polling if blocked by proxy
    transports: ['websocket', 'polling'],

    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5, // adds jitter to prevent 500+ clients reconnecting simultaneously

    timeout: 20000,

    // Don't auto-connect on login page before token exists
    autoConnect: false,

    forceNew: false
});

// Diagnostic logging helper for live socket debugging
socket.on('connect', () => {
    console.log('[SOCKET] Connected to server successfully. Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.warn('[SOCKET] Disconnected from server. Reason:', reason);
});

socket.on('connect_error', (err) => {
    console.error('[SOCKET] Connection error:', err.message, err);
});

socket.on('error_alert', (data) => {
    console.error('[SOCKET ERROR ALERT]:', data?.msg || data);
});

export const ensureSocketConnected = () => {
    const token = localStorage.getItem('token');
    if (!socket.connected && token) {
        console.log('[SOCKET] Ensuring active connection with existing token...');
        socket.connect();
    }
    return socket;
};

// Only auto-connect if a token already exists (returning user / page refresh)
if (localStorage.getItem('token')) {
    socket.connect();
}

export default socket;

