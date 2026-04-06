import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getProducts } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useCatalogFilters } from '../../context/CatalogFiltersContext';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [mobileDropdown, setMobileDropdown] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const allProductsRef = useRef([]);
  const suggestionsTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { getTotalItems } = useCart();
  const { getFavoritesCount } = useFavorites();
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('authToken')));
  const catalogFilters = useCatalogFilters();
  const isOnCatalogPage = location.pathname === '/catalog' || location.pathname.endsWith('/catalog');
  const cartCount = getTotalItems();
  const favoritesCount = getFavoritesCount();
  const profileHref = isAuthenticated ? '/profile?tab=main' : '/auth';

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(Boolean(localStorage.getItem('authToken')));
    };
    window.addEventListener('auth-token-changed', syncAuthState);
    window.addEventListener('storage', syncAuthState);
    return () => {
      window.removeEventListener('auth-token-changed', syncAuthState);
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qFromUrl = params.get('q');

    // Не очищаем поле поиска при переходах на страницы без ?q= (например, карточка товара).
    // Обновляем значение только когда параметр `q` явно присутствует в URL.
    if (qFromUrl !== null) {
      setSearchValue(qFromUrl);
    }

    setSuggestions([]);
    setIsSuggestionsOpen(false);
    setIsSearchFocused(false);

    // Убираем фокус с полей поиска, чтобы не оставалось выделения после перехода по подсказке или отправки формы
    const blurSearchInputs = () => {
      document.querySelectorAll('.header__search-input, .mobile-search__input').forEach((el) => el.blur());
    };
    blurSearchInputs();
  }, [location.search]);

  useEffect(() => {
    if (!isSuggestionsOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const isInsideDesktop = desktopSearchRef.current?.contains(target);
      const isInsideMobile = mobileSearchRef.current?.contains(target);
      if (!isInsideDesktop && !isInsideMobile) {
        setIsSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSuggestionsOpen]);

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const loadAllProducts = async () => {
    if (allProductsRef.current.length > 0) return allProductsRef.current;
    const response = await getProducts({ page: 1, page_size: 120 });
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
          .filter(
            (item) =>
              normalizeText(item.name || '').includes(query) ||
              normalizeText(item.description || '').includes(query)
          )
          .slice(0, 6);
        setSuggestions(results);
        setIsSuggestionsOpen(isSearchFocused && results.length > 0);
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
  }, [searchValue, isSearchFocused]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchValue.trim();

    if (query) {
      const params = new URLSearchParams(isOnCatalogPage ? location.search : '');
      // Подставляем выбранные категории и цену из контекста (даже если не нажали «Применить»)
      if (isOnCatalogPage && catalogFilters) {
        params.delete('category');
        params.delete('subcategory');
        params.delete('parent');
        (catalogFilters.selectedCategories || []).forEach((c) => {
          if (/^\d$/.test(c)) params.append('parent', c);
          else params.append('subcategory', c);
        });
        if (catalogFilters.priceMin) params.set('price_min', catalogFilters.priceMin);
        else params.delete('price_min');
        if (catalogFilters.priceMax) params.set('price_max', catalogFilters.priceMax);
        else params.delete('price_max');
      }
      params.set('q', query);
      navigate(`/catalog?${params.toString()}`);
    } else {
      if (isOnCatalogPage) {
        const params = new URLSearchParams(location.search);
        params.delete('q');
        const newSearch = params.toString();
        navigate(newSearch ? `/catalog?${newSearch}` : '/catalog');
      } else {
        navigate('/catalog');
      }
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
    const el = document.activeElement;
    if (el && typeof el.blur === 'function') el.blur();
    setIsSuggestionsOpen(false);
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const buildCatalogParamsWithoutQuery = () => {
    const params = new URLSearchParams(location.search);
    params.delete('q');
    if (catalogFilters) {
      params.delete('category');
      params.delete('subcategory');
      params.delete('parent');
      (catalogFilters.selectedCategories || []).forEach((c) => {
        if (/^\d$/.test(c)) params.append('parent', c);
        else params.append('subcategory', c);
      });
      if (catalogFilters.priceMin) params.set('price_min', catalogFilters.priceMin);
      else params.delete('price_min');
      if (catalogFilters.priceMax) params.set('price_max', catalogFilters.priceMax);
      else params.delete('price_max');
    }
    return params;
  };

  const handleSearchClear = () => {
    setSearchValue('');
    if (isOnCatalogPage) {
      const params = buildCatalogParamsWithoutQuery();
      const newSearch = params.toString();
      navigate(newSearch ? `/catalog?${newSearch}` : '/catalog');
    } else {
      navigate('/catalog');
    }
    setIsSuggestionsOpen(false);
  };

  const handleSearchChange = (e) => {
    const newValue = e.target.value;
    const isWhitespaceOnly = newValue !== '' && !newValue.trim();
    setSearchValue(isWhitespaceOnly ? '' : newValue);

    if ((!newValue.trim() || isWhitespaceOnly) && isOnCatalogPage) {
      const params = buildCatalogParamsWithoutQuery();
      const newSearch = params.toString();
      navigate(newSearch ? `/catalog?${newSearch}` : '/catalog', { replace: true });
    }
  };

  return (
  <>
    <header className="header">
        <div className="container">
          <div className="header__inner">

        
            <div className="header__desktop">
              <Link className="header__logo" to="/" aria-label="KOKOSSIMO">
                <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="KOKOSSIMO" />
              </Link>

              <Link className="header__catalog" to="/catalog">
                <span className="icon icon--catalog" aria-hidden="true"></span>
                <span className="header__catalog-text">КАТАЛОГ</span>
              </Link>

              <Link className="header__cert" to="/certificates">СЕРТИФИКАТЫ</Link>

              <form
                className="header__search"
                role="search"
                onSubmit={handleSearchSubmit}
                ref={desktopSearchRef}
              >
                <button className="header__search-btn" type="submit" aria-label="Поиск">
                  <span className="header__search-icon icon icon--search" aria-hidden="true"></span>
                </button>
                <input
                  className="header__search-input"
                  type="search"
                  name="q"
                  placeholder=""
                  value={searchValue}
                  onChange={handleSearchChange}
                  onReset={handleSearchClear}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    if (searchValue.trim() && suggestions.length > 0) setIsSuggestionsOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsSearchFocused(false);
                      setIsSuggestionsOpen(false);
                    }, 150);
                  }}
                />
                {searchValue.trim() !== '' && (
                  <button
                    type="button"
                    className="header__search-clear"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearchClear();
                    }}
                    aria-label="Очистить поиск"
                  >
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
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
                    <Link className="header__dropdown-link" to="/documents">
                      Документы
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
                <Link className="header__icon-btn" to="/profile?tab=favorites" aria-label="Избранное">
                  <span className="icon icon--fav" aria-hidden="true"></span>
                  {isAuthenticated && favoritesCount > 0 && (
                    <span className="header__icon-badge">{favoritesCount}</span>
                  )}
                </Link>
                <Link className="header__icon-btn" to={profileHref} aria-label="Профиль">
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

              <Link className="header__logo-mobile" to="/" aria-label="KOKOSSIMO">
                <img src={`${import.meta.env.BASE_URL}assets/logo_shot.svg`} alt="KOKOSSIMO" />
              </Link>

              <div className="header__mobile-right">
                <Link className="header__icon-btn" to="/cart" aria-label="Корзина">
                  <span className="icon icon--cart" aria-hidden="true"></span>
                  {cartCount > 0 && <span className="header__icon-badge">{cartCount}</span>}
                </Link>
                <Link className="header__icon-btn" to={profileHref} aria-label="Профиль">
                  <span className="icon icon--profile" aria-hidden="true"></span>
                </Link>
              </div>
            </div>

          </div>
        </div>
        <section className="development-notice" role="status" aria-live="polite">
          <div className="container">
            <p>
              Сайт находится в разработке. Заказы временно не обрабатываются до полного запуска.
            </p>
          </div>
        </section>
      </header>
    <div
      className={`mobile-search ${isMobileSearchOpen ? 'is-open' : ''}`}
      id="mobile-search"
      aria-hidden={isMobileSearchOpen ? 'false' : 'true'}
    >
        <div className="container">
          <form
            className="mobile-search__form"
            role="search"
            onSubmit={handleSearchSubmit}
            ref={mobileSearchRef}
          >
            <button className="header__search-btn" type="submit" aria-label="Поиск">
              <span className="icon icon--search" aria-hidden="true"></span>
            </button>
            <input
              className="mobile-search__input"
              type="search"
              name="q"
              placeholder=""
              value={searchValue}
              onChange={handleSearchChange}
              onReset={handleSearchClear}
              onFocus={() => {
                setIsSearchFocused(true);
                if (searchValue.trim() && suggestions.length > 0) setIsSuggestionsOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsSearchFocused(false);
                  setIsSuggestionsOpen(false);
                }, 150);
              }}
            />
            {searchValue.trim() !== '' && (
              <button
                type="button"
                className="mobile-search__clear"
                onClick={(e) => {
                  e.preventDefault();
                  handleSearchClear();
                }}
                aria-label="Очистить поиск"
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
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
                <Link to="/documents" onClick={closeMobileMenu}>ДОКУМЕНТЫ</Link>
              </div>
            </div>

            <Link to="/certificates" onClick={closeMobileMenu}>СЕРТИФИКАТЫ</Link>
          </nav>

          <div className="mobile-menu__account-wrap">
            {isAuthenticated ? (
              <Link
                to="/profile?tab=main"
                onClick={closeMobileMenu}
                className="mobile-menu__account mobile-menu__account--auth"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 1116 0"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>ЛИЧНЫЙ КАБИНЕТ</span>
              </Link>
            ) : (
              <Link
                to="/auth"
                onClick={closeMobileMenu}
                className="mobile-menu__account mobile-menu__account--guest"
              >
                <span>ВОЙТИ В ЛИЧНЫЙ КАБИНЕТ</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )}
          </div>
        </aside>
      </div>
  </>
  );
};

export default Header;
