import React from 'react';
import HeroBlock from '../components/layout/HeroBlock';
import CategoryList from '../components/catalog/CategoryList';
import ProductSlider from '../components/product/ProductSlider';
import NewsletterForm from '../components/forms/NewsletterForm'; // Импорт формы
import { products } from '../data/products';

// HomePage.jsx
const HomePage = () => {
  return (
    // Добавляем класс 'page-animation'
    <div className="home-page page-animation"> 
      <HeroBlock />
      <CategoryList />
      <ProductSlider title="БЕСТСЕЛЛЕРЫ" products={products} linkTo="/bestsellers" />
      <ProductSlider title="НОВИНКИ" products={products} linkTo="/new" />
      <NewsletterForm />
    </div>
  );
};


export default HomePage;
