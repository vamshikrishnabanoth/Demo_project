// High-performance Native Fetch API wrapper (replaces Axios dependency completely)
const PRODUCTION_API_URL = 'https://quiz-backend-qgro.onrender.com/api';

const isProductionDomain = typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('render.com') ||
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
);

// Guard against stale suspended render instances configured in Vercel environment variables
const rawApiUrl = import.meta.env.VITE_API_URL;
const validApiUrl = (rawApiUrl && !rawApiUrl.includes('demo-project-3izc')) ? rawApiUrl : null;

const API_BASE_URL = validApiUrl || (isProductionDomain ? PRODUCTION_API_URL : 'http://localhost:5000/api');

async function request(endpoint, options = {}, retryCount = 0) {
    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    // Automatically convert options.params object into URL query string (Axios compatibility)
    if (options.params && typeof options.params === 'object') {
        const queryParams = new URLSearchParams();
        Object.entries(options.params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                queryParams.append(key, val);
            }
        });
        const queryString = queryParams.toString();
        if (queryString) {
            url += (url.includes('?') ? '&' : '?') + queryString;
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    // CRITICAL: When sending FormData, delete Content-Type so fetch() automatically sets boundary
    if (options.body instanceof FormData || (headers['Content-Type'] && headers['Content-Type'].includes('multipart/form-data'))) {
        delete headers['Content-Type'];
        delete headers['content-type'];
    }

    const { headers: customHeaders, timeout: customTimeout, ...restOptions } = options;

    // Use XMLHttpRequest for file uploads requiring real-time onUploadProgress events
    if (options.onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'POST', url, true);
            xhr.withCredentials = true;

            Object.entries(headers).forEach(([k, v]) => {
                xhr.setRequestHeader(k, v);
            });

            xhr.upload.onprogress = (event) => {
                options.onUploadProgress(event);
            };

            const effectiveTimeout = customTimeout !== undefined ? customTimeout : (options.timeout || 1800000);
            xhr.timeout = effectiveTimeout;

            xhr.onload = () => {
                let data;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch {
                    data = xhr.responseText;
                }

                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({ data, status: xhr.status });
                } else {
                    if (xhr.status === 401 && !endpoint.includes('/auth/me') && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                        window.location.href = '/login';
                    }
                    const err = new Error(data?.message || data?.msg || data?.error || `HTTP Error ${xhr.status}`);
                    err.response = { status: xhr.status, data };
                    reject(err);
                }
            };

            xhr.onerror = () => {
                const err = new Error('Network transfer error during audio upload');
                err.response = { status: 0, data: { message: 'Network transfer error' } };
                reject(err);
            };

            xhr.ontimeout = () => {
                const err = new Error(`Audio upload timed out after ${Math.round(effectiveTimeout / 1000)}s`);
                err.response = { status: 408, data: { message: 'Upload timed out' } };
                reject(err);
            };

            xhr.send(options.body);
        });
    }

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

    // Support AbortSignal and timeout properly
    const controller = new AbortController();
    const effectiveTimeout = customTimeout !== undefined ? customTimeout : (options.timeout || 120000);
    const timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timeout after ${effectiveTimeout}ms`));
    }, effectiveTimeout);

    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(options.signal.reason));
    }
    fetchOptions.signal = controller.signal;

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
                const isAuthCheck = endpoint.includes('/auth/me');
                if (!isAuthCheck && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
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
        
        const isAbort = error.name === 'AbortError' || error.message?.includes('aborted');
        const isRetryable = (isAbort || error.message === 'Failed to fetch' || !error.response) && retryCount < 2;
        
        if (isRetryable) {
            const delay = Math.floor(2000 * Math.pow(1.5, retryCount) + Math.random() * 1500);
            console.log(`[API] Retry attempt ${retryCount + 1} for ${endpoint} after ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return request(endpoint, options, retryCount + 1);
        }

        if (!error.response) {
            let msg = error.message;
            if (isAbort) {
                msg = `The server took too long to respond (${Math.round(effectiveTimeout / 1000)}s timeout). The request was cancelled.`;
            }
            error.response = { status: 0, data: { message: msg } };
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

export { API_BASE_URL };
export default api;
