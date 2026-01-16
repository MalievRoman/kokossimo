import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { getProducts, getCategories } from '../services/api';
import { Filter } from 'lucide-react';
import './CatalogPage.css';

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [loading, setLoading] = useState(true);

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
    const minPrice = searchParams.get('price_min');
    const maxPrice = searchParams.get('price_max');
    if (searchQuery) {
      // Поиск имеет приоритет над фильтрами категорий
      params.page = undefined;
    } else if (categoryFilter === 'bestsellers') {
      params.is_bestseller = 'true';
    } else if (categoryFilter === 'new') {
      params.is_new = 'true';
    } else if (categoryFilter) {
      params.category = categoryFilter;
    } else if (selectedCategories.length > 0) {
      // Если нет фильтра в URL, используем выбранные категории
      // Пока берем первую категорию (можно расширить для множественного выбора)
      params.category = selectedCategories[0];
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

  const handleCategoryChange = (categorySlug) => {
    setSelectedCategories(prev => 
      prev.includes(categorySlug) 
        ? prev.filter(slug => slug !== categorySlug)
        : [...prev, categorySlug]
    );
  };

  const applyFilters = () => {
    const nextParams = {};
    if (selectedCategories.length > 0) {
      nextParams.filter = selectedCategories[0];
    }
    if (priceFrom) nextParams.price_min = priceFrom;
    if (priceTo) nextParams.price_max = priceTo;
    if (searchParams.get('q')) {
      nextParams.q = searchParams.get('q');
    }
    setSearchParams(nextParams);
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
          
          {/* БОКОВАЯ ПАНЕЛЬ ФИЛЬТРОВ (Sidebar) */}
          <aside className={`catalog-sidebar ${isFilterOpen ? 'open' : ''}`}>
            <div className="filter-group">
              <h3 className="filter-title">Категории</h3>
              <ul className="filter-list">
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
            </div>

            <div className="filter-group">
              <h3 className="filter-title">Цена, ₽</h3>
              <div className="price-inputs">
                <input
                  type="number"
                  placeholder="от 0"
                  value={priceFrom}
                  onChange={(event) => setPriceFrom(event.target.value)}
                />
                <span className="dash">—</span>
                <input
                  type="number"
                  placeholder="до 50000"
                  value={priceTo}
                  onChange={(event) => setPriceTo(event.target.value)}
                />
              </div>
            </div>

            <button
              className="apply-filters-btn"
              onClick={applyFilters}
            >
              ПРИМЕНИТЬ ФИЛЬТРЫ
            </button>

            <button 
              className="apply-filters-btn"
              onClick={() => {
                setSelectedCategories([]);
                setPriceFrom('');
                setPriceTo('');
                setSearchParams({});
              }}
            >
              СБРОСИТЬ ФИЛЬТРЫ
            </button>
          </aside>

          {/* ОСНОВНОЙ КОНТЕНТ */}
          <div className="catalog-content">
            
            {/* Верхняя панель управления */}
            <div className="catalog-controls">
              <button 
                className="mobile-filter-btn" 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter size={18} /> Фильтры
              </button>

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
