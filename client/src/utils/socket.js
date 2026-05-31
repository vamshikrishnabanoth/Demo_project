import { io } from 'socket.io-client';

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
    auth: (cb) => {
        cb({
            token: localStorage.getItem('token') || ''
        });
    },

    // Use polling first, then upgrade to websocket.
    // This is critical for Render.com deployments — Render's free tier
    // requires the HTTP handshake (polling) before upgrading to WebSocket.
    // Starting with 'websocket' directly causes the "WebSocket closed before
    // connection established" error visible in the console.
    transports: ['polling', 'websocket'],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    timeout: 20000,

    // Don't auto-connect on page load — connect only after login token exists.
    // This prevents the failed socket connection attempt on the login page
    // when there's no auth token yet.
    autoConnect: false,

    forceNew: false
});

// Only auto-connect if a token already exists (returning user / page refresh)
if (localStorage.getItem('token')) {
    socket.connect();
}

export default socket;
