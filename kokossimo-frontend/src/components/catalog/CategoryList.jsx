import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProductSubcategoriesTree } from '../../services/api';

// Блок "КАТАЛОГ" на главной: актуальные категории из дерева подкатегорий (parent 1–6).
// Ссылки ведут в каталог с фильтром ?parent=X.

const CategoryList = () => {
  const [categories, setCategories] = useState([]);

  const getCategoryImageUrl = (name) => {
    const normalized = String(name || '').trim().toLowerCase();
    const basePath = `${import.meta.env.BASE_URL}assets/home-categories/`;

    if (normalized.includes('лиц')) return `${basePath}cosm.png`;
    if (normalized.includes('тел')) return `${basePath}uhod.png`;
    if (normalized.includes('волос')) return `${basePath}uhod2.png`;
    if (normalized.includes('парфюм')) return `${basePath}parf.png`;
    if (normalized.includes('макияж')) return `${basePath}make.png`;
    if (normalized.includes('бад')) return `${basePath}bad.png`;

    return `${import.meta.env.BASE_URL}assets/beauty_elements.png`;
  };

  useEffect(() => {
    getProductSubcategoriesTree()
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];
        setCategories(data.slice(0, 6));
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  return (
    <section className="catalog block">
      <div className="container">
        <div className="catalog__top">
          <h2 className="catalog__title">
            <Link to="/catalog" className="catalog__title-link">
              <span>КАТАЛОГ</span>
              <svg
                className="catalog__title-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </h2>

          <Link to="/catalog" className="catalog__all">
            <span>СМОТРЕТЬ ВСЁ</span>
            <svg
              className="catalog__all-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        <div className="catalog__grid">
          {categories.map((item) => {
            const imageUrl = getCategoryImageUrl(item.name);

            return (
              <Link
                key={item.code}
                to={`/catalog?parent=${encodeURIComponent(item.code)}`}
                className="catalog-card"
              >
                <div className="catalog-card__thumb">
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="catalog-card__image"
                  />
                </div>
                <div className="catalog-card__name">{item.name}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryList;
