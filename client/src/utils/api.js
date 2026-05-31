import axios from 'axios';

// Hardcoded production URL - change this if your backend URL changes
const PRODUCTION_API_URL = 'https://quiz-backend-qgro.onrender.com/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:5000/api');

const api = axios.create({
    baseURL: API_BASE_URL,
    // Increased to 30s to gracefully accommodate server/database cold starts on first load
    timeout: 30000,
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
