import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/product/ProductCard';
import './FavoritesPage.css';

const FavoritesPage = () => {
  const { favorites, clearFavorites, removeFromFavorites } = useFavorites();
  const { addToCart } = useCart();

  const handleAddAllToCart = () => {
    favorites.forEach(item => {
      addToCart(item, 1);
    });
  };

  return (
    <div className="favorites-page page-animation">
      <div className="container">
        {/* Хлебные крошки */}
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Избранное</span>
        </div>

        <div className="favorites-header">
          <h1 className="page-title">ИЗБРАННОЕ</h1>
          {favorites.length > 0 && (
            <div className="favorites-actions">
              <button 
                className="btn-secondary"
                onClick={handleAddAllToCart}
              >
                Добавить все в корзину
              </button>
              <button 
                className="btn-link"
                onClick={clearFavorites}
              >
                Очистить избранное
              </button>
            </div>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="favorites-empty">
            <Heart size={64} />
            <h2>Ваш список избранного пуст</h2>
            <p>Добавляйте товары в избранное, нажимая на иконку сердца</p>
            <Link to="/catalog" className="btn-primary">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <>
            <div className="favorites-info">
              <p>Найдено товаров: <strong>{favorites.length}</strong></p>
            </div>
            
            <div className="favorites-grid">
              {favorites.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
