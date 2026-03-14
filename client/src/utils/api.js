import axios from 'axios';
import { encryptPayload } from './crypto';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://ppg-itech.onrender.com/api/login',
});

// Add a request interceptor: attach token and AES-GCM encrypt JSON bodies
api.interceptors.request.use(
    async (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Only encrypt for mutating requests and when explicit opt-out header is not set
        const method = (config.method || '').toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method) && !config.headers['X-Disable-Encrypt']) {
            try {
                const encrypted = await encryptPayload(config.data || {});
                // Replace payload with encrypted object and mark header
                config.data = encrypted;
                config.headers['X-Encrypted'] = '1';
                config.headers['Content-Type'] = 'application/json';
            } catch (err) {
                // If encryption fails, reject the request
                return Promise.reject(err);
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
