import axios from 'axios';

// Если вы работаете локально, Django обычно на порту 8000
const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getProducts = (params) => api.get('/products/', { params });
export const getProduct = (id) => api.get(`/products/${id}/`);
export const getCategories = () => api.get('/categories/');
export const registerUser = (payload) => api.post('/auth/register/', payload);
export const loginUser = (payload) => api.post('/auth/login/', payload);
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
