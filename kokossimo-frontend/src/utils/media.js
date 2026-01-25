const getApiOrigin = () => {
  const apiBase = import.meta.env.VITE_API_URL || '/api';
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
