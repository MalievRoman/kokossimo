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

  // Загрузка товаров
  useEffect(() => {
    setLoading(true);
    const params = {};
    
    // Фильтр по категории из URL (имеет приоритет)
    const categoryFilter = searchParams.get('filter');
    if (categoryFilter === 'bestsellers') {
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

    getProducts(params)
      .then(response => {
        let data = Array.isArray(response.data) ? response.data : (response.data.results || []);
        
        // Сортировка
        if (sortBy === 'price_asc') {
          data = [...data].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortBy === 'price_desc') {
          data = [...data].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortBy === 'new') {
          data = [...data].filter(p => p.is_new).concat(data.filter(p => !p.is_new));
        }
        // 'popular' - оставляем как есть (можно добавить поле popularity в будущем)
        
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

  return (
    <div className="catalog-page page-animation">
      <div className="container">
        
        {/* Хлебные крошки (Breadcrumbs) */}
        <div className="breadcrumbs">
          <span>Главная</span> / <span>Каталог</span>
        </div>

        <h1 className="page-title">КАТАЛОГ ТОВАРОВ</h1>

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
                <input type="number" placeholder="от 0" />
                <span className="dash">—</span>
                <input type="number" placeholder="до 50000" />
              </div>
            </div>

            <div className="filter-group">
              <h3 className="filter-title">Бренды</h3>
              <ul className="filter-list">
                <li><label><input type="checkbox" /> Manyo</label></li>
                <li><label><input type="checkbox" /> Medi-Peel</label></li>
                <li><label><input type="checkbox" /> Dr.Jart+</label></li>
              </ul>
            </div>

            <button 
              className="apply-filters-btn"
              onClick={() => {
                setSelectedCategories([]);
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
