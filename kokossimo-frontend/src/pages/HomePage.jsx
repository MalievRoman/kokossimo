import React, { useState, useEffect } from 'react';
import HeroBlock from '../components/layout/HeroBlock';
import CategoryList from '../components/catalog/CategoryList';
import ProductSlider from '../components/product/ProductSlider';
import NewsletterForm from '../components/forms/NewsletterForm';

// Импортируем функции API
import { getBestsellers, getNewProducts } from '../services/api';

const HomePage = () => {
  // Создаем состояния для хранения данных
  const [bestsellers, setBestsellers] = useState([]);
  const [newProducts, setNewProducts] = useState([]);

  // Загружаем данные при открытии страницы
  useEffect(() => {
    // 1. Загрузка Бестселлеров
    getBestsellers()
      .then(response => {
        // Django REST Framework может возвращать массив или объект с results
        let data = [];
        if (Array.isArray(response.data)) {
          data = response.data;
        } else if (response.data && Array.isArray(response.data.results)) {
          data = response.data.results;
        } else if (response.data && typeof response.data === 'object') {
          // Если это объект, попробуем найти массив внутри
          data = Object.values(response.data).find(val => Array.isArray(val)) || [];
        }
        setBestsellers(data);
      })
      .catch(() => {
        setBestsellers([]);
      });

    // 2. Загрузка Новинок
    getNewProducts()
      .then(response => {
        // Django REST Framework может возвращать массив или объект с results
        let data = [];
        if (Array.isArray(response.data)) {
          data = response.data;
        } else if (response.data && Array.isArray(response.data.results)) {
          data = response.data.results;
        } else if (response.data && typeof response.data === 'object') {
          // Если это объект, попробуем найти массив внутри
          data = Object.values(response.data).find(val => Array.isArray(val)) || [];
        }
        setNewProducts(data);
      })
      .catch(() => {
        setNewProducts([]);
      });
  }, []);

  return (
    <div className="home-page page-animation">
      <HeroBlock />
      
      <CategoryList />
      
      {bestsellers.length > 0 && (
        <ProductSlider title="БЕСТСЕЛЛЕРЫ" products={bestsellers} linkTo="/catalog?filter=bestsellers" />
      )}
      
      {newProducts.length > 0 && (
        <ProductSlider title="НОВИНКИ" products={newProducts} linkTo="/catalog?filter=new" />
      )}

      <NewsletterForm />
    </div>
  );
};

export default HomePage;
