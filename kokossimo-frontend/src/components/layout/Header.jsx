import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronDown, LayoutGrid } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [isContactsMenuOpen, setIsContactsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { getTotalItems } = useCart();
  const { getFavoritesCount } = useFavorites();
  const searchRef = useRef(null);
  const searchBtnRef = useRef(null);
  const clientMenuRef = useRef(null);
  const contactsMenuRef = useRef(null);

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

  useEffect(() => {
    if (!isSearchOpen) return;

    const handleOutsideClick = (event) => {
      const searchEl = searchRef.current;
      const buttonEl = searchBtnRef.current;

      if (searchEl?.contains(event.target) || buttonEl?.contains(event.target)) {
        return;
      }

      setIsSearchOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isClientMenuOpen) return;

    const handleOutsideClick = (event) => {
      const menuEl = clientMenuRef.current;
      if (menuEl?.contains(event.target)) return;
      setIsClientMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isClientMenuOpen]);

  useEffect(() => {
    if (!isContactsMenuOpen) return;

    const handleOutsideClick = (event) => {
      const menuEl = contactsMenuRef.current;
      if (menuEl?.contains(event.target)) return;
      setIsContactsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isContactsMenuOpen]);

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header__container">
        <div className="header__left">
          <Link to="/" className="header__logo header__logo--full">
            KOKÓССИМО!
          </Link>
          <Link to="/catalog" className="header__catalog" onClick={() => setIsMenuOpen(false)}>
            <LayoutGrid size={18} />
            <span>Каталог</span>
          </Link>
          <button
            type="button"
            className="header__search-btn"
            aria-label="Поиск"
            ref={searchBtnRef}
            onClick={() => setIsSearchOpen((prev) => !prev)}
          >
            <Search size={20} />
          </button>
        </div>

        <div className="header__logo-center">
          <Link to="/" className="header__logo header__logo--short">
            K
          </Link>
        </div>

        <div
          className={`header__search ${isSearchOpen ? 'is-open' : ''}`}
          ref={searchRef}
        >
          <Search size={18} />
          <input type="text" placeholder="" aria-label="Поиск" />
        </div>

        <div className="header__right">
          <nav className={`header__nav ${isMenuOpen ? 'active' : ''}`}>
            <div className="header__dropdown" ref={contactsMenuRef}>
              <button
                type="button"
                className="header__link header__dropdown-toggle header__dropdown-toggle--light"
                onClick={() => setIsContactsMenuOpen((prev) => !prev)}
                aria-expanded={isContactsMenuOpen}
                aria-haspopup="true"
              >
                Контакты <ChevronDown size={16} />
              </button>
              <div className={`header__dropdown-menu ${isContactsMenuOpen ? 'is-open' : ''}`}>
                <Link
                  to="/about"
                  className="header__dropdown-item"
                  onClick={() => setIsContactsMenuOpen(false)}
                >
                  О нас
                </Link>
                <Link
                  to="/contacts"
                  className="header__dropdown-item"
                  onClick={() => setIsContactsMenuOpen(false)}
                >
                  Контакты
                </Link>
              </div>
            </div>
            <div className="header__dropdown" ref={clientMenuRef}>
              <button
                type="button"
                className="header__link header__dropdown-toggle header__dropdown-toggle--light"
                onClick={() => setIsClientMenuOpen((prev) => !prev)}
                aria-expanded={isClientMenuOpen}
                aria-haspopup="true"
              >
                Клиентам <ChevronDown size={16} />
              </button>
              <div className={`header__dropdown-menu ${isClientMenuOpen ? 'is-open' : ''}`}>
                <Link
                  to="/delivery"
                  className="header__dropdown-item"
                  onClick={() => setIsClientMenuOpen(false)}
                >
                  Доставка
                </Link>
                <Link
                  to="/certificates"
                  className="header__dropdown-item"
                  onClick={() => setIsClientMenuOpen(false)}
                >
                  Сертификаты
                </Link>
              </div>
            </div>
          </nav>

          <div className="header__actions">
            <Link to="/cart" className="header__icon-btn cart-btn">
              <ShoppingCart size={22} />
              {getTotalItems() > 0 && (
                <span className="cart-badge">{getTotalItems()}</span>
              )}
            </Link>
            <Link to="/favorites" className="header__icon-btn header__icon-btn--favorites cart-btn">
              <Heart size={22} />
              {getFavoritesCount() > 0 && (
                <span className="cart-badge">{getFavoritesCount()}</span>
              )}
            </Link>
            <Link to="/profile" className="header__icon-btn">
              <User size={22} />
            </Link>
          </div>

          <button className="header__menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
