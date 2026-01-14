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
        setBestsellers(response.data);
      })
      .catch(error => console.error("Ошибка загрузки бестселлеров:", error));

    // 2. Загрузка Новинок
    getNewProducts()
      .then(response => {
        setNewProducts(response.data);
      })
      .catch(error => console.error("Ошибка загрузки новинок:", error));
  }, []);

  return (
    <div className="home-page page-animation">
      <HeroBlock />
      
      {/* CategoryList тоже нужно будет переделать, но пока оставим как есть */}
      <CategoryList />
      
      {/* Передаем реальные данные в слайдеры */}
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
