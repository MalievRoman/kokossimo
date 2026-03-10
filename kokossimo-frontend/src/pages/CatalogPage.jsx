import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getProductSubcategoriesTree } from '../services/api';
import { useCatalogFilters } from '../context/CatalogFiltersContext';
import './CatalogPage.css';

const CATALOG_PAGE_SIZE = 30;

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryTree, setCategoryTree] = useState([]);
  const [selectedParents, setSelectedParents] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [priceError, setPriceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobilePriceOpen, setIsMobilePriceOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const mobileCategoryDetailsRef = useRef(null);
  const productsRequestIdRef = useRef(0);
  const catalogFiltersContext = useCatalogFilters();

  // Синхронизация выбранных фильтров в контекст (без catalogFiltersContext в deps — иначе цикл ре-рендеров)
  useEffect(() => {
    if (catalogFiltersContext) {
      catalogFiltersContext.setSelectedCategories([...selectedParents, ...selectedSubcategories]);
      catalogFiltersContext.setPriceMin(priceFrom);
      catalogFiltersContext.setPriceMax(priceTo);
    }
  }, [selectedParents, selectedSubcategories, priceFrom, priceTo]);

  // Загрузка дерева категорий (большие категории + подкатегории)
  useEffect(() => {
    getProductSubcategoriesTree()
      .then(response => {
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setCategoryTree(data);
      })
      .catch(() => {
        setCategoryTree([]);
      });
  }, []);

  // Синхронизация выбора с URL
  useEffect(() => {
    const parentsFromUrl = searchParams.getAll('parent');
    const subcategoriesFromUrl = searchParams.getAll('subcategory');
    const categoryFilter = searchParams.get('filter');
    if (parentsFromUrl.length > 0 || subcategoriesFromUrl.length > 0) {
      setSelectedParents(parentsFromUrl);
      setSelectedSubcategories(subcategoriesFromUrl);
    } else if (categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new' && categoryFilter !== 'site-kokossimo') {
      if (/^\d+\.\d+$/.test(categoryFilter)) {
        setSelectedSubcategories([categoryFilter]);
        setSelectedParents([]);
      } else if (/^\d$/.test(categoryFilter)) {
        setSelectedParents([categoryFilter]);
        setSelectedSubcategories([]);
      } else {
        setSelectedSubcategories([categoryFilter]);
        setSelectedParents([]);
      }
    } else {
      setSelectedParents([]);
      setSelectedSubcategories([]);
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

  // При изменении фильтров/поиска/сортировки заново грузим с первой страницы.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchParams, selectedParents, selectedSubcategories, sortBy]);

  // Загрузка товаров
  useEffect(() => {
    if (currentPage === 1) {
      setLoading(true);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }
    const searchQuery = normalizeText(searchParams.get('q') || '');
    const params = {};
    
    const categoryFilter = searchParams.get('filter');
    const minPrice = sanitizeNonNegativePrice(searchParams.get('price_min'));
    const maxPrice = sanitizeNonNegativePrice(searchParams.get('price_max'));
    
    const parentsFromUrl = searchParams.getAll('parent');
    const subcategoriesFromUrl = searchParams.getAll('subcategory');
    const legacyCategoryFromFilter =
      categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new' && categoryFilter !== 'site-kokossimo'
        ? [categoryFilter]
        : [];
    const parentsToFilter = parentsFromUrl.length > 0 ? parentsFromUrl : selectedParents;
    const subcategoriesToFilter =
      subcategoriesFromUrl.length > 0
        ? subcategoriesFromUrl
        : selectedSubcategories.length > 0
          ? selectedSubcategories
          : legacyCategoryFromFilter.filter(c => /^\d+\.\d+$/.test(c));
    const legacyParents = legacyCategoryFromFilter.filter(c => /^\d$/.test(c));
    const parentsFinal = parentsFromUrl.length > 0 ? parentsFromUrl : (selectedParents.length > 0 ? selectedParents : legacyParents);

    const requestId = ++productsRequestIdRef.current;
    
    if (searchQuery) {
      params.page = undefined;
      if (parentsFinal.length > 0) params.parent = parentsFinal;
      if (subcategoriesToFilter.length > 0) params.subcategory = subcategoriesToFilter;
    } else if (categoryFilter === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (categoryFilter === 'new') {
      params.is_new = 'true';
    } else if (parentsFinal.length > 0 || subcategoriesToFilter.length > 0) {
      if (parentsFinal.length > 0) params.parent = parentsFinal;
      if (subcategoriesToFilter.length > 0) params.subcategory = subcategoriesToFilter;
    } else if (legacyCategoryFromFilter.length > 0) {
      const p = legacyCategoryFromFilter.filter(c => /^\d$/.test(c));
      const s = legacyCategoryFromFilter.filter(c => /^\d+\.\d+$/.test(c));
      if (p.length) params.parent = p;
      if (s.length) params.subcategory = s;
    }
    if (minPrice) params.price_min = minPrice;
    if (maxPrice) params.price_max = maxPrice;
    params.page = currentPage;
    params.page_size = CATALOG_PAGE_SIZE;

    getProducts(params)
      .then(response => {
        if (requestId !== productsRequestIdRef.current) return;
        const isPaginatedResponse =
          response.data &&
          !Array.isArray(response.data) &&
          Array.isArray(response.data.results);
        let data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        const serverCount = isPaginatedResponse ? Number(response.data.count || 0) : data.length;

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
          const parentSet = new Set(parentsFinal);
          const subSet = new Set(subcategoriesToFilter);
          if (parentSet.size > 0 || subSet.size > 0) {
            data = data.filter(item => {
              if (!item.product_subcategory_code) return false;
              const code = item.product_subcategory_code;
              if (subSet.has(code)) return true;
              const p = code.split('.')[0];
              return parentSet.has(p);
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

        setCatalogProducts((prevProducts) => {
          if (currentPage === 1) return data;
          const existingIds = new Set(prevProducts.map((item) => item.id));
          const toAppend = data.filter((item) => !existingIds.has(item.id));
          return [...prevProducts, ...toAppend];
        });
        const safeCount = Number.isFinite(serverCount) ? serverCount : data.length;
        const computedTotalPages = Math.max(1, Math.ceil(safeCount / CATALOG_PAGE_SIZE));
        setTotalProducts(safeCount);
        setTotalPages(computedTotalPages);
        setHasMore(currentPage < computedTotalPages);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch(() => {
        if (requestId !== productsRequestIdRef.current) return;
        if (currentPage === 1) {
          setCatalogProducts([]);
          setTotalProducts(0);
          setTotalPages(1);
        }
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
      });
  }, [searchParams, selectedSubcategories, sortBy, currentPage]);

  const handleParentChange = (parentCode) => {
    const next = selectedParents.includes(parentCode)
      ? selectedParents.filter((c) => c !== parentCode)
      : [...selectedParents, parentCode];
    setSelectedParents(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('filter');
    nextParams.delete('parent');
    nextParams.delete('subcategory');
    next.forEach((c) => nextParams.append('parent', c));
    selectedSubcategories.forEach((c) => nextParams.append('subcategory', c));
    setSearchParams(nextParams, { replace: true });
  };

  const handleSubcategoryChange = (code) => {
    const next = selectedSubcategories.includes(code)
      ? selectedSubcategories.filter((c) => c !== code)
      : [...selectedSubcategories, code];
    setSelectedSubcategories(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('filter');
    nextParams.delete('parent');
    nextParams.delete('subcategory');
    selectedParents.forEach((c) => nextParams.append('parent', c));
    next.forEach((c) => nextParams.append('subcategory', c));
    setSearchParams(nextParams, { replace: true });
  };

  const toggleExpanded = (parentCode) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentCode)) next.delete(parentCode);
      else next.add(parentCode);
      return next;
    });
  };

  const removeFilter = (code) => {
    if (/^\d$/.test(code)) {
      handleParentChange(code);
    } else {
      handleSubcategoryChange(code);
    }
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
    if (selectedParents.length > 0) nextParams.parent = selectedParents;
    if (selectedSubcategories.length > 0) nextParams.subcategory = selectedSubcategories;
    if (fromVal) nextParams.price_min = fromVal;
    if (toVal) nextParams.price_max = toVal;
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    setSelectedParents([]);
    setSelectedSubcategories([]);
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
    if (selectedParents.length > 0) nextParams.parent = selectedParents;
    if (selectedSubcategories.length > 0) nextParams.subcategory = selectedSubcategories;
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

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    setCurrentPage((prev) => prev + 1);
  };

  return (
    <div className="catalog-page">
      <div className="container">
        
        {/* Хлебные крошки (Breadcrumbs) */}
        <div className="breadcrumbs">
          <Link to="/">ГЛАВНАЯ</Link> <span>— КАТАЛОГ</span>
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
              {categoryTree.length === 0 ? (
                <div className="catalog-filter-empty">Категории не найдены</div>
              ) : (
                <ul className="catalog-filter-list catalog-filter-tree">
                  {categoryTree.map((parent) => (
                    <li key={parent.code} className="catalog-filter-tree-parent">
                      <div className="catalog-filter-tree-parent-row">
                        <label className="catalog-filter-tree-parent-label">
                          <input
                            type="checkbox"
                            checked={selectedParents.includes(parent.code)}
                            onChange={() => handleParentChange(parent.code)}
                          />
                          {parent.name}
                        </label>
                        <button
                          type="button"
                          className={`catalog-filter-tree-toggle ${expandedParents.has(parent.code) ? 'is-open' : ''}`}
                          onClick={() => toggleExpanded(parent.code)}
                          aria-expanded={expandedParents.has(parent.code)}
                          aria-label={expandedParents.has(parent.code) ? 'Свернуть подкатегории' : 'Показать подкатегории'}
                        >
                          ▼
                        </button>
                      </div>
                      {expandedParents.has(parent.code) && parent.children && parent.children.length > 0 && (
                        <ul className="catalog-filter-tree-children">
                          {parent.children.map((child) => (
                            <li key={child.code}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={selectedSubcategories.includes(child.code)}
                                  onChange={() => handleSubcategoryChange(child.code)}
                                />
                                {child.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
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
                  {categoryTree.length === 0 ? (
                    <div className="catalog-filter-empty">Категории не найдены</div>
                  ) : (
                    <ul className="catalog-filter-list catalog-mobile-filter-list catalog-filter-tree">
                      {categoryTree.map((parent) => (
                        <li key={`mobile-${parent.code}`} className="catalog-filter-tree-parent">
                          <div className="catalog-filter-tree-parent-row">
                            <button
                              type="button"
                              className={`catalog-mobile-category-item ${selectedParents.includes(parent.code) ? 'is-active' : ''}`}
                              onClick={() => handleParentChange(parent.code)}
                            >
                              {parent.name}
                            </button>
                            <button
                              type="button"
                              className={`catalog-filter-tree-toggle ${expandedParents.has(parent.code) ? 'is-open' : ''}`}
                              onClick={() => toggleExpanded(parent.code)}
                              aria-label={expandedParents.has(parent.code) ? 'Свернуть' : 'Подкатегории'}
                            >
                              ▼
                            </button>
                          </div>
                          {expandedParents.has(parent.code) && parent.children && parent.children.length > 0 && (
                            <ul className="catalog-filter-tree-children">
                              {parent.children.map((child) => (
                                <li key={child.code}>
                                  <button
                                    type="button"
                                    className={`catalog-mobile-category-item ${selectedSubcategories.includes(child.code) ? 'is-active' : ''}`}
                                    onClick={() => handleSubcategoryChange(child.code)}
                                  >
                                    {child.name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
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

              {(selectedParents.length > 0 || selectedSubcategories.length > 0 || priceFrom || priceTo) && (
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
                  {selectedParents.map((code) => {
                    const parent = categoryTree.find((p) => p.code === code);
                    return (
                      <button
                        key={`mobile-tag-parent-${code}`}
                        type="button"
                        className="catalog-mobile-selected-tag"
                        onClick={() => removeFilter(code)}
                      >
                        {parent?.name || code} ×
                      </button>
                    );
                  })}
                  {selectedSubcategories.map((code) => {
                    let name = code;
                    for (const p of categoryTree) {
                      const child = p.children?.find((c) => c.code === code);
                      if (child) {
                        name = child.name;
                        break;
                      }
                    }
                    return (
                      <button
                        key={`mobile-tag-${code}`}
                        type="button"
                        className="catalog-mobile-selected-tag"
                        onClick={() => removeFilter(code)}
                      >
                        {name} ×
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="catalog-controls">
              <div className="catalog-controls-left">
                {selectedParents.map((code) => {
                  const parent = categoryTree.find((p) => p.code === code);
                  return (
                    <button
                      key={`parent-${code}`}
                      type="button"
                      className="catalog-tag"
                      onClick={() => removeFilter(code)}
                    >
                      {parent?.name || code} ×
                    </button>
                  );
                })}
                {selectedSubcategories.map((code) => {
                  let name = code;
                  for (const p of categoryTree) {
                    const child = p.children?.find((c) => c.code === code);
                    if (child) {
                      name = child.name;
                      break;
                    }
                  }
                  return (
                    <button
                      key={code}
                      type="button"
                      className="catalog-tag"
                      onClick={() => removeFilter(code)}
                    >
                      {name} ×
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
                    Найдено: {totalProducts}
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

            {catalogProducts.length > 0 && hasMore && (
              <div className="pagination">
                <button
                  className="page-btn page-btn--load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
