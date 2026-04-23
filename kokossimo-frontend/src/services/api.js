import axios from 'axios';

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

// In prod use same-origin /api via nginx; for dev you can override with VITE_API_URL
const API_BASE_URL = import.meta.env.PROD ? '/api' : resolveDevApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: {
    // Кастомная сериализация для поддержки множественных значений параметров
    // Например: { category: ['face', 'body'] } -> 'category=face&category=body'
    serialize: (params) => {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => {
              searchParams.append(key, item);
            });
          } else {
            searchParams.append(key, value);
          }
        }
      });
      return searchParams.toString();
    }
  },
});

const notifyAuthTokenChanged = () => {
  try {
    window.dispatchEvent(new Event('auth-token-changed'));
  } catch {
    // ignore
  }
};

const AUTH_PUBLIC_ENDPOINTS = new Set([
  '/auth/register/',
  '/auth/login/',
  '/auth/email/send/',
  '/auth/email/verify/',
]);

const handleInvalidAuthToken = () => {
  const hadToken = Boolean(localStorage.getItem('authToken'));
  if (hadToken) {
    localStorage.removeItem('authToken');
    notifyAuthTokenChanged();
  }

  if (window.location.pathname !== '/auth') {
    // Требование: без сообщения об ошибке, просто переводим на страницу входа.
    window.location.assign('/auth');
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const token = localStorage.getItem('authToken');
    const requestUrl = String(error?.config?.url || '');
    const isPublicAuthCall = AUTH_PUBLIC_ENDPOINTS.has(requestUrl);

    // Если токен в стораже есть, но бэкенд ответил 401 на защищённый запрос —
    // значит сессия больше не валидна (например, после смены пароля на другом устройстве).
    if (status === 401 && token && !isPublicAuthCall) {
      handleInvalidAuthToken();
      error.__kokoAuthRedirect = true;
    }

    return Promise.reject(error);
  }
);

export const getProducts = (params) => api.get('/products/', { params });
export const getProductsPriceRange = (params) => api.get('/products/price-range/', { params });
export const getProduct = (id) => api.get(`/products/${id}/`);
export const getCategories = () => api.get('/categories/');
export const getProductSubcategories = () => api.get('/product-subcategories/');
export const getProductSubcategoriesTree = () => api.get('/product-subcategories/tree/');
export const getDeliveryCities = () => api.get('/delivery/cities/');
export const registerUser = (payload) => api.post('/auth/register/', payload);
export const loginUser = (payload) => api.post('/auth/login/', payload);
export const sendEmailCode = (payload) => api.post('/auth/email/send/', payload);
export const verifyEmailCode = (payload) => api.post('/auth/email/verify/', payload);
export const getCurrentUser = (token) =>
  api.get('/auth/me/', {
    headers: { Authorization: `Token ${token}` },
  });
export const logoutUser = (token) =>
  api.post(
    '/auth/logout/',
    {},
    {
      headers: { Authorization: `Token ${token}` },
    }
  );
export const updateProfile = (token, payload) =>
  api.patch('/auth/profile/', payload, {
    headers: { Authorization: `Token ${token}` },
  });
export const getSavedDeliveryAddresses = (token) =>
  api.get('/auth/addresses/', {
    headers: { Authorization: `Token ${token}` },
  });
export const saveDeliveryAddress = (token, payload) =>
  api.post('/auth/addresses/', payload, {
    headers: { Authorization: `Token ${token}` },
  });
export const updateSavedDeliveryAddress = (token, addressId, payload) =>
  api.patch(`/auth/addresses/${addressId}/`, payload, {
    headers: { Authorization: `Token ${token}` },
  });
export const deleteSavedDeliveryAddress = (token, addressId) =>
  api.delete(`/auth/addresses/${addressId}/`, {
    headers: { Authorization: `Token ${token}` },
  });

export const createOrder = (payload, token) =>
  api.post('/orders/', payload, {
    headers: token ? { Authorization: `Token ${token}` } : undefined,
  });
export const createYooKassaPayment = (orderId, token) =>
  api.post(
    '/payments/yookassa/create/',
    { order_id: orderId },
    {
      headers: { Authorization: `Token ${token}` },
    }
  );
export const getMyOrders = (token) =>
  api.get('/orders/list/', {
    headers: { Authorization: `Token ${token}` },
  });
export const getOrderDetail = (token, orderId) =>
  api.get(`/orders/${orderId}/`, {
    headers: { Authorization: `Token ${token}` },
  });

// Специальные фильтры
export const getBestsellers = () => api.get('/products/', { params: { is_bestseller: 'true', page_size: 12 } });
export const getNewProducts = () => api.get('/products/', { params: { is_new: 'true', page_size: 12 } });

// Юридические документы (из backend/legal_info)
export const getLegalDocument = (slug) => api.get(`/legal/${slug}/`);

export const getUserCart = (token) =>
  api.get('/cart/', {
    headers: { Authorization: `Token ${token}` },
  });

export const replaceUserCart = (token, items) =>
  api.put(
    '/cart/',
    { items },
    {
      headers: { Authorization: `Token ${token}` },
    }
  );

export const mergeUserCart = (token, items) =>
  api.post(
    '/cart/merge/',
    { items },
    {
      headers: { Authorization: `Token ${token}` },
    }
  );

export const getUserFavorites = (token) =>
  api.get('/favorites/', {
    headers: { Authorization: `Token ${token}` },
  });

export const replaceUserFavorites = (token, items) =>
  api.put(
    '/favorites/',
    { items },
    {
      headers: { Authorization: `Token ${token}` },
    }
  );

export const mergeUserFavorites = (token, items) =>
  api.post(
    '/favorites/merge/',
    { items },
    {
      headers: { Authorization: `Token ${token}` },
    }
  );

export default api;
