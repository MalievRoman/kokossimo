import React from 'react';
import { Link } from 'react-router-dom';
import './CategoryCard.css';

const CategoryCard = ({ title, image, slug }) => {
  return (
    <Link to={`/catalog?filter=${slug}`} className="category-card">
      <div className="category-card__image-wrapper">
        <img src={image} alt={title} className="category-card__image" />
      </div>
      <h3 className="category-card__title">{title}</h3>
    </Link>
  );
};

export default CategoryCard;
