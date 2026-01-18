import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronDown, LayoutGrid } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getProducts } from '../../services/api';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [isContactsMenuOpen, setIsContactsMenuOpen] = useState(false);
  const [isContactsMobileMenuOpen, setIsContactsMobileMenuOpen] = useState(false);
  const [isClientMobileMenuOpen, setIsClientMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { getTotalItems } = useCart();
  const { getFavoritesCount } = useFavorites();
  const searchRef = useRef(null);
  const searchBtnRef = useRef(null);
  const searchResultsRef = useRef(null);
  const clientMenuRef = useRef(null);
  const contactsMenuRef = useRef(null);
  const contactsMobileMenuRef = useRef(null);
  const clientMobileMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const navigate = useNavigate();

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const levenshtein = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  const getSimilarity = (query, text) => {
    if (!query || !text) return 0;
    if (text.includes(query)) return 1;
    const distance = levenshtein(query, text);
    return 1 - distance / Math.max(query.length, text.length);
  };

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
      const resultsEl = searchResultsRef.current;

      if (resultsEl?.contains(event.target)) {
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

  useEffect(() => {
    if (!isContactsMobileMenuOpen) return;

    const handleOutsideClick = (event) => {
      const menuEl = contactsMobileMenuRef.current;
      if (menuEl?.contains(event.target)) return;
      setIsContactsMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isContactsMobileMenuOpen]);

  useEffect(() => {
    if (!isClientMobileMenuOpen) return;

    const handleOutsideClick = (event) => {
      const menuEl = clientMobileMenuRef.current;
      if (menuEl?.contains(event.target)) return;
      setIsClientMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isClientMobileMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (mobileMenuRef.current?.contains(event.target)) return;
      if (mobileMenuButtonRef.current?.contains(event.target)) return;
      setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  useEffect(() => {
    if ((!isSearchOpen && !searchQuery) || allProducts.length > 0) return;

    setIsSearching(true);
    getProducts()
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setAllProducts(data);
      })
      .catch(() => {
        setAllProducts([]);
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [isSearchOpen, allProducts.length]);

  useEffect(() => {
    const query = normalizeText(searchQuery);
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    const results = allProducts
      .map((product) => {
        const name = normalizeText(product.name || '');
        const score = getSimilarity(query, name);
        return { product, score };
      })
      .filter(({ score, product }) => score >= 0.35 || normalizeText(product.name || '').includes(query))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ product }) => product);

    setSearchResults(results);
  }, [searchQuery, allProducts]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/catalog?q=${encodeURIComponent(query)}`);
    setIsSearchOpen(false);
  };

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container header__container">
        <div className="header__left">
          <Link to="/" className="header__logo header__logo--full">
            KOKÓССИМО!
          </Link>
          <Link to="/catalog" className="header__catalog header__catalog--desktop" onClick={() => setIsMenuOpen(false)}>
            <LayoutGrid size={18} />
            <span>Каталог</span>
          </Link>
          <button
            type="button"
            className="header__catalog header__catalog--mobile"
            ref={mobileMenuButtonRef}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
          >
            <LayoutGrid size={18} />
          </button>
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

        <form
          className={`header__search ${isSearchOpen ? 'is-open' : ''}`}
          ref={searchRef}
          onSubmit={handleSearchSubmit}
        >
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск"
            aria-label="Поиск"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          {searchQuery && isSearchOpen && (
            <div className="header__search-results" ref={searchResultsRef}>
              {isSearching && (
                <div className="header__search-empty">Поиск...</div>
              )}
              {!isSearching && searchResults.length === 0 && (
                <div className="header__search-empty">Ничего не найдено</div>
              )}
              {!isSearching && searchResults.length > 0 && (
                <>
                  {searchResults.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      className="header__search-item"
                      onClick={() => {
                        navigate(`/product/${product.id}`);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      {product.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="header__search-item header__search-all"
                    onClick={() => {
                      navigate(`/catalog?q=${encodeURIComponent(searchQuery)}`);
                      setIsSearchOpen(false);
                    }}
                  >
                    Все результаты
                  </button>
                </>
              )}
            </div>
          )}
        </form>

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
      <div className={`header__mobile-menu ${isMenuOpen ? 'is-open' : ''}`} ref={mobileMenuRef}>
        <nav className="header__mobile-menu-list">
          <Link to="/catalog" onClick={() => setIsMenuOpen(false)}>
            Каталог
          </Link>
          <div className="header__mobile-dropdown" ref={contactsMobileMenuRef}>
            <button
              type="button"
              className="header__mobile-toggle"
              onClick={() => setIsContactsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isContactsMobileMenuOpen}
              aria-haspopup="true"
            >
              Контакты <ChevronDown size={16} />
            </button>
            <div className={`header__dropdown-menu ${isContactsMobileMenuOpen ? 'is-open' : ''}`}>
              <Link to="/about" className="header__dropdown-item" onClick={() => setIsMenuOpen(false)}>
                О нас
              </Link>
              <Link to="/contacts" className="header__dropdown-item" onClick={() => setIsMenuOpen(false)}>
                Контакты
              </Link>
            </div>
          </div>
          <div className="header__mobile-dropdown" ref={clientMobileMenuRef}>
            <button
              type="button"
              className="header__mobile-toggle"
              onClick={() => setIsClientMobileMenuOpen((prev) => !prev)}
              aria-expanded={isClientMobileMenuOpen}
              aria-haspopup="true"
            >
              Клиентам <ChevronDown size={16} />
            </button>
            <div className={`header__dropdown-menu ${isClientMobileMenuOpen ? 'is-open' : ''}`}>
              <Link to="/delivery" className="header__dropdown-item" onClick={() => setIsMenuOpen(false)}>
                Доставка
              </Link>
              <Link to="/certificates" className="header__dropdown-item" onClick={() => setIsMenuOpen(false)}>
                Сертификаты
              </Link>
            </div>
          </div>
          <Link to="/cart" onClick={() => setIsMenuOpen(false)}>
            Корзина
          </Link>
          <Link to="/favorites" onClick={() => setIsMenuOpen(false)}>
            Избранное
          </Link>
          <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
            Профиль
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
