const withApiPath = (baseUrl) => `${baseUrl.replace(/\/+$/, '')}/api`;

const resolveDevApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (import.meta.env.VITE_BACKEND_URL) {
    return withApiPath(import.meta.env.VITE_BACKEND_URL);
  }

  return '/api';
};

const getApiOrigin = () => {
  const apiBase = import.meta.env.PROD
    ? '/api'
    : resolveDevApiBaseUrl();
  const apiUrl = new URL(apiBase, window.location.origin);
  return apiUrl.origin;
};

export const resolveMediaUrl = (rawUrl, fallback = '') => {
  if (!rawUrl) return fallback || '';
  if (typeof rawUrl !== 'string') return fallback || '';
  if (rawUrl.startsWith('http')) return rawUrl;
  const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return `${getApiOrigin()}${cleanPath}`;
};
