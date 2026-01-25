import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getProducts } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mobileDropdown, setMobileDropdown] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const allProductsRef = useRef([]);
  const suggestionsTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { getTotalItems } = useCart();
  const { getFavoritesCount } = useFavorites();
  const cartCount = getTotalItems();
  const favoritesCount = getFavoritesCount();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get('q') || '');
    setSuggestions([]);
    setIsSuggestionsOpen(false);
  }, [location.search]);

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const loadAllProducts = async () => {
    if (allProductsRef.current.length > 0) return allProductsRef.current;
    const response = await getProducts({ page_size: 1000 });
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.results || [];
    allProductsRef.current = data;
    return data;
  };

  useEffect(() => {
    if (suggestionsTimerRef.current) {
      clearTimeout(suggestionsTimerRef.current);
    }

    const rawQuery = searchValue.trim();
    if (!rawQuery) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return undefined;
    }

    suggestionsTimerRef.current = setTimeout(async () => {
      try {
        const query = normalizeText(rawQuery);
        const products = await loadAllProducts();
        const results = products
          .filter((item) => normalizeText(item.name || '').includes(query))
          .slice(0, 6);
        setSuggestions(results);
        setIsSuggestionsOpen(true);
      } catch {
        setSuggestions([]);
        setIsSuggestionsOpen(false);
      }
    }, 200);

    return () => {
      if (suggestionsTimerRef.current) {
        clearTimeout(suggestionsTimerRef.current);
      }
    };
  }, [searchValue]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchValue.trim();

    if (query) {
      navigate(`/catalog?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/catalog');
    }

    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
    setIsSuggestionsOpen(false);
  };

  const openMobileMenu = () => {
    setIsMobileMenuOpen(true);
    setIsMobileSearchOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setMobileDropdown(null);
  };

  const openMobileSearch = () => {
    setIsMobileSearchOpen(true);
    setIsMobileMenuOpen(false);
  };

  const closeMobileSearch = () => {
    setIsMobileSearchOpen(false);
  };

  const toggleMobileDropdown = (key) => {
    setMobileDropdown((prev) => (prev === key ? null : key));
  };

  const handleSuggestionClick = () => {
    setIsSuggestionsOpen(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  return (
  <>
    <header className="header">
        <div className="container">
          <div className="header__inner">

        
            <div className="header__desktop">
              <Link className="header__logo" to="/" aria-label="KOKOSSIMO">
                <img src="/assets/logo.svg" alt="KOKOSSIMO" />
              </Link>

              <Link className="header__catalog" to="/catalog">
                <span className="icon icon--catalog" aria-hidden="true"></span>
                <span className="header__catalog-text">КАТАЛОГ</span>
              </Link>

              <Link className="header__cert" to="/certificates">СЕРТИФИКАТЫ</Link>

              <form className="header__search" role="search" onSubmit={handleSearchSubmit}>
                <button className="header__search-btn" type="submit" aria-label="Поиск">
                  <span className="header__search-icon icon icon--search" aria-hidden="true"></span>
                </button>
                <input
                  className="header__search-input"
                  type="search"
                  name="q"
                  placeholder=""
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onFocus={() => searchValue.trim() && setIsSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setIsSuggestionsOpen(false), 150)}
                />
                {!isMobileSearchOpen && isSuggestionsOpen && suggestions.length > 0 && (
                  <div className="header__search-suggestions" role="listbox">
                    {suggestions.map((item) => (
                      <Link
                        key={item.id}
                        to={`/product/${item.id}`}
                        className="header__search-suggestion"
                        onClick={handleSuggestionClick}
                        role="option"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </form>

              
              <nav className="header__nav" aria-label="Навигация">
                <div className="header__dropdown header__dropdown--customers">
                  <button className="header__dropdown-btn" type="button">
                    <span className="header__dropdown-text">КЛИЕНТАМ</span>
                    <span className="header__dropdown-icon" aria-hidden="true">
                      <svg
                        className="header__dropdown-chevron"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M4 6l4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <div className="header__dropdown-menu">
                    <Link className="header__dropdown-link" to="/delivery">
                      Доставка и оплата
                    </Link>
                    <Link className="header__dropdown-link" to="/about">
                      О компании
                    </Link>
                  </div>
                </div>

                <Link className="header__dropdown-btn header__dropdown-btn--spaced" to="/contacts">
                  <span className="header__dropdown-text">КОНТАКТЫ</span>
                </Link>
              </nav>



              <div className="header__actions" aria-label="Действия">
                <Link className="header__icon-btn" to="/cart" aria-label="Корзина">
                  <span className="icon icon--cart" aria-hidden="true"></span>
                  {cartCount > 0 && <span className="header__icon-badge">{cartCount}</span>}
                </Link>
                <Link className="header__icon-btn" to="/favorites" aria-label="Избранное">
                  <span className="icon icon--fav" aria-hidden="true"></span>
                  {favoritesCount > 0 && (
                    <span className="header__icon-badge">{favoritesCount}</span>
                  )}
                </Link>
                <Link className="header__icon-btn" to="/profile" aria-label="Профиль">
                  <span className="icon icon--profile" aria-hidden="true"></span>
                </Link>
              </div>
            </div>

        
            <div className="header__mobile" aria-label="Мобильная шапка">
              <div className="header__mobile-left">
                <button
                  className="header__icon-btn"
                  type="button"
                  aria-label="Открыть меню"
                  aria-controls="mobile-menu"
                  aria-expanded={isMobileMenuOpen}
                  onClick={openMobileMenu}
                >
                  <span className="icon icon--catalog" aria-hidden="true"></span>
                </button>

                <button
                  className="header__icon-btn"
                  type="button"
                  aria-label="Открыть поиск"
                  aria-controls="mobile-search"
                  aria-expanded={isMobileSearchOpen}
                  onClick={openMobileSearch}
                >
                  <span className="icon icon--search" aria-hidden="true"></span>
                </button>
              </div>

              <a className="header__logo-mobile" href="./" aria-label="KOKOSSIMO">
                <img src="/assets/logo_shot.svg" alt="KOKOSSIMO" />
              </a>

              <div className="header__mobile-right">
                <Link className="header__icon-btn" to="/cart" aria-label="Корзина">
                  <span className="icon icon--cart" aria-hidden="true"></span>
                  {cartCount > 0 && <span className="header__icon-badge">{cartCount}</span>}
                </Link>
                <Link className="header__icon-btn" to="/profile" aria-label="Профиль">
                  <span className="icon icon--profile" aria-hidden="true"></span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </header>
    <div
      className={`mobile-search ${isMobileSearchOpen ? 'is-open' : ''}`}
      id="mobile-search"
      aria-hidden={isMobileSearchOpen ? 'false' : 'true'}
    >
        <div className="container">
          <form className="mobile-search__form" role="search" onSubmit={handleSearchSubmit}>
            <button className="header__search-btn" type="submit" aria-label="Поиск">
              <span className="icon icon--search" aria-hidden="true"></span>
            </button>
            <input
              className="mobile-search__input"
              type="search"
              name="q"
              placeholder=""
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => searchValue.trim() && setIsSuggestionsOpen(true)}
              onBlur={() => setTimeout(() => setIsSuggestionsOpen(false), 150)}
            />
            <button
              className="mobile-search__close"
              type="button"
              aria-label="Закрыть"
              onClick={closeMobileSearch}
            >
              ×
            </button>
            {isMobileSearchOpen && isSuggestionsOpen && suggestions.length > 0 && (
              <div className="header__search-suggestions header__search-suggestions--mobile" role="listbox">
                {suggestions.map((item) => (
                  <Link
                    key={item.id}
                    to={`/product/${item.id}`}
                    className="header__search-suggestion"
                    onClick={handleSuggestionClick}
                    role="option"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

  
  
    <div
      className={`mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`}
      id="mobile-menu"
      aria-hidden={isMobileMenuOpen ? 'false' : 'true'}
    >
        <button
          className="mobile-menu__overlay"
          type="button"
          aria-label="Закрыть"
          onClick={closeMobileMenu}
        ></button>
        <aside className="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Меню">
          <button
            className="mobile-menu__close"
            type="button"
            aria-label="Закрыть"
            onClick={closeMobileMenu}
          >
            ×
          </button>

          <nav className="mobile-menu__nav">
            <Link to="/catalog" onClick={closeMobileMenu}>КАТАЛОГ</Link>

            <div className="mobile-menu__group">
              <button
                className={`mobile-menu__toggle ${mobileDropdown === 'contacts' ? 'is-open' : ''}`}
                type="button"
                onClick={() => toggleMobileDropdown('contacts')}
                aria-expanded={mobileDropdown === 'contacts'}
              >
                <span>КОНТАКТЫ</span>
                <span className="mobile-menu__chevron" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              <div className={`mobile-menu__submenu ${mobileDropdown === 'contacts' ? 'is-open' : ''}`}>
                <Link to="/about" onClick={closeMobileMenu}>О НАС</Link>
                <Link to="/contacts" onClick={closeMobileMenu}>КОНТАКТЫ</Link>
              </div>
            </div>

            <div className="mobile-menu__group">
              <button
                className={`mobile-menu__toggle ${mobileDropdown === 'clients' ? 'is-open' : ''}`}
                type="button"
                onClick={() => toggleMobileDropdown('clients')}
                aria-expanded={mobileDropdown === 'clients'}
              >
                <span>КЛИЕНТАМ</span>
                <span className="mobile-menu__chevron" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
              <div className={`mobile-menu__submenu ${mobileDropdown === 'clients' ? 'is-open' : ''}`}>
                <Link to="/delivery" onClick={closeMobileMenu}>ДОСТАВКА</Link>
              </div>
            </div>
          </nav>
        </aside>
      </div>
  </>
  );
};

export default Header;
