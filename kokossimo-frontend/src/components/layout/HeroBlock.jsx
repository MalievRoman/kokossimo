import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Версия hero-блока под верстку из main_page.html (koko_website)
// Фоновые слайды берём из публичных ассетов, вся разметка и классы
// совпадают с оригинальной HTML-версией.

const slides = [
  { id: 0, image: `${import.meta.env.BASE_URL}assets/hero_background_1.png` },
  { id: 1, image: `${import.meta.env.BASE_URL}assets/hero_background_2.png` },
  { id: 2, image: `${import.meta.env.BASE_URL}assets/hero_background_3.png` },
];

const AUTO_PLAY_INTERVAL = 8000; // мс

const HeroBlock = () => {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef(null);
  const autoplayRef = useRef(null);
  const isPointerDownRef = useRef(false);

  const scrollToSlide = (index, withBehavior = 'smooth') => {
    const track = trackRef.current;
    if (!track) return;

    const safeIndex = ((index % slides.length) + slides.length) % slides.length;
    const width = track.clientWidth;
    track.scrollTo({
      left: safeIndex * width,
      behavior: withBehavior,
    });
    setCurrent(safeIndex);
  };

  const nextSlide = () => scrollToSlide(current + 1);
  const prevSlide = () => scrollToSlide(current - 1);

  // Автопрокрутка
  useEffect(() => {
    const startAutoplay = () => {
      if (autoplayRef.current) return;
      autoplayRef.current = window.setInterval(() => {
        if (isPointerDownRef.current) return;
        nextSlide();
      }, AUTO_PLAY_INTERVAL);
    };

    const stopAutoplay = () => {
      if (autoplayRef.current) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };

    startAutoplay();

    return () => {
      stopAutoplay();
    };
  }, [current]);

  // Синхронизация current при ручном скролле (свайпы/колёсико)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;

    const handleScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        const index = Math.round(track.scrollLeft / width);
        const safeIndex = ((index % slides.length) + slides.length) % slides.length;
        if (safeIndex !== current) {
          setCurrent(safeIndex);
        }
      });
    };

    track.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      track.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(raf);
    };
  }, [current]);

  // Обработчики pointer для паузы автоплея на drag
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleDown = () => {
      isPointerDownRef.current = true;
    };
    const handleUp = () => {
      isPointerDownRef.current = false;
    };

    track.addEventListener('pointerdown', handleDown, { passive: true });
    track.addEventListener('pointerup', handleUp, { passive: true });
    track.addEventListener('pointercancel', handleUp, { passive: true });
    track.addEventListener('mouseleave', handleUp, { passive: true });

    return () => {
      track.removeEventListener('pointerdown', handleDown);
      track.removeEventListener('pointerup', handleUp);
      track.removeEventListener('pointercancel', handleUp);
      track.removeEventListener('mouseleave', handleUp);
    };
  }, []);

  const handleDotClick = (index) => {
    scrollToSlide(index);
  };

  return (
    <section className="hero" aria-label="Главный баннер">
      <div className="hero__slides" ref={trackRef}>
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="hero__slide"
            style={{ backgroundImage: `url('${slide.image}')` }}
          />
        ))}
      </div>

      <div className="container hero__inner">
        <div className="hero__content">
          <h1 className="hero__title">
            СКИДКИ ДО 30%! УСПЕЙТЕ КУПИТЬ ЛЮБИМЫЕ<br />
            ТОВАРЫ ПО ВЫГОДНЫМ ЦЕНАМ!
          </h1>
          <Link className="hero__btn" to="/catalog">
            СМОТРЕТЬ
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
