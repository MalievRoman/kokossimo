import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import ProductCard from './ProductCard';
import './ProductSlider.css';

const ProductSlider = ({ title, products, linkText = "БОЛЬШЕ", linkTo = "/catalog" }) => {
  const sliderRef = useRef(null);
  const wrapperRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const slider = sliderRef.current;
    const wrapper = wrapperRef.current;
    
    if (!slider || !wrapper) return;

    let lastTimestamp = 0;
    const scrollSpeed = 0.5; // Скорость обычной прокрутки
    const rewindSpeed = 2;   // Скорость возврата назад (побыстрее)
    let scrollForward = true; // Направление движения

    const autoScroll = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;

      if (!isHoveredRef.current && delta > 16) {
        const currentScroll = slider.scrollLeft;
        const maxScroll = slider.scrollWidth - slider.clientWidth;

        if (scrollForward) {
          // Едем вперед
          if (currentScroll >= maxScroll - 1) {
            scrollForward = false; // Меняем направление
          } else {
            slider.scrollLeft += scrollSpeed;
          }
        } else {
          // Едем назад (возвращаемся в начало)
          if (currentScroll <= 0) {
            scrollForward = true; // Снова вперед
          } else {
            slider.scrollLeft -= rewindSpeed;
          }
        }

        lastTimestamp = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(autoScroll);
    };

    animationFrameRef.current = requestAnimationFrame(autoScroll);

    const handleMouseEnter = () => { isHoveredRef.current = true; };
    const handleMouseLeave = () => { 
      isHoveredRef.current = false; 
      lastTimestamp = 0; 
    };

    wrapper.addEventListener('mouseenter', handleMouseEnter);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      wrapper.removeEventListener('mouseenter', handleMouseEnter);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleScrollLeft = () => {
    sliderRef.current?.scrollBy({ left: -1550, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    sliderRef.current?.scrollBy({ left: 350, behavior: 'smooth' });
  };

  return (
    <section className="product-slider">
      <div className="container">
        <div className="product-slider__header">
          <h2 className="section-title">{title}</h2>
          <Link to={linkTo} className="section-link">
            {linkText} <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="product-slider__wrapper" ref={wrapperRef}>
          <button className="slider-control left" onClick={handleScrollLeft}>
            <ChevronLeft size={24} />
          </button>
          
          <div className="product-slider__grid" ref={sliderRef}>
            {products && products.length > 0 && products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          
          <button className="slider-control right" onClick={handleScrollRight}>
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductSlider;
