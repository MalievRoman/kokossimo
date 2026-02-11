import React, { useState, useRef, useEffect } from 'react';
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
  const trackRef = useRef(null);
  const autoplayRef = useRef(null);
  const isPointerDownRef = useRef(false);
  const currentSlide = slides[current];

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
    const stopAutoplay = () => {
      if (autoplayRef.current) {
        window.clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };

    autoplayRef.current = window.setInterval(() => {
      if (isPointerDownRef.current) return;
      setCurrent((prev) => {
        const next = ((prev + 1) % slides.length + slides.length) % slides.length;
        const track = trackRef.current;
        if (track) {
          const width = track.clientWidth;
          track.scrollTo({ left: next * width, behavior: 'smooth' });
        }
        return next;
      });
    }, AUTO_PLAY_INTERVAL);

    return () => {
      stopAutoplay();
    };
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = (event) => setIsMobile(event.matches);
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <section className="hero" aria-label="Главный баннер">
      <div className="hero__slides" ref={trackRef}>
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="hero__slide"
            style={{ backgroundImage: `url('${isMobile ? slide.mobile : slide.desktop}')` }}
          />
        ))}
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
