import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getCategories } from '../services/api';
import { useCatalogFilters } from '../context/CatalogFiltersContext';
import './CatalogPage.css';

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [priceError, setPriceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobilePriceOpen, setIsMobilePriceOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const mobileCategoryDetailsRef = useRef(null);
  const productsRequestIdRef = useRef(0);
  const catalogFiltersContext = useCatalogFilters();

  // Синхронизация выбранных фильтров в контекст (чтобы поиск в шапке их сохранял)
  useEffect(() => {
    if (catalogFiltersContext) {
      catalogFiltersContext.setSelectedCategories(selectedCategories);
      catalogFiltersContext.setPriceMin(priceFrom);
      catalogFiltersContext.setPriceMax(priceTo);
    }
  }, [selectedCategories, priceFrom, priceTo, catalogFiltersContext]);

  // Загрузка категорий
  useEffect(() => {
    getCategories()
      .then(response => {
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setCategories(data);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  // Синхронизация выбранных категорий с URL при загрузке страницы
  useEffect(() => {
    const categoryFiltersFromUrl = searchParams.getAll('category');
    const categoryFilter = searchParams.get('filter');
    
    // Если есть категории в URL, используем их
    if (categoryFiltersFromUrl.length > 0) {
      setSelectedCategories(categoryFiltersFromUrl);
    } 
    // Поддержка старого формата с параметром filter (для обратной совместимости)
    else if (categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new') {
      setSelectedCategories([categoryFilter]);
    }
    // Если нет категорий в URL, очищаем выбранные категории
    else if (!categoryFilter) {
      setSelectedCategories([]);
    }
  }, [searchParams]);

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

  const sanitizeNonNegativePrice = (rawValue) => {
    if (rawValue == null) return null;
    const value = String(rawValue).trim();
    if (!value) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return null;
    }
    return String(numericValue);
  };

  // Синхронизация значений цены в UI с URL (при возврате на страницу/перезагрузке)
  useEffect(() => {
    const minFromUrl = sanitizeNonNegativePrice(searchParams.get('price_min'));
    const maxFromUrl = sanitizeNonNegativePrice(searchParams.get('price_max'));
    setPriceFrom(minFromUrl ?? '');
    setPriceTo(maxFromUrl ?? '');
  }, [searchParams]);

  // Загрузка товаров
  useEffect(() => {
    setLoading(true);
    const searchQuery = normalizeText(searchParams.get('q') || '');
    const params = {};
    
    const categoryFilter = searchParams.get('filter');
    const minPrice = sanitizeNonNegativePrice(searchParams.get('price_min'));
    const maxPrice = sanitizeNonNegativePrice(searchParams.get('price_max'));
    
    // Приоритет: category из URL -> выбранные в UI -> legacy filter=<slug>
    const categoriesFromUrl = searchParams.getAll('category');
    const legacyCategoryFromFilter =
      categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new'
        ? [categoryFilter]
        : [];
    const categoriesToFilter =
      categoriesFromUrl.length > 0
        ? categoriesFromUrl
        : selectedCategories.length > 0
          ? selectedCategories
          : legacyCategoryFromFilter;

    const requestId = ++productsRequestIdRef.current;
    
    if (searchQuery) {
      // При поиске также передаем фильтры категорий в API
      params.page = undefined;
      if (categoriesToFilter.length > 0) {
        params.category = categoriesToFilter;
      } else if (categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new') {
        // Поддержка /catalog?filter=<slug> на первом рендере
        params.category = [categoryFilter];
      }
    } else if (categoryFilter === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (categoryFilter === 'new') {
      params.is_new = 'true';
    } else if (categoriesToFilter.length > 0) {
      // Используем категории из URL параметра category
      params.category = categoriesToFilter;
    } else if (categoryFilter) {
      // Поддержка старого формата ?filter=<slug>, пока selectedCategories не синхронизировался
      params.category = [categoryFilter];
    }
    if (minPrice) params.price_min = minPrice;
    if (maxPrice) params.price_max = maxPrice;

    getProducts(params)
      .then(response => {
        if (requestId !== productsRequestIdRef.current) return;
        let data = Array.isArray(response.data) ? response.data : (response.data.results || []);

        if (searchQuery) {
          const scored = data
            .map((item) => {
              const text = normalizeText(`${item.name || ''} ${item.description || ''}`);
              const score = getSimilarity(searchQuery, text);
              return { item, score };
            })
            .filter(({ score, item }) => score >= 0.35 || normalizeText(item.name || '').includes(searchQuery));

          data = scored
            .sort((a, b) => b.score - a.score)
            .map(({ item }) => item);
          
          // Применяем фильтр по категориям к результатам поиска
          if (categoriesToFilter.length > 0) {
            data = data.filter(item => {
              // Проверяем, что товар принадлежит хотя бы одной из выбранных категорий
              return item.category_slug && categoriesToFilter.includes(item.category_slug);
            });
          }
        }
        
        // Сортировка
        if (sortBy === 'price_asc') {
          data = [...data].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortBy === 'price_desc') {
          data = [...data].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortBy === 'new') {
          data = [...data].filter(p => p.is_new).concat(data.filter(p => !p.is_new));
        }
        // 'popular' - оставляем как есть (можно добавить поле popularity в будущем)
        
        if (minPrice || maxPrice) {
          const minVal = minPrice ? parseFloat(minPrice) : null;
          const maxVal = maxPrice ? parseFloat(maxPrice) : null;
          data = data.filter((item) => {
            const value = parseFloat(item.price);
            if (Number.isNaN(value)) return false;
            if (minVal !== null && value < minVal) return false;
            if (maxVal !== null && value > maxVal) return false;
            return true;
          });
        }

        setCatalogProducts(data);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== productsRequestIdRef.current) return;
        setCatalogProducts([]);
        setLoading(false);
      });
  }, [searchParams, selectedCategories, sortBy]);

  const handleCategoryChange = (categorySlug) => {
    const nextSelectedCategories = selectedCategories.includes(categorySlug)
      ? selectedCategories.filter((slug) => slug !== categorySlug)
      : [...selectedCategories, categorySlug];

    setSelectedCategories(nextSelectedCategories);

    const nextParams = new URLSearchParams(searchParams);
    // При ручном выборе категории убираем "витринные" фильтры bestsellers/new
    nextParams.delete('filter');
    nextParams.delete('category');
    nextSelectedCategories.forEach((slug) => nextParams.append('category', slug));
    setSearchParams(nextParams, { replace: true });
  };

  const applyFilters = () => {
    setPriceError('');
    let fromVal = priceFrom.trim();
    let toVal = priceTo.trim();
    const fromNum = fromVal === '' ? null : Number(fromVal);
    const toNum = toVal === '' ? null : Number(toVal);
    if (fromNum !== null && (Number.isNaN(fromNum) || fromNum < 0)) {
      setPriceError('Цена «от» не может быть отрицательной. Использовано значение 0.');
      fromVal = '0';
      setPriceFrom('0');
    }
    if (toNum !== null && (Number.isNaN(toNum) || toNum < 0)) {
      setPriceError('Цена «до» не может быть отрицательной. Использовано значение 0.');
      toVal = '0';
      setPriceTo('0');
    }
    const nextParams = {};
    if (selectedCategories.length > 0) {
      nextParams.category = selectedCategories;
    }
    if (fromVal) nextParams.price_min = fromVal;
    if (toVal) nextParams.price_max = toVal;
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setPriceFrom('');
    setPriceTo('');
    setPriceError('');
    setSearchParams({});
  };

  const handlePriceFromChange = (event) => {
    setPriceError('');
    const value = event.target.value;
    if (value === '' || value === '-') {
      setPriceFrom(value);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num < 0) {
      setPriceFrom('0');
      setPriceError('Цена «от» не может быть отрицательной. Использовано значение 0.');
      return;
    }
    setPriceFrom(value);
  };

  const handlePriceToChange = (event) => {
    setPriceError('');
    const value = event.target.value;
    if (value === '' || value === '-') {
      setPriceTo(value);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num < 0) {
      setPriceTo('0');
      setPriceError('Цена «до» не может быть отрицательной. Использовано значение 0.');
      return;
    }
    setPriceTo(value);
  };

  const handleMobilePriceApply = () => {
    applyFilters();
    setIsMobilePriceOpen(false);
  };

  const handleMobilePriceReset = () => {
    setPriceFrom('');
    setPriceTo('');
    setPriceError('');
    const nextParams = {};
    if (selectedCategories.length > 0) {
      nextParams.category = selectedCategories;
    }
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
    setIsMobilePriceOpen(false);
  };

  const closeMobileFiltersOverlay = () => {
    setIsMobilePriceOpen(false);
    if (mobileCategoryDetailsRef.current?.open) {
      mobileCategoryDetailsRef.current.open = false;
    }
    setIsMobileCategoryOpen(false);
  };

  return (
    <div className="catalog-page">
      <div className="container">
        
        {/* Хлебные крошки (Breadcrumbs) */}
        <div className="breadcrumbs">
          <span>Главная</span> / <span>Каталог</span>
        </div>

        <h1 className="page-title">КАТАЛОГ ТОВАРОВ</h1>
        {searchParams.get('q') && (
          <div className="catalog-search-query">
            Результаты по запросу: «{searchParams.get('q')}»
          </div>
        )}

        <div className="catalog-layout">
          <aside className="catalog-sidebar">
            <section className="catalog-sidebar-section">
              <h2 className="catalog-sidebar-title">КАТЕГОРИИ</h2>
              {categories.length === 0 ? (
                <div className="catalog-filter-empty">Категории не найдены</div>
              ) : (
                <ul className="catalog-filter-list">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.slug)}
                          onChange={() => handleCategoryChange(category.slug)}
                        />
                        {category.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="catalog-sidebar-section">
              <h2 className="catalog-sidebar-title">СТОИМОСТЬ</h2>
              <div className="catalog-filter-price">
                <input
                  type="number"
                  min={0}
                  placeholder="от 159"
                  value={priceFrom}
                  onChange={handlePriceFromChange}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="до 35389"
                  value={priceTo}
                  onChange={handlePriceToChange}
                />
              </div>
              {priceError && (
                <p className="catalog-filter-price-error" role="alert">
                  {priceError}
                </p>
              )}
            </section>

            <div className="catalog-sidebar-actions">
              <button className="catalog-filter-action" onClick={applyFilters}>
                Применить
              </button>
              <button
                className="catalog-filter-action catalog-filter-action--ghost"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            </div>
          </aside>

          <div className="catalog-content">
            {(isMobilePriceOpen || isMobileCategoryOpen) && (
              <button
                type="button"
                className="catalog-mobile-price-backdrop"
                aria-label="Закрыть фильтры"
                onClick={closeMobileFiltersOverlay}
              />
            )}

            <div className="catalog-mobile-filters">
              <details
                className="catalog-mobile-filter"
                ref={mobileCategoryDetailsRef}
                onToggle={(event) => setIsMobileCategoryOpen(event.currentTarget.open)}
              >
                <summary className="catalog-mobile-filter__summary">КАТЕГОРИИ</summary>
                <div className="catalog-mobile-filter__content">
                  {categories.length === 0 ? (
                    <div className="catalog-filter-empty">Категории не найдены</div>
                  ) : (
                    <ul className="catalog-filter-list catalog-mobile-filter-list">
                      {categories.map((category) => (
                        <li key={`mobile-${category.id}`}>
                          <button
                            type="button"
                            className={`catalog-mobile-category-item ${selectedCategories.includes(category.slug) ? 'is-active' : ''}`}
                            onClick={() => handleCategoryChange(category.slug)}
                          >
                            {category.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>

              <div className="catalog-mobile-filter catalog-mobile-filter--price">
                <button
                  type="button"
                  className="catalog-mobile-filter__summary catalog-mobile-filter__button"
                  onClick={() => {
                    if (mobileCategoryDetailsRef.current?.open) {
                      mobileCategoryDetailsRef.current.open = false;
                      setIsMobileCategoryOpen(false);
                    }
                    setIsMobilePriceOpen((prev) => !prev);
                  }}
                >
                  СТОИМОСТЬ
                </button>

                {isMobilePriceOpen && (
                  <div className="catalog-mobile-price-modal" role="dialog" aria-modal="false">
                    <button
                      type="button"
                      className="catalog-mobile-price-modal__close"
                      aria-label="Закрыть окно фильтра цены"
                      onClick={() => setIsMobilePriceOpen(false)}
                    >
                      ×
                    </button>

                    <div className="catalog-mobile-price-modal__row">
                      <label className="catalog-mobile-price-modal__field">
                        <span>ОТ</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="159"
                          value={priceFrom}
                          onChange={handlePriceFromChange}
                        />
                      </label>

                      <label className="catalog-mobile-price-modal__field">
                        <span>ДО</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="3538327"
                          value={priceTo}
                          onChange={handlePriceToChange}
                        />
                      </label>
                    </div>

                    {priceError && (
                      <p className="catalog-filter-price-error" role="alert">
                        {priceError}
                      </p>
                    )}

                    <div className="catalog-mobile-price-modal__actions">
                      <button
                        type="button"
                        className="catalog-mobile-price-modal__submit"
                        onClick={handleMobilePriceApply}
                      >
                        ПОДТВЕРДИТЬ
                      </button>
                      <button
                        type="button"
                        className="catalog-mobile-price-modal__reset"
                        onClick={handleMobilePriceReset}
                      >
                        СБРОСИТЬ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {(selectedCategories.length > 0 || priceFrom || priceTo) && (
                <div className="catalog-mobile-selected">
                  {(priceFrom || priceTo) && (
                    <button
                      type="button"
                      className="catalog-mobile-selected-tag"
                      onClick={handleMobilePriceReset}
                    >
                      {`ЦЕНА: ${priceFrom || '0'}–${priceTo || '∞'} ×`}
                    </button>
                  )}
                  {selectedCategories.map((slug) => {
                    const category = categories.find((item) => item.slug === slug);
                    return (
                      <button
                        key={`mobile-tag-${slug}`}
                        type="button"
                        className="catalog-mobile-selected-tag"
                        onClick={() => handleCategoryChange(slug)}
                      >
                        {category?.name || slug} ×
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="catalog-controls">
              <div className="catalog-controls-left">
                {selectedCategories.map((slug) => {
                  const category = categories.find((item) => item.slug === slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      className="catalog-tag"
                      onClick={() => handleCategoryChange(slug)}
                    >
                      {category?.name || slug} ×
                    </button>
                  );
                })}
              </div>

              <div className="sort-wrapper">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                  aria-label="Сортировка товаров"
                >
                  <option value="popular">По популярности</option>
                  <option value="price_asc">Сначала дешевые</option>
                  <option value="price_desc">Сначала дорогие</option>
                  <option value="new">Новинки</option>
                </select>
                {!loading && (
                  <span className="catalog-count">
                    Найдено: {catalogProducts.length}
                  </span>
                )}
              </div>
            </div>

            <div className="catalog-grid">
              {loading ? (
                <div className="catalog-status">
                  <p>Загрузка товаров...</p>
                </div>
              ) : catalogProducts.length > 0 ? (
                catalogProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <div className="catalog-status">
                  <p>Товары не найдены</p>
                  {searchParams.get('q') && (
                    <p className="catalog-status-subtext">
                      По запросу «{searchParams.get('q')}» ничего не найдено
                    </p>
                  )}
                </div>
              )}
            </div>

            {catalogProducts.length > 0 && (
              <div className="pagination">
                <button className="page-btn active">1</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
