import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
    // Read the token at connection/reconnection time so the JWT is always current.
    // This fixes the issue where the socket was created before login and had no token.
    auth: (cb) => cb({ token: localStorage.getItem('token') || '' }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
});

export default socket;
