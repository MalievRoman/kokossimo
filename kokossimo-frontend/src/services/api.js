import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Товары
export const getProducts = (params) => api.get('/products/', { params });
export const getProduct = (id) => api.get(`/products/${id}/`);
export const searchProducts = (query) => api.get('/products/search/', { params: { q: query } });

// Категории
export const getCategories = () => api.get('/categories/');

// Бестселлеры и новинки
export const getBestsellers = () => api.get('/products/', { params: { bestsellers: true } });
export const getNewProducts = () => api.get('/products/', { params: { new: true } });

export default api;
