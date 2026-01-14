import React, { useState, useEffect } from 'react';
import ProductCard from '../components/product/ProductCard';
import { products } from '../data/products'; // Пока берем те же тестовые данные
import { Filter, ChevronDown } from 'lucide-react';
import './CatalogPage.css';

const CatalogPage = () => {
  const [sortBy, setSortBy] = useState('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false); // Для мобильных

  // В реальности здесь был бы запрос к API с параметрами фильтров
  // const [catalogProducts, setCatalogProducts] = useState([]);

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
                <li><label><input type="checkbox" /> Уход за лицом</label></li>
                <li><label><input type="checkbox" /> Уход за телом</label></li>
                <li><label><input type="checkbox" /> Защита от солнца</label></li>
                <li><label><input type="checkbox" /> Макияж</label></li>
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

            <button className="apply-filters-btn">ПРИМЕНИТЬ</button>
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
              </div>
            </div>

            {/* Сетка товаров */}
            <div className="catalog-grid">
              {/* Дублируем товары чтобы заполнить сетку для вида */}
              {[...products, ...products, ...products].map((product, index) => (
                <ProductCard key={`${product.id}-${index}`} product={product} />
              ))}
            </div>

            {/* Пагинация */}
            <div className="pagination">
              <button className="page-btn active">1</button>
              <button className="page-btn">2</button>
              <button className="page-btn">3</button>
              <span className="dots">...</span>
              <button className="page-btn">10</button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
