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

    // polling first, then upgrade to websocket — required for Render.com deployments
    transports: ['polling', 'websocket'],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    timeout: 20000,

    // Don't auto-connect on login page before token exists
    autoConnect: false,

    forceNew: false
});

// Only auto-connect if a token already exists (returning user / page refresh)
if (localStorage.getItem('token')) {
    socket.connect();
}

export default socket;
