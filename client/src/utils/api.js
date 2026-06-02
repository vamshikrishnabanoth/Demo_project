import axios from 'axios';

// Hardcoded production URL - change this if your backend URL changes
const PRODUCTION_API_URL = 'https://quiz-backend-qgro.onrender.com/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:5000/api');

const api = axios.create({
    baseURL: API_BASE_URL,
    // Render free-tier cold starts can take 50-60s. 120s gives plenty of headroom.
    timeout: 120000,
    // SECURITY: Enable cookie-based credentials for secure token transport
    withCredentials: true,
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
// Also auto-retries on timeout/network errors (Render cold-start recovery)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        // Auto-retry on timeout or network errors (cold-start handling)
        const isRetryable = error.code === 'ECONNABORTED' || 
                            error.code === 'ERR_NETWORK' || 
                            !error.response;

        if (isRetryable && config && !config._retryCount) {
            config._retryCount = 0;
        }

        if (isRetryable && config && config._retryCount < 2) {
            config._retryCount += 1;
            console.log(`[API] Retry attempt ${config._retryCount} for ${config.url} (server may be waking up)...`);
            // Wait 3 seconds before retrying to give Render time to spin up
            await new Promise(resolve => setTimeout(resolve, 3000));
            return api(config);
        }

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
