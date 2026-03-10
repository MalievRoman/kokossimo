import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProductSubcategoriesTree, getProducts } from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';

// Блок "КАТАЛОГ" на главной: актуальные категории из дерева подкатегорий (parent 1–6).
// Ссылки ведут в каталог с фильтром ?parent=X.

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [categoryImages, setCategoryImages] = useState({});

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

  useEffect(() => {
    if (categories.length === 0) return;
    let isActive = true;

    const loadCategoryImages = async () => {
      const entries = await Promise.all(
        categories.map(async (item) => {
          try {
            const response = await getProducts({
              parent: [item.code],
              page_size: 1,
            });
            const data = Array.isArray(response.data)
              ? response.data
              : response.data?.results || [];
            const productWithImage = data.find((p) => p.image);
            const imageUrl = productWithImage?.image
              ? resolveMediaUrl(productWithImage.image)
              : '';
            return [item.code, imageUrl];
          } catch {
            return [item.code, ''];
          }
        })
      );

      if (!isActive) return;
      const nextImages = {};
      entries.forEach(([code, url]) => {
        if (url) nextImages[code] = url;
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
          {categories.map((item) => {
            const imageUrl =
              categoryImages[item.code] ||
              `${import.meta.env.BASE_URL}assets/beauty_elements.png`;

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
