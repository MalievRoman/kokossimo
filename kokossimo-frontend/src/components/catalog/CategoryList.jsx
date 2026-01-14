import React from 'react';
import { Link } from 'react-router-dom';
import CategoryCard from './CategoryCard';
import { categories } from '../../data/categories'; // Импортируем данные
import { ChevronRight } from 'lucide-react';
import './CategoryList.css';

const CategoryList = () => {
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
          {categories.map((category) => (
            <CategoryCard 
              key={category.id}
              title={category.title}
              image={category.image}
              slug={category.slug}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryList;
