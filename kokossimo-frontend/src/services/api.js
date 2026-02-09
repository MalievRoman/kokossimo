import axios from 'axios';

// In prod use same-origin /api via nginx; for dev you can override with VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

export const getProducts = (params) => api.get('/products/', { params });
export const getProduct = (id) => api.get(`/products/${id}/`);
export const getProductRatings = (productId) => api.get(`/products/${productId}/ratings/`);
export const rateProduct = (productId, payload, token) =>
  api.post(`/products/${productId}/rate/`, payload, {
    headers: { Authorization: `Token ${token}` },
  });
export const getCategories = () => api.get('/categories/');
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
export const getMyOrders = (token) =>
  api.get('/orders/list/', {
    headers: { Authorization: `Token ${token}` },
  });
export const getOrderDetail = (token, orderId) =>
  api.get(`/orders/${orderId}/`, {
    headers: { Authorization: `Token ${token}` },
  });

// Специальные фильтры
export const getBestsellers = () => api.get('/products/', { params: { is_bestseller: 'true' } });
export const getNewProducts = () => api.get('/products/', { params: { is_new: 'true' } });

export default api;
