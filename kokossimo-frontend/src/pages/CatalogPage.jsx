import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getProductsPriceRange, getProductSubcategoriesTree } from '../services/api';
import { useCatalogFilters } from '../context/CatalogFiltersContext';
import './CatalogPage.css';

const CATALOG_PAGE_SIZE = 30;
const CATALOG_STATE_STORAGE_KEY = 'catalog_state_v1';
const CATALOG_SORT_STORAGE_KEY = 'catalog_sort_v1';

const CatalogChevron = ({ className = '' }) => (
  <svg
    width="12"
    height="8"
    viewBox="0 0 12 8"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M1 1L6 6L11 1"
      stroke="currentColor"
      strokeWidth="0.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CatalogFilterButtonIcon = ({ className = '' }) => (
  <svg
    width="10"
    height="10"
    viewBox="13 13 10 10"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M13.4048 14.9315C13.4048 14.6742 13.4048 14.5455 13.4549 14.4472C13.4989 14.3607 13.5692 14.2904 13.6557 14.2464C13.754 14.1963 13.8827 14.1963 14.14 14.1963H21.86C22.1174 14.1963 22.246 14.1963 22.3443 14.2464C22.4308 14.2904 22.5011 14.3607 22.5451 14.4472C22.5952 14.5455 22.5952 14.6742 22.5952 14.9315V15.2391C22.5952 15.3626 22.5952 15.4244 22.5801 15.4818C22.5667 15.5327 22.5447 15.5809 22.515 15.6244C22.4815 15.6734 22.4348 15.7138 22.3415 15.7947L19.4025 18.3419C19.3092 18.4227 19.2625 18.4632 19.229 18.5122C19.1993 18.5557 19.1773 18.6039 19.1639 18.6547C19.1488 18.7122 19.1488 18.7739 19.1488 18.8975V21.2998C19.1488 21.3896 19.1488 21.4345 19.1343 21.4734C19.1215 21.5077 19.1007 21.5385 19.0736 21.5631C19.0429 21.591 19.0012 21.6077 18.9177 21.6411L17.3553 22.266C17.1865 22.3336 17.102 22.3674 17.0342 22.3533C16.9749 22.3409 16.9229 22.3057 16.8895 22.2552C16.8512 22.1976 16.8512 22.1066 16.8512 21.9247V18.8975C16.8512 18.7739 16.8512 18.7122 16.8361 18.6547C16.8227 18.6039 16.8007 18.5557 16.771 18.5122C16.7375 18.4632 16.6908 18.4227 16.5975 18.3419L13.6585 15.7947C13.5651 15.7138 13.5185 15.6734 13.485 15.6244C13.4553 15.5809 13.4333 15.5327 13.4199 15.4818C13.4048 15.4244 13.4048 15.3626 13.4048 15.2391V14.9315Z"
      stroke="#740400"
      strokeWidth="0.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState(() => {
    try {
      return sessionStorage.getItem(CATALOG_SORT_STORAGE_KEY) || 'popular';
    } catch {
      return 'popular';
    }
  });
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
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [priceRange, setPriceRange] = useState({ min: null, max: null });
  const [loading, setLoading] = useState(true);
  const [isMobilePriceOpen, setIsMobilePriceOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false);
  const mobileCategoryDetailsRef = useRef(null);
  const productsRequestIdRef = useRef(0);
  const skipInitialPageResetRef = useRef(true);
  const skipFirstFetchRef = useRef(false);
  const catalogFiltersContext = useCatalogFilters();
  const queryKey = `${searchParams.toString()}::${sortBy}`;

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_SORT_STORAGE_KEY, sortBy);
    } catch {
      // noop
    }
  }, [sortBy]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CATALOG_STATE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || saved.queryKey !== queryKey) return;
      setCatalogProducts(Array.isArray(saved.catalogProducts) ? saved.catalogProducts : []);
      setTotalProducts(Number(saved.totalProducts) || 0);
      setTotalPages(Number(saved.totalPages) || 1);
      setCurrentPage(Number(saved.currentPage) || 1);
      setHasMore(Boolean(saved.hasMore));
      setLoading(false);
      setLoadingMore(false);
      skipFirstFetchRef.current = true;
    } catch {
      // ignore corrupted session cache
    }
  }, [queryKey]);

  useEffect(() => {
    try {
      const payload = {
        queryKey,
        catalogProducts,
        totalProducts,
        totalPages,
        currentPage,
        hasMore,
      };
      sessionStorage.setItem(CATALOG_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
  }, [queryKey, catalogProducts, totalProducts, totalPages, currentPage, hasMore]);

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

  useEffect(() => {
    setOnlyInStock(searchParams.get('in_stock') === 'true');
  }, [searchParams]);

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

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

  const normalizePriceInput = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    // Запрещаем начинать с нуля: "0", "01", "0005" → "", "1", "5"
    const noLeadingZeros = digits.replace(/^0+(?=\d)/, '');
    return noLeadingZeros === '0' ? '' : noLeadingZeros;
  };

  const isPriceKeyAllowed = (event) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Enter',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(event.key)) return true;
    if (event.ctrlKey || event.metaKey) return true;
    return /^\d$/.test(event.key);
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
    if (skipInitialPageResetRef.current) {
      skipInitialPageResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchParams, selectedParents, selectedSubcategories, sortBy]);

  // Реальный диапазон цен (для подсказок в полях "от/до")
  useEffect(() => {
    const params = {};
    const categoryFilter = searchParams.get('filter');
    const searchQuery = normalizeText(searchParams.get('q') || '');
    const parentsFromUrl = searchParams.getAll('parent');
    const subcategoriesFromUrl = searchParams.getAll('subcategory');
    const legacyCategoryFromFilter =
      categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new' && categoryFilter !== 'site-kokossimo'
        ? [categoryFilter]
        : [];
    const subcategoriesToFilter =
      subcategoriesFromUrl.length > 0
        ? subcategoriesFromUrl
        : selectedSubcategories.length > 0
          ? selectedSubcategories
          : legacyCategoryFromFilter.filter((c) => /^\d+\.\d+$/.test(c));
    const legacyParents = legacyCategoryFromFilter.filter((c) => /^\d$/.test(c));
    const parentsFinal =
      parentsFromUrl.length > 0 ? parentsFromUrl : selectedParents.length > 0 ? selectedParents : legacyParents;

    // Для поиска сортировка/результаты считаются локально, диапазон цен берём по тем же фильтрам категорий.
    if (categoryFilter === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (categoryFilter === 'new') {
      params.is_new = 'true';
    } else if (parentsFinal.length > 0 || subcategoriesToFilter.length > 0) {
      if (parentsFinal.length > 0) params.parent = parentsFinal;
      if (subcategoriesToFilter.length > 0) params.subcategory = subcategoriesToFilter;
    } else if (legacyCategoryFromFilter.length > 0) {
      const p = legacyCategoryFromFilter.filter((c) => /^\d$/.test(c));
      const s = legacyCategoryFromFilter.filter((c) => /^\d+\.\d+$/.test(c));
      if (p.length) params.parent = p;
      if (s.length) params.subcategory = s;
    }
    if (searchParams.get('in_stock') === 'true') {
      params.in_stock = 'true';
    }

    // Если пользователь в режиме поиска — всё равно покажем диапазон по выбранным категориям.
    // searchQuery переменная используется только чтобы зависимость обновлялась вместе с остальной логикой.
    void searchQuery;

    getProductsPriceRange(params)
      .then((resp) => {
        const min = resp?.data?.min_price != null ? Number(resp.data.min_price) : null;
        const max = resp?.data?.max_price != null ? Number(resp.data.max_price) : null;
        setPriceRange({
          min: Number.isFinite(min) ? min : null,
          max: Number.isFinite(max) ? max : null,
        });
      })
      .catch(() => {
        setPriceRange({ min: null, max: null });
      });
  }, [searchParams, selectedParents, selectedSubcategories]);

  // Загрузка товаров
  useEffect(() => {
    if (skipFirstFetchRef.current) {
      skipFirstFetchRef.current = false;
      return;
    }
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
      params.q = searchParams.get('q').trim();
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
    if (searchParams.get('in_stock') === 'true') {
      params.in_stock = 'true';
    }
    if (minPrice) params.price_min = minPrice;
    if (maxPrice) params.price_max = maxPrice;

    // Сортировка должна применяться ко всем товарам (серверная).
    // Для поиска оставляем релевантность (клиентский скоринг).
    if (!searchQuery) {
      if (sortBy === 'price_asc') {
        params.ordering = 'price';
      } else if (sortBy === 'price_desc') {
        params.ordering = '-price';
      } else if (sortBy === 'new') {
        params.ordering = '-is_new,-created_at,-id';
      }
    }
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
        // Поиск выполняется на сервере по названию и описанию (params.q).
        
        // Сортировка и price_min/price_max применяются на сервере.

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

  const getParentCodeFromSubcategory = (code) => String(code || '').split('.')[0];

  const handleParentChange = (parentCode) => {
    const isRemoving = selectedParents.includes(parentCode);
    const nextParents = isRemoving
      ? selectedParents.filter((c) => c !== parentCode)
      : [...selectedParents, parentCode];
    const nextSubcategories = isRemoving
      ? selectedSubcategories.filter((c) => getParentCodeFromSubcategory(c) !== parentCode)
      : selectedSubcategories;

    setSelectedParents(nextParents);
    setSelectedSubcategories(nextSubcategories);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('filter');
    nextParams.delete('parent');
    nextParams.delete('subcategory');
    nextParents.forEach((c) => nextParams.append('parent', c));
    nextSubcategories.forEach((c) => nextParams.append('subcategory', c));
    setSearchParams(nextParams, { replace: true });
  };

  const handleSubcategoryChange = (code) => {
    const parentCode = getParentCodeFromSubcategory(code);
    const nextSubcategories = selectedSubcategories.includes(code)
      ? selectedSubcategories.filter((c) => c !== code)
      : [...selectedSubcategories, code];
    const nextParents = selectedParents.includes(parentCode)
      ? selectedParents
      : [...selectedParents, parentCode];

    setSelectedSubcategories(nextSubcategories);
    setSelectedParents(nextParents);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('filter');
    nextParams.delete('parent');
    nextParams.delete('subcategory');
    nextParents.forEach((c) => nextParams.append('parent', c));
    nextSubcategories.forEach((c) => nextParams.append('subcategory', c));
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

  const applyFilters = ({ inStockOverride = onlyInStock } = {}) => {
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
    if (inStockOverride) nextParams.in_stock = 'true';
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
  };

  const handlePriceFromChange = (event) => {
    setPriceError('');
    setPriceFrom(normalizePriceInput(event.target.value));
  };

  const handlePriceToChange = (event) => {
    setPriceError('');
    setPriceTo(normalizePriceInput(event.target.value));
  };

  const handleDesktopPriceKeyDown = (event) => {
    if (!isPriceKeyAllowed(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
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
    if (onlyInStock) nextParams.in_stock = 'true';
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
    setIsMobilePriceOpen(false);
  };

  const closeMobileFiltersOverlay = () => {
    setIsMobilePriceOpen(false);
    setIsMobileSortOpen(false);
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

        <h1 className="page-title">КАТАЛОГ</h1>
        {searchParams.get('q') && (
          <div className="catalog-search-query">
            Результаты по запросу: «{searchParams.get('q')}»
          </div>
        )}

        <div className="catalog-layout">
          <aside className="catalog-sidebar">
            <section className="catalog-sidebar-section">
              <h2 className="catalog-sidebar-title catalog-sidebar-title--categories">КАТЕГОРИИ</h2>
              {categoryTree.length === 0 ? (
                <div className="catalog-filter-empty">Категории не найдены</div>
              ) : (
                <ul className="catalog-filter-list catalog-filter-tree">
                      {categoryTree.map((parent) => (
                        <li key={parent.code} className="catalog-filter-tree-parent">
                          <div className="catalog-filter-tree-parent-row">
                        <div className="catalog-filter-tree-parent-label">
                          {parent.name}
                        </div>
                        <button
                          type="button"
                          className={`catalog-filter-tree-toggle ${expandedParents.has(parent.code) ? 'is-open' : ''}`}
                          onClick={() => toggleExpanded(parent.code)}
                          aria-expanded={expandedParents.has(parent.code)}
                          aria-label={expandedParents.has(parent.code) ? 'Свернуть подкатегории' : 'Показать подкатегории'}
                        >
                          <CatalogChevron className="catalog-filter-tree-toggle__icon" />
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
                  className="catalog-price-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={priceRange.min != null ? `от ${Math.floor(priceRange.min)}` : 'от'}
                  value={priceFrom}
                  onChange={handlePriceFromChange}
                  onBlur={() => applyFilters()}
                  onKeyDown={handleDesktopPriceKeyDown}
                />
                <input
                  className="catalog-price-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={priceRange.max != null ? `до ${Math.ceil(priceRange.max)}` : 'до'}
                  value={priceTo}
                  onChange={handlePriceToChange}
                  onBlur={() => applyFilters()}
                  onKeyDown={handleDesktopPriceKeyDown}
                />
              </div>
              {priceError && (
                <p className="catalog-filter-price-error" role="alert">
                  {priceError}
                </p>
              )}
            </section>
            <section className="catalog-sidebar-section">
              <h2 className="catalog-sidebar-title">НАЛИЧИЕ</h2>
              <ul className="catalog-filter-list">
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={onlyInStock}
                      onChange={(event) => {
                        setOnlyInStock(event.target.checked);
                        applyFilters({ inStockOverride: event.target.checked });
                      }}
                    />
                    Только в наличии
                  </label>
                </li>
              </ul>
            </section>
          </aside>

          <div className="catalog-content">
            {(isMobilePriceOpen || isMobileCategoryOpen || isMobileSortOpen) && (
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
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setIsMobileCategoryOpen(isOpen);
                  if (isOpen) {
                    setIsMobilePriceOpen(false);
                    setIsMobileSortOpen(false);
                  }
                }}
              >
                <summary className="catalog-mobile-filter__summary">
                  <span>КАТЕГОРИИ</span>
                  <CatalogChevron className="catalog-mobile-filter__chevron" />
                </summary>
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
                              className={`catalog-mobile-category-item catalog-mobile-category-item--parent ${expandedParents.has(parent.code) ? 'is-open' : ''}`}
                              onClick={() => toggleExpanded(parent.code)}
                              aria-expanded={expandedParents.has(parent.code)}
                              aria-label={expandedParents.has(parent.code) ? 'Свернуть подкатегории' : 'Показать подкатегории'}
                            >
                              <span>{parent.name}</span>
                              <CatalogChevron className="catalog-mobile-category-item__chevron" />
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
                    setIsMobileSortOpen(false);
                    setIsMobilePriceOpen((prev) => !prev);
                  }}
                >
                  <span>СТОИМОСТЬ</span>
                  <CatalogChevron className={`catalog-mobile-filter__chevron ${isMobilePriceOpen ? 'is-open' : ''}`} />
                </button>

                {isMobilePriceOpen && (
                  <div
                    className="catalog-mobile-price-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Фильтр по цене"
                  >
                    <div className="catalog-mobile-price-modal__row">
                      <label className="catalog-mobile-price-modal__field">
                        <span>ОТ</span>
                        <input
                          className="catalog-price-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={priceRange.min != null ? String(Math.floor(priceRange.min)) : '0'}
                          value={priceFrom}
                          onChange={handlePriceFromChange}
                          onKeyDown={(event) => {
                            if (!isPriceKeyAllowed(event)) event.preventDefault();
                          }}
                        />
                      </label>

                      <label className="catalog-mobile-price-modal__field">
                        <span>ДО</span>
                        <input
                          className="catalog-price-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={priceRange.max != null ? String(Math.ceil(priceRange.max)) : '0'}
                          value={priceTo}
                          onChange={handlePriceToChange}
                          onKeyDown={(event) => {
                            if (!isPriceKeyAllowed(event)) event.preventDefault();
                          }}
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

              <div className="catalog-mobile-filter catalog-mobile-filter--sort">
                <button
                  type="button"
                  className="catalog-mobile-filter__icon-button"
                  aria-label="Открыть фильтры сортировки"
                  onClick={() => {
                    if (mobileCategoryDetailsRef.current?.open) {
                      mobileCategoryDetailsRef.current.open = false;
                      setIsMobileCategoryOpen(false);
                    }
                    setIsMobilePriceOpen(false);
                    setIsMobileSortOpen((prev) => !prev);
                  }}
                >
                  <CatalogFilterButtonIcon className="catalog-mobile-filter__icon-svg" />
                </button>

                {isMobileSortOpen && (
                  <div
                    className="catalog-mobile-sort-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Фильтры сортировки"
                  >
                    <button
                      type="button"
                      className={`catalog-mobile-sort-option ${sortBy === 'popular' ? 'is-active' : ''}`}
                      onClick={() => {
                        setSortBy('popular');
                        setIsMobileSortOpen(false);
                      }}
                    >
                      ПО ПОПУЛЯРНОСТИ
                    </button>
                    <button
                      type="button"
                      className={`catalog-mobile-sort-option ${sortBy === 'price_asc' ? 'is-active' : ''}`}
                      onClick={() => {
                        setSortBy('price_asc');
                        setIsMobileSortOpen(false);
                      }}
                    >
                      СНАЧАЛА ДЕШЕВЫЕ
                    </button>
                    <button
                      type="button"
                      className={`catalog-mobile-sort-option ${sortBy === 'price_desc' ? 'is-active' : ''}`}
                      onClick={() => {
                        setSortBy('price_desc');
                        setIsMobileSortOpen(false);
                      }}
                    >
                      СНАЧАЛА ДОРОГИЕ
                    </button>
                    <button
                      type="button"
                      className={`catalog-mobile-sort-option ${sortBy === 'new' ? 'is-active' : ''}`}
                      onClick={() => {
                        setSortBy('new');
                        setIsMobileSortOpen(false);
                      }}
                    >
                      НОВИНКИ
                    </button>
                    <label className="catalog-mobile-sort-stock">
                      <input
                        type="checkbox"
                        checked={onlyInStock}
                        onChange={(event) => {
                          setOnlyInStock(event.target.checked);
                          const nextParams = new URLSearchParams(searchParams);
                          if (event.target.checked) {
                            nextParams.set('in_stock', 'true');
                          } else {
                            nextParams.delete('in_stock');
                          }
                          setSearchParams(nextParams, { replace: true });
                        }}
                      />
                      В НАЛИЧИИ
                    </label>
                  </div>
                )}
              </div>

              {(selectedParents.length > 0 || selectedSubcategories.length > 0 || priceFrom || priceTo || onlyInStock) && (
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
                  {onlyInStock && (
                    <button
                      type="button"
                      className="catalog-mobile-selected-tag"
                      onClick={() => {
                        setOnlyInStock(false);
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete('in_stock');
                        setSearchParams(nextParams, { replace: true });
                      }}
                    >
                      ТОЛЬКО В НАЛИЧИИ ×
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
                {onlyInStock && (
                  <button
                    key="in-stock-tag"
                    type="button"
                    className="catalog-tag"
                    onClick={() => {
                      setOnlyInStock(false);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete('in_stock');
                      setSearchParams(nextParams, { replace: true });
                    }}
                  >
                    Только в наличии ×
                  </button>
                )}
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
                  className="page-btn page-btn--load-more btn-secondary-outline"
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
