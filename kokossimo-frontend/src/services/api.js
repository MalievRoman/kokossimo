import axios from 'axios';

// In prod use same-origin /api via nginx; for dev you can override with VITE_API_URL
const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL || '/api');

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

const isInvalidTokenDetail = (detail) => {
  if (!detail) return false;
  const text = String(detail).toLowerCase();
  return text.includes('invalid token') || text.includes('token is invalid');
};

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
    const detail = error?.response?.data?.detail;

    if (status === 401 && isInvalidTokenDetail(detail)) {
      handleInvalidAuthToken();
      error.__authRedirect = true;
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
