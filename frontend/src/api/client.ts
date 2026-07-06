import axios from 'axios';

// ---------------------------------------------------------------------------
// EQIP — Axios API client
// Base URL defaults to same-origin (empty string). The /api/v1 prefix is
// baked into the baseURL so every request path is relative to the versioned
// API root. In dev the Vite proxy forwards /api to the backend; in prod
// CloudFront→ALB routes /api* to the backend container.
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Request interceptor: attach Bearer token ----
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---- Response interceptor: global 401 handler ----
// Auth endpoints are excluded so a failed login/logout/refresh surfaces an
// inline error instead of triggering a redirect.
const AUTH_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh'];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !isAuthEndpoint(error.config?.url)
    ) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
