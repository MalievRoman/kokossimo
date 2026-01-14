import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { getTotalItems } = useCart();
  const { getFavoritesCount } = useFavorites();

  // Отслеживаем скролл для эффекта прозрачности/тени
  useEffect(() => {
    const handleScroll = () => {
      // Если прокрутили больше 20px, считаем что скролл начался
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // Очистка слушателя при удалении компонента
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header__container">
        {/* Логотип */}
        <Link to="/" className="header__logo">
          KOKÓSSIMO
          <span className="header__year">2025</span>
        </Link>

        {/* Навигация */}
        <nav className={`header__nav ${isMenuOpen ? 'active' : ''}`}>
          <Link to="/catalog" className="header__link" onClick={() => setIsMenuOpen(false)}>Каталог</Link>
          <Link to="/about" className="header__link" onClick={() => setIsMenuOpen(false)}>О нас</Link>
          <Link to="/delivery" className="header__link" onClick={() => setIsMenuOpen(false)}>Доставка</Link>
            <Link to="/certificates" className="header__link header__link--highlight" onClick={() => setIsMenuOpen(false)}>Сертификаты</Link>
          
          {/* Поиск внутри мобильного меню (или можно скрыть на десктопе через CSS) */}
          <div className="header__search">
            <input type="text" placeholder="Поиск товаров..." />
            <button><Search size={18} /></button>
          </div>
        </nav>

        {/* Иконки справа */}
        <div className="header__actions">
          <Link to="/favorites" className="header__icon-btn cart-btn">
            <Heart size={24} />
            {getFavoritesCount() > 0 && (
              <span className="cart-badge">{getFavoritesCount()}</span>
            )}
          </Link>
          <Link to="/cart" className="header__icon-btn cart-btn">
            <ShoppingCart size={24} />
            {getTotalItems() > 0 && (
              <span className="cart-badge">{getTotalItems()}</span>
            )}
          </Link>
          <Link to="/profile" className="header__icon-btn">
            <User size={24} />
          </Link>
          
          {/* Кнопка меню для мобильных */}
          <button className="header__menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
