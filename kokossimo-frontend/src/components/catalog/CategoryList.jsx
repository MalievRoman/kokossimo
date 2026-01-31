import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, getProducts } from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';

// Блок "КАТАЛОГ" под верстку из main_page.html.
// Берёт реальные категории с бэкенда и рендерит их
// в сетку .catalog__grid с карточками .catalog-card.

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});

  useEffect(() => {
    getCategories()
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];
        setCategories(data.slice(0, 6)); // как и раньше: до 6 категорий
      })
      .catch((error) => {
        console.error('Ошибка загрузки категорий:', error);
        setCategories([]);
      });
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    let isActive = true;

    const loadCategoryImages = async () => {
      const entries = await Promise.all(
        categories.map(async (category) => {
          try {
            const response = await getProducts({ category: category.slug });
            const data = Array.isArray(response.data)
              ? response.data
              : response.data?.results || [];
            const productWithImage = data.find((item) => item.image);
            const imageUrl = productWithImage?.image
              ? resolveMediaUrl(productWithImage.image)
              : '';
            return [category.id, imageUrl];
          } catch {
            return [category.id, ''];
          }
        })
      );

      if (!isActive) return;
      const nextImages = {};
      entries.forEach(([id, url]) => {
        if (url) nextImages[id] = url;
      });
      setCategoryImages(nextImages);
    };

    loadCategoryImages();

    return () => {
      isActive = false;
    };
  }, [categories]);

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
          {categories.map((category) => {
            const imageUrl = category.image
              ? resolveMediaUrl(category.image)
              : categoryImages[category.id] || `${import.meta.env.BASE_URL}assets/beauty_elements.png`;

            return (
              <Link
                key={category.id}
                to={`/catalog?filter=${category.slug}`}
                className="catalog-card"
              >
                <div className="catalog-card__thumb">
                  <img
                    src={imageUrl}
                    alt={category.name}
                    className="catalog-card__image"
                  />
                </div>
                <div className="catalog-card__name">{category.name}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryList;
