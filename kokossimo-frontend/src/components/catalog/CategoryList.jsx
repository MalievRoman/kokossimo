import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CategoryCard from './CategoryCard';
import { getCategories } from '../../services/api';
import { ChevronRight } from 'lucide-react';
import './CategoryList.css';

const CategoryList = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategories()
      .then(response => {
        // Django REST Framework может возвращать массив или объект с results
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        // Ограничиваем до 6 категорий для главной страницы
        setCategories(data.slice(0, 6));
      })
      .catch(error => {
        console.error("Ошибка загрузки категорий:", error);
        setCategories([]);
      });
  }, []);

  return (
    <section className="category-section">
      <div className="container">
        <div className="category-section__header">
          <h2 className="section-title">КАТАЛОГ</h2>
          <Link to="/catalog" className="section-link">
            ВЕСЬ КАТАЛОГ <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="category-grid">
          {categories.map((category) => {
            // Обработка URL изображения
            const imageUrl = category.image 
              ? (category.image.startsWith('http') ? category.image : `http://127.0.0.1:8000${category.image}`)
              : 'https://placehold.co/400x400/F5E6D3/8B4513?text=No+Image';
            
            return (
              <CategoryCard 
                key={category.id}
                title={category.name}
                image={imageUrl}
                slug={category.slug}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryList;
