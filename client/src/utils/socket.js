import { io } from 'socket.io-client';

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
    auth: (cb) => {
        cb({
            token: localStorage.getItem('token') || ''
        });
    },

    transports: ['websocket', 'polling'],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    timeout: 20000,

    autoConnect: true,

    forceNew: false
});

export default socket;
