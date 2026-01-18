import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Heart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  // Защита от отсутствия данных
  if (!product) {
    return null;
  }

  const { addToCart, updateQuantity, removeFromCart, cartItems } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const favorite = isFavorite(product.id);
  const cartItem = cartItems.find((item) => item.id === product.id);
  const cartQuantity = cartItem?.quantity || 0;

  // Функции для изменения количества
  const handleIncrease = () => {
    updateQuantity(product.id, cartQuantity + 1);
  };

  const handleDecrease = () => {
    if (cartQuantity <= 1) {
      removeFromCart(product.id);
      return;
    }
    updateQuantity(product.id, cartQuantity - 1);
  };

  const handleAddToCart = () => {
    addToCart(product, 1);
  };

  // Обработка данных из API: преобразуем формат
  const isNew = product.is_new || product.isNew || false;
  const discount = product.discount || 0;
  
  // Цена может быть строкой или числом
  let price = 0;
  try {
    if (typeof product.price === 'string') {
      price = parseFloat(product.price);
    } else if (typeof product.price === 'number') {
      price = product.price;
    }
    if (isNaN(price)) {
      price = 0;
    }
  } catch (e) {
    price = 0;
  }
  
  // URL изображения: если это относительный путь, добавляем базовый URL бэкенда
  let imageUrl = 'https://placehold.co/400x400/F5E6D3/8B4513?text=No+Image';
  try {
    if (product.image) {
      if (typeof product.image === 'string') {
        if (product.image.startsWith('http')) {
          imageUrl = product.image;
        } else {
          // Убираем лишний слэш в начале, если есть
          const cleanPath = product.image.startsWith('/') ? product.image : `/${product.image}`;
          imageUrl = `http://127.0.0.1:8000${cleanPath}`;
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибки обработки изображения
  }

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  };

  const isGiftCertificate = product.is_gift_certificate;

  return (
    <div className="product-card">
      <div className="product-card__badges">
        {isNew && <span className="badge badge--new">новинка</span>}
        {discount > 0 && <span className="badge badge--discount">– {discount}%</span>}
      </div>
      
      {!isGiftCertificate && (
        <div className="product-card__image-container">
          <Link to={`/product/${product.id}`} className="product-card__image-wrapper">
            <img src={imageUrl} alt={product.name} className="product-card__image" />
          </Link>
          <button
            className={`product-card__favorite ${favorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}
      {isGiftCertificate && (
        <div className="product-card__image-container product-card__image-container--gift">
          <div className="product-card__gift-label">Подарочный сертификат</div>
          <button
            className={`product-card__favorite ${favorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}
      
      <div className="product-card__content">
        <Link to={`/product/${product.id}`} className="product-card__title">
          {product.name}
        </Link>
        <p className="product-card__description">{product.description}</p>
        <div className="product-card__price">
          {price > 0 ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
        </div>

        <div className="product-card__controls">
          {cartQuantity > 0 ? (
            <div className="quantity-selector">
              <button className="quantity-btn" onClick={handleDecrease}>
                <Minus size={16} />
              </button>
              <span className="quantity">{cartQuantity}</span>
              <button className="quantity-btn" onClick={handleIncrease}>
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button className="product-card__cart-btn" onClick={handleAddToCart}>
              В КОРЗИНУ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
