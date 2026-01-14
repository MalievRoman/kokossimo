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

// Специальные фильтры
export const getBestsellers = () => api.get('/products/', { params: { is_bestseller: 'true' } });
export const getNewProducts = () => api.get('/products/', { params: { is_new: 'true' } });

export default api;
