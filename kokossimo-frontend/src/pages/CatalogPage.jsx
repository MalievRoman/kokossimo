import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getCategories } from '../services/api';
import { useCatalogFilters } from '../context/CatalogFiltersContext';
import checkboxSelectionIcon from '../assets/icons/checkbox_selection.svg';
import tagCloseIcon from '../assets/icons/tag_close.svg';
import './CatalogPage.css';

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

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [baseProducts, setBaseProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [priceBounds, setPriceBounds] = useState({ min: null, max: null });
  const [loading, setLoading] = useState(true);
  const catalogFiltersContext = useCatalogFilters();
  const searchQueryParam = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter') || '';

  // Синхронизация выбранных фильтров в контекст (чтобы поиск в шапке их сохранял)
  useEffect(() => {
    if (catalogFiltersContext) {
      catalogFiltersContext.setSelectedCategories(selectedCategories);
      catalogFiltersContext.setPriceMin(priceFrom);
      catalogFiltersContext.setPriceMax(priceTo);
    }
  }, [selectedCategories, priceFrom, priceTo, catalogFiltersContext]);

  // Загрузка категорий и ценовых границ
  useEffect(() => {
    getCategories()
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setCategories(data);
      })
      .catch(() => {
        setCategories([]);
      });

    getProducts({})
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        const prices = data
          .map((item) => parseFloat(item.price))
          .filter((value) => Number.isFinite(value));

        if (!prices.length) {
          setPriceBounds({ min: null, max: null });
          return;
        }

        setPriceBounds({
          min: Math.min(...prices),
          max: Math.max(...prices),
        });
      })
      .catch(() => {
        setPriceBounds({ min: null, max: null });
      });
  }, []);

  // Синхронизация фильтров из URL
  useEffect(() => {
    const categoryFiltersFromUrl = searchParams.getAll('category');
    const categoryFilter = searchParams.get('filter');
    const nextCategories = categoryFiltersFromUrl.length > 0
      ? categoryFiltersFromUrl
      : (categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new')
        ? [categoryFilter]
        : [];
    const minPriceFromUrl = searchParams.get('price_min') || '';
    const maxPriceFromUrl = searchParams.get('price_max') || '';

    const syncTimer = window.setTimeout(() => {
      setSelectedCategories(nextCategories);
      setPriceFrom(minPriceFromUrl);
      setPriceTo(maxPriceFromUrl);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [searchParams]);

  // Загрузка каталога
  useEffect(() => {
    let isCancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!isCancelled) setLoading(true);
    }, 0);
    const searchQuery = normalizeText(searchQueryParam);
    const params = {};

    if (filterParam === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (filterParam === 'new') {
      params.is_new = 'true';
    }

    getProducts(params)
      .then((response) => {
        if (isCancelled) return;
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
        }

        setBaseProducts(data);
        setLoading(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setBaseProducts([]);
        setLoading(false);
      });
    return () => {
      isCancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [searchQueryParam, filterParam]);

  const catalogProducts = useMemo(() => {
    let data = [...baseProducts];

    if (selectedCategories.length > 0) {
      data = data.filter(
        (item) => item.category_slug && selectedCategories.includes(item.category_slug)
      );
    }

    const minVal = priceFrom.trim() ? parseFloat(priceFrom) : null;
    const maxVal = priceTo.trim() ? parseFloat(priceTo) : null;

    if (Number.isFinite(minVal) || Number.isFinite(maxVal)) {
      data = data.filter((item) => {
        const value = parseFloat(item.price);
        if (!Number.isFinite(value)) return false;
        if (Number.isFinite(minVal) && value < minVal) return false;
        if (Number.isFinite(maxVal) && value > maxVal) return false;
        return true;
      });
    }

    if (sortBy === 'price_asc') {
      data.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortBy === 'price_desc') {
      data.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (sortBy === 'new') {
      data = [...data].filter((p) => p.is_new).concat(data.filter((p) => !p.is_new));
    }

    return data;
  }, [baseProducts, selectedCategories, priceFrom, priceTo, sortBy]);

  const buildNextSearchParams = (nextCategories, nextPriceFrom, nextPriceTo) => {
    const next = new URLSearchParams();

    const q = searchParams.get('q');
    const filter = searchParams.get('filter');
    if (q) next.set('q', q);
    if (filter) next.set('filter', filter);

    nextCategories.forEach((slug) => next.append('category', slug));
    if (nextPriceFrom) next.set('price_min', nextPriceFrom);
    if (nextPriceTo) next.set('price_max', nextPriceTo);

    return next;
  };

  const handleCategoryChange = (categorySlug) => {
    const nextCategories = selectedCategories.includes(categorySlug)
      ? selectedCategories.filter((slug) => slug !== categorySlug)
      : [...selectedCategories, categorySlug];

    setSelectedCategories(nextCategories);
    setSearchParams(buildNextSearchParams(nextCategories, priceFrom, priceTo), { replace: true });
  };

  const handleRemoveTag = (categorySlug) => {
    const nextCategories = selectedCategories.filter((slug) => slug !== categorySlug);
    setSelectedCategories(nextCategories);
    setSearchParams(buildNextSearchParams(nextCategories, priceFrom, priceTo), { replace: true });
  };

  const handlePriceFromChange = (event) => {
    const value = event.target.value;
    if (!/^\d*$/.test(value)) return;
    setPriceFrom(value);
    setSearchParams(buildNextSearchParams(selectedCategories, value, priceTo), { replace: true });
  };

  const handlePriceToChange = (event) => {
    const value = event.target.value;
    if (!/^\d*$/.test(value)) return;
    setPriceTo(value);
    setSearchParams(buildNextSearchParams(selectedCategories, priceFrom, value), { replace: true });
  };

  const selectedCategoryTags = selectedCategories
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter(Boolean);

  const minPlaceholder = Number.isFinite(priceBounds.min)
    ? `от ${Math.round(priceBounds.min).toLocaleString('ru-RU')}`
    : 'от 0';
  const maxPlaceholder = Number.isFinite(priceBounds.max)
    ? `до ${Math.round(priceBounds.max).toLocaleString('ru-RU')}`
    : 'до 0';

  const breadcrumbs = [
    { key: 'home', label: 'ГЛАВНАЯ' },
    { key: 'catalog', label: 'КАТАЛОГ' },
  ];

  return (
    <div className="catalog-page page-animation py-4 py-md-5">
      <div className="container">
        <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.key}>
              <span>{crumb.label}</span>
              {index < breadcrumbs.length - 1 && (
                <span className="catalog-breadcrumbs__separator" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className="catalog-heading-row d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div className="catalog-heading-main d-flex flex-wrap align-items-end">
            <h1 className="catalog-page-title">КАТАЛОГ ТОВАРОВ</h1>
            {selectedCategoryTags.length > 0 && (
              <div className="catalog-selected-tags d-flex flex-wrap align-items-end">
                {selectedCategoryTags.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="catalog-tag"
                    onClick={() => handleRemoveTag(category.slug)}
                    aria-label={`Убрать категорию ${category.name}`}
                  >
                    <span>{category.name}</span>
                    <img src={tagCloseIcon} alt="" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="catalog-sort">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="catalog-sort__select form-select"
              aria-label="Сортировка товаров"
            >
              <option value="popular">ПО ПОПУЛЯРНОСТИ</option>
              <option value="price_asc">СНАЧАЛА ДЕШЕВЫЕ</option>
              <option value="price_desc">СНАЧАЛА ДОРОГИЕ</option>
              <option value="new">НОВИНКИ</option>
            </select>
          </div>
        </div>

        <div className="catalog-body row g-4">
          <aside className="catalog-sidebar col-12 col-xl-3">
            <section className="catalog-filter-section">
              <h2 className="catalog-sidebar-title">КАТЕГОРИИ</h2>
              <ul className="catalog-category-list">
                {categories.map((category) => (
                  <li key={category.id}>
                    <label className="catalog-category-option">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.slug)}
                        onChange={() => handleCategoryChange(category.slug)}
                      />
                      <span className="catalog-category-checkbox" aria-hidden="true">
                        <img src={checkboxSelectionIcon} alt="" />
                      </span>
                      <span className="catalog-category-label">{category.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section className="catalog-filter-section catalog-price-section">
              <h2 className="catalog-sidebar-title">СТОИМОСТЬ</h2>
              <div className="catalog-price-fields d-flex">
                <input
                  type="text"
                  inputMode="numeric"
                  className="catalog-price-input form-control"
                  placeholder={minPlaceholder}
                  value={priceFrom}
                  onChange={handlePriceFromChange}
                  aria-label="Минимальная стоимость"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  className="catalog-price-input form-control"
                  placeholder={maxPlaceholder}
                  value={priceTo}
                  onChange={handlePriceToChange}
                  aria-label="Максимальная стоимость"
                />
              </div>
            </section>
          </aside>

          <section className="catalog-content col-12 col-xl-9">
            <div className="catalog-grid">
              {loading ? (
                <div className="catalog-empty-state">
                  <p>Загрузка товаров...</p>
                </div>
              ) : catalogProducts.length > 0 ? (
                catalogProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <div className="catalog-empty-state">
                  <p>Товары не найдены</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
