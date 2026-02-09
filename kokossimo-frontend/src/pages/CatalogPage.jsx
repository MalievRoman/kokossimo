import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getCategories } from '../services/api';
import { ChevronDown } from 'lucide-react';
import './CatalogPage.css';

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [openFilter, setOpenFilter] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [priceError, setPriceError] = useState('');
  const [loading, setLoading] = useState(true);
  const categoryMenuRef = useRef(null);
  const priceMenuRef = useRef(null);

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

  // Загрузка товаров
  useEffect(() => {
    setLoading(true);
    const searchQuery = normalizeText(searchParams.get('q') || '');
    const params = {};
    
    // Фильтр по категории из URL (имеет приоритет)
    const categoryFilter = searchParams.get('filter');
    // Получаем все категории из URL параметра category (может быть несколько)
    const categoryFiltersFromUrl = searchParams.getAll('category');
    let minPrice = searchParams.get('price_min');
    let maxPrice = searchParams.get('price_max');
    // Игнорируем отрицательные значения — не показываем "Товары не найдены" из-за некорректного ввода
    if (minPrice != null && minPrice !== '' && parseFloat(minPrice) < 0) minPrice = null;
    if (maxPrice != null && maxPrice !== '' && parseFloat(maxPrice) < 0) maxPrice = null;
    
    // Определяем категории для фильтрации
    let categoriesToFilter = [];
    if (categoryFiltersFromUrl.length > 0) {
      categoriesToFilter = categoryFiltersFromUrl;
    } else if (categoryFilter && categoryFilter !== 'bestsellers' && categoryFilter !== 'new') {
      // Поддержка старого формата с параметром filter (для обратной совместимости)
      categoriesToFilter = [categoryFilter];
    } else if (selectedCategories.length > 0) {
      categoriesToFilter = selectedCategories;
    }
    
    if (searchQuery) {
      // При поиске также передаем фильтры категорий в API
      params.page = undefined;
      if (categoriesToFilter.length > 0) {
        params.category = categoriesToFilter;
      }
    } else if (categoryFilter === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (categoryFilter === 'new') {
      params.is_new = 'true';
    } else if (categoriesToFilter.length > 0) {
      // Используем категории из URL параметра category
      params.category = categoriesToFilter;
    }
    if (minPrice) params.price_min = minPrice;
    if (maxPrice) params.price_max = maxPrice;

    getProducts(params)
      .then(response => {
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
        setCatalogProducts([]);
        setLoading(false);
      });
  }, [searchParams, selectedCategories, sortBy]);

  useEffect(() => {
    if (!openFilter) return;
    const handleOutsideClick = (event) => {
      if (categoryMenuRef.current?.contains(event.target)) return;
      if (priceMenuRef.current?.contains(event.target)) return;
      setOpenFilter(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openFilter]);

  const handleCategoryChange = (categorySlug) => {
    setSelectedCategories(prev => 
      prev.includes(categorySlug) 
        ? prev.filter(slug => slug !== categorySlug)
        : [...prev, categorySlug]
    );
  };

  const applyFilters = () => {
    setPriceError('');
    let fromVal = priceFrom.trim();
    let toVal = priceTo.trim();
    const fromNum = fromVal === '' ? null : parseFloat(fromVal);
    const toNum = toVal === '' ? null : parseFloat(toVal);
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
    const value = event.target.value;
    if (value === '' || value === '-') {
      setPriceFrom(value);
      return;
    }
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num < 0) {
      setPriceFrom('0');
      return;
    }
    setPriceFrom(value);
  };

  const handlePriceToChange = (event) => {
    const value = event.target.value;
    if (value === '' || value === '-') {
      setPriceTo(value);
      return;
    }
    const num = parseFloat(value);
    if (!Number.isNaN(num) && num < 0) {
      setPriceTo('0');
      return;
    }
    setPriceTo(value);
  };

  return (
    <div className="catalog-page page-animation">
      <div className="container">
        
        {/* Хлебные крошки (Breadcrumbs) */}
        <div className="breadcrumbs">
          <span>Главная</span> / <span>Каталог</span>
        </div>

        <h1 className="page-title">КАТАЛОГ ТОВАРОВ</h1>
        {searchParams.get('q') && (
          <div style={{ marginTop: '0.5rem', color: '#6b5a58' }}>
            Результаты по запросу: «{searchParams.get('q')}»
          </div>
        )}

        <div className="catalog-layout">

          {/* ОСНОВНОЙ КОНТЕНТ */}
          <div className="catalog-content">
            
            {/* Верхняя панель управления */}
            <div className="catalog-controls">
              <div className="catalog-filters">
                <div className="catalog-filter" ref={categoryMenuRef}>
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    onClick={() =>
                      setOpenFilter(openFilter === 'categories' ? null : 'categories')
                    }
                    aria-expanded={openFilter === 'categories'}
                    aria-haspopup="true"
                  >
                    Категории
                    {selectedCategories.length > 0 && (
                      <span className="catalog-filter-count">{selectedCategories.length}</span>
                    )}
                    <ChevronDown size={16} />
                  </button>
                  <div
                    className={`catalog-filter-menu ${openFilter === 'categories' ? 'is-open' : ''}`}
                  >
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
                  </div>
                </div>

                <div className="catalog-filter" ref={priceMenuRef}>
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    onClick={() => setOpenFilter(openFilter === 'price' ? null : 'price')}
                    aria-expanded={openFilter === 'price'}
                    aria-haspopup="true"
                  >
                    Цена
                    {(priceFrom || priceTo) && <span className="catalog-filter-count">1</span>}
                    <ChevronDown size={16} />
                  </button>
                  <div
                    className={`catalog-filter-menu ${openFilter === 'price' ? 'is-open' : ''}`}
                  >
                    <div className="catalog-filter-price">
                      <input
                        type="number"
                        min={0}
                        placeholder="от 0"
                        value={priceFrom}
                        onChange={handlePriceFromChange}
                      />
                      <span className="dash">—</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="до 50000"
                        value={priceTo}
                        onChange={handlePriceToChange}
                      />
                    </div>
                    {priceError && (
                      <p className="catalog-filter-price-error" role="alert">
                        {priceError}
                      </p>
                    )}
                  </div>
                </div>

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

              <div className="sort-wrapper">
                <span className="sort-label">Сортировка:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="popular">По популярности</option>
                  <option value="price_asc">Сначала дешевые</option>
                  <option value="price_desc">Сначала дорогие</option>
                  <option value="new">Новинки</option>
                </select>
                {!loading && (
                  <span style={{ marginLeft: '15px', fontSize: '14px', color: '#666' }}>
                    Найдено товаров: {catalogProducts.length}
                  </span>
                )}
              </div>
            </div>

            {/* Сетка товаров */}
            <div className="catalog-grid">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
                  <p>Загрузка товаров...</p>
                </div>
              ) : catalogProducts.length > 0 ? (
                catalogProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
                  <p>Товары не найдены</p>
                  {searchParams.get('q') && (
                    <p style={{ marginTop: '8px', color: '#8b7b78' }}>
                      По запросу «{searchParams.get('q')}» ничего не найдено
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Пагинация - пока скрыта, можно добавить позже */}
            {catalogProducts.length > 0 && (
              <div className="pagination">
                <button className="page-btn active">1</button>
                {/* Пагинация будет добавлена позже при необходимости */}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
