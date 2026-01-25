import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';

// Слайдер товаров под верстку блоков
// "БЕСТСЕЛЛЕРЫ" и "НОВИНКИ" из main_page.html.
// Работает с реальными товарами из бэкенда через ProductCard.

const ProductSlider = ({ title, products, linkTo = "/catalog" }) => {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScrollState = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 0);
  };

  useEffect(() => {
    updateScrollState();
  }, [products]);

  const scrollByStep = (direction) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const firstCard = scroller.querySelector('.product-card');
    const gap = 16; // из CSS: gap: 16px

    const step = firstCard
      ? firstCard.offsetWidth + gap
      : scroller.clientWidth * 0.8;

    scroller.scrollBy({
      left: direction * step,
      behavior: 'smooth',
    });

    requestAnimationFrame(updateScrollState);
  };

  const hasProducts = Array.isArray(products) && products.length > 0;

  return (
    <section className="bestsellers block">
      <div className="container">
        <div className="bestsellers__top">
          <h2 className="bestsellers__title">
            <Link to={linkTo} className="bestsellers__title-link">
              <span>{title}</span>
              <svg
                className="bestsellers__title-icon"
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

          <Link to={linkTo} className="bestsellers__all">
            <span>БОЛЬШЕ</span>
            <svg
              className="bestsellers__all-icon"
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

        <div className="bestsellers__scroller-wrap">
          <button
            type="button"
            aria-label="Назад"
            onClick={() => scrollByStep(-1)}
            aria-hidden={!canScrollLeft}
            className={`bestsellers__arrow bestsellers__arrow--prev ${canScrollLeft ? '' : 'is-hidden'}`}
          />

          <div
            className="bestsellers__scroller"
            ref={scrollerRef}
            onScroll={updateScrollState}
          >
            {hasProducts &&
              products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
          </div>

          <button
            className="bestsellers__arrow bestsellers__arrow--next"
            type="button"
            aria-label="Вперёд"
            onClick={() => scrollByStep(1)}
          />
        </div>
      </div>
    </section>
  );
};

export default ProductSlider;
