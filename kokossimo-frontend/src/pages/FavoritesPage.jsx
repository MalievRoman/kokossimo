import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/product/ProductCard';

const FavoritesPage = () => {
  const { favorites, clearFavorites } = useFavorites();
  const { addToCart } = useCart();

  const handleAddAllToCart = () => {
    favorites.forEach(item => {
      addToCart(item, 1);
    });
  };

  return (
    <div className="page-animation py-4 py-md-5" style={{ minHeight: '60vh' }}>
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Избранное</span>
        </div>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <h1 className="page-title">ИЗБРАННОЕ</h1>
          {favorites.length > 0 && (
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                className="btn btn-outline-primary"
                onClick={handleAddAllToCart}
              >
                Добавить все в корзину
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={clearFavorites}
              >
                Очистить избранное
              </button>
            </div>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-5 px-3" style={{ color: '#666' }}>
            <Heart size={64} style={{ color: '#ccc' }} className="mb-4" />
            <h2 className="h3 mb-2" style={{ color: '#333' }}>Ваш список избранного пуст</h2>
            <p className="mb-4" style={{ color: '#999' }}>Добавляйте товары в избранное, нажимая на иконку сердца</p>
            <Link to="/catalog" className="btn-primary">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2 p-3 mb-4" style={{ background: '#f9f9f9', color: '#666' }}>
              <p>Найдено товаров: <strong>{favorites.length}</strong></p>
            </div>

            <div className="d-grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
