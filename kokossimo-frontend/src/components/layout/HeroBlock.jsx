import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HeroBlock.css';
import heroImage1 from '../../assets/hero/hero_background_1.png';
import heroImage2 from '../../assets/hero/hero_background_2.png';
import heroImage3 from '../../assets/hero/hero_background_3.png';

// --- ВОТ ЗДЕСЬ НАЧИНАЕТСЯ МАССИВ СЛАЙДОВ (ШАГ 1) ---
const slides = [
  {
    id: 1,
    title: "СКИДКИ ДО 30%!\nУСПЕЙТЕ КУПИТЬ ЛЮБИМЫЕ\nТОВАРЫ ПО ВЫГОДНЫМ ЦЕНАМ!",
    buttonText: "СМОТРЕТЬ",
    link: "/catalog", // Ведет в каталог
    image: heroImage1,
  },
  {
    id: 2,
    title: "НОВАЯ КОЛЛЕКЦИЯ\nУХОД ЗА ЛИЦОМ\nУЖЕ В ПРОДАЖЕ!",
    buttonText: "В КАТАЛОГ",
    link: "/catalog", // Тоже ведет в каталог (было /catalog/face-care)
    image: heroImage2,
  },
  {
    id: 3,
    title: "БЕСПЛАТНАЯ ДОСТАВКА\nПРИ ЗАКАЗЕ ОТ 5000 ₽\nПО ВСЕЙ РОССИИ",
    buttonText: "ПОДРОБНЕЕ",
    link: "/catalog", // И это тоже в каталог (было /delivery)
    image: heroImage3,
  }
];

// --- КОНЕЦ МАССИВА СЛАЙДОВ ---

const HeroBlock = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const nextSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToSlide = (index) => {
    if (index === currentSlide || isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
    setCurrentSlide(index);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaY) > 60) return;
    if (deltaX > 0) {
      prevSlide();
    } else {
      nextSlide();
    }
  };

  return (
    <section className="hero" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="hero__track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="hero__slide"
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className="container hero__container">
              <div className="hero__content">
                <h1 className="hero__title">
                  {slide.title.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </h1>
                <Link to={slide.link} className="hero__btn">
                  {slide.buttonText}
                </Link>
                <div className="hero__controls">
                  <button className="slider-btn prev" onClick={prevSlide}>
                    <ChevronLeft size={24} />
                  </button>
                  <button className="slider-btn next" onClick={nextSlide}>
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hero__dots">
        {slides.map((_, index) => (
          <span 
            key={index} 
            className={`dot ${index === currentSlide ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
          ></span>
        ))}
      </div>
    </section>
  );
};

export default HeroBlock;
