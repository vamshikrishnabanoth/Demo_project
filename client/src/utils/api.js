import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

if (import.meta.env.PROD && API_BASE_URL.includes('localhost')) {
    console.warn('⚠️ Frontend is in PRODUCTION but VITE_API_URL is missing! Falling back to localhost.');
}

const api = axios.create({
    baseURL: API_BASE_URL,
    // Fail fast — don't let users stare at a frozen screen
    timeout: 15000,
});

// ─── REQUEST INTERCEPTOR ──────────────────────────────────────────────────────
// Attach token from localStorage on every outgoing request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR ─────────────────────────────────────────────────────
// Centralized 401 handling — auto-logout if token expires
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — clean up and redirect
            localStorage.removeItem('token');
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
