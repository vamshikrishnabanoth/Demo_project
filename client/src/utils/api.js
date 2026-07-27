// High-performance Native Fetch API wrapper (replaces Axios dependency completely)
const PRODUCTION_API_URL = 'https://quiz-backend-qgro.onrender.com/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD ? PRODUCTION_API_URL : 'http://localhost:5000/api');

async function request(endpoint, options = {}, retryCount = 0) {
    const token = localStorage.getItem('token');
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['x-auth-token'] = token;
    }

    // CRITICAL: When sending FormData, delete Content-Type so fetch() automatically sets boundary
    if (options.body instanceof FormData || (headers['Content-Type'] && headers['Content-Type'].includes('multipart/form-data'))) {
        delete headers['Content-Type'];
        delete headers['content-type'];
    }

    const { headers: customHeaders, timeout: customTimeout, ...restOptions } = options;

    const fetchOptions = {
        method: options.method || 'GET',
        credentials: 'include',
        ...restOptions,
        headers,
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        fetchOptions.body = JSON.stringify(options.body);
    } else if (options.body) {
        fetchOptions.body = options.body;
    }

    // Support AbortSignal timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 120000);
    fetchOptions.signal = options.signal || controller.signal;

    try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
            }
            const err = new Error(data?.message || `HTTP Error ${response.status}`);
            err.response = { status: response.status, data };
            throw err;
        }

        return { data, status: response.status, headers: response.headers };
    } catch (error) {
        clearTimeout(timeoutId);
        
        const isRetryable = error.name === 'AbortError' || error.message === 'Failed to fetch' || !error.response;
        
        if (isRetryable && retryCount < 2) {
            const delay = Math.floor(2000 * Math.pow(1.5, retryCount) + Math.random() * 1500);
            console.log(`[API] Retry attempt ${retryCount + 1} for ${endpoint} after ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return request(endpoint, options, retryCount + 1);
        }

        if (!error.response) {
            error.response = { status: 0, data: { message: error.message } };
        }
        throw error;
    }
}

const api = {
    get: (url, config = {}) => request(url, { ...config, method: 'GET' }),
    post: (url, body, config = {}) => request(url, { ...config, method: 'POST', body }),
    put: (url, body, config = {}) => request(url, { ...config, method: 'PUT', body }),
    patch: (url, body, config = {}) => request(url, { ...config, method: 'PATCH', body }),
    delete: (url, config = {}) => request(url, { ...config, method: 'DELETE' }),
    create: () => api,
    interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
    }
};

export default api;
