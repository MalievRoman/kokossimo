import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HeroBlock.css';

// --- ВОТ ЗДЕСЬ НАЧИНАЕТСЯ МАССИВ СЛАЙДОВ (ШАГ 1) ---
const slides = [
  {
    id: 1,
    title: "СКИДКИ ДО 30%!\nУСПЕЙТЕ КУПИТЬ ЛЮБИМЫЕ\nТОВАРЫ ПО ВЫГОДНЫМ ЦЕНАМ!",
    buttonText: "СМОТРЕТЬ",
    link: "/catalog", // Ведет в каталог
    imagePlaceholder: "IMG 1" 
  },
  {
    id: 2,
    title: "НОВАЯ КОЛЛЕКЦИЯ\nУХОД ЗА ЛИЦОМ\nУЖЕ В ПРОДАЖЕ!",
    buttonText: "В КАТАЛОГ",
    link: "/catalog", // Тоже ведет в каталог (было /catalog/face-care)
    imagePlaceholder: "IMG 2"
  },
  {
    id: 3,
    title: "БЕСПЛАТНАЯ ДОСТАВКА\nПРИ ЗАКАЗЕ ОТ 5000 ₽\nПО ВСЕЙ РОССИИ",
    buttonText: "ПОДРОБНЕЕ",
    link: "/catalog", // И это тоже в каталог (было /delivery)
    imagePlaceholder: "IMG 3" 
  }
];

// --- КОНЕЦ МАССИВА СЛАЙДОВ ---

const HeroBlock = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState('next');

  const nextSlide = () => {
    if (isAnimating) return;
    setSlideDirection('next');
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    if (isAnimating) return;
    setSlideDirection('prev');
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToSlide = (index) => {
    if (index === currentSlide || isAnimating) return;
    setSlideDirection(index > currentSlide ? 'next' : 'prev');
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
    setCurrentSlide(index);
  };

  // Получаем текущий слайд из массива
  const slide = slides[currentSlide];

  return (
    <section className="hero">
      <div className={`container hero__container ${isAnimating ? 'fade-out' : 'fade-in'}`}>
        
        <div className="hero__content">
          <h1 className="hero__title">
            {/* Разбиваем текст по переносу строки \n */}
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
        
        <div className="hero__image-wrapper">
          <div
            className={`hero__image-placeholder ${isAnimating ? `slide-${slideDirection}` : ''}`}
          >
             {slide.imagePlaceholder}
          </div>
        </div>
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
