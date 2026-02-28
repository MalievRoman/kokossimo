import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Версия hero-блока под верстку из main_page.html (koko_website)
// Фоновые слайды берём из публичных ассетов, вся разметка и классы
// совпадают с оригинальной HTML-версией.

const heroCatalogDesktop = new URL('../../assets/hero/hero_catalog_desktop.jpg', import.meta.url).href;
const heroCatalogMobile = new URL('../../assets/hero/hero_catalog_mobile.jpg', import.meta.url).href;
const heroCertificateDesktop = new URL(
  '../../assets/hero/hero_certificate_desktop.jpg',
  import.meta.url
).href;
const heroCertificateMobile = new URL(
  '../../assets/hero/hero_certificate_mobile.jpg',
  import.meta.url
).href;

const slides = [
  {
    id: 0,
    desktop: heroCatalogDesktop,
    mobile: heroCatalogMobile,
    title: (
      <>
        ИССЛЕДУЙ МИР КРАСОТЫ
        <br />
        С НАМИ
      </>
    ),
    buttonText: 'ПЕРЕЙТИ К ТОВАРАМ',
    buttonLink: '/catalog',
  },
  {
    id: 1,
    desktop: heroCertificateDesktop,
    mobile: heroCertificateMobile,
    title: 'ТВОЙ ИДЕАЛЬНЫЙ ПОДАРОК ЗДЕСЬ',
    buttonText: 'КУПИТЬ СЕРТИФИКАТ',
    buttonLink: '/certificates',
  },
];

const AUTO_PLAY_INTERVAL = 8000; // мс

const HeroBlock = () => {
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const autoplayRef = useRef(null);
  const isPausedRef = useRef(false);
  const touchStartXRef = useRef(null);
  const currentSlide = slides[current];

  const goToSlide = useCallback((index) => {
    const safeIndex = ((index % slides.length) + slides.length) % slides.length;
    setCurrent(safeIndex);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  // Автопрокрутка без пересоздания таймера на каждый слайд
  useEffect(() => {
    autoplayRef.current = window.setInterval(() => {
      if (isPausedRef.current) return;
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTO_PLAY_INTERVAL);

    return () => {
      if (autoplayRef.current) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };
  }, []);

  const handleDotClick = (index) => {
    goToSlide(index);
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null;
    isPausedRef.current = true;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    touchStartXRef.current = null;
    isPausedRef.current = false;

    if (startX == null || endX == null) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;

    if (deltaX < 0) nextSlide();
    else prevSlide();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = (event) => setIsMobile(event.matches);
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <section
      className="hero"
      aria-label="Главный баннер"
      onMouseEnter={() => {
        isPausedRef.current = true;
      }}
      onMouseLeave={() => {
        isPausedRef.current = false;
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero__slides">
        <div className="hero__track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="hero__slide"
              style={{ backgroundImage: `url('${isMobile ? slide.mobile : slide.desktop}')` }}
            />
          ))}
        </div>
      </div>

      <div className="container hero__inner">
        <div className="hero__content">
          <h1 className="hero__title">{currentSlide.title}</h1>
          <Link className="hero__btn" to={currentSlide.buttonLink}>
            {currentSlide.buttonText}
          </Link>
        </div>

        <div className="hero__arrows" aria-label="Стрелки">
          <button
            className="hero__arrow hero__arrow--prev"
            type="button"
            aria-label="Предыдущий"
            onClick={prevSlide}
          />
          <button
            className="hero__arrow hero__arrow--next"
            type="button"
            aria-label="Следующий"
            onClick={nextSlide}
          />
        </div>

        <div className="hero__dots" aria-label="Точки">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              className={`hero__dot ${index === current ? 'is-active' : ''}`}
              type="button"
              aria-label={`Слайд ${index + 1}`}
              onClick={() => handleDotClick(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroBlock;
