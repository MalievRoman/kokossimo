import React, { useState } from 'react';
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

  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  
  const favorite = isFavorite(product.id);

  // Функции для изменения количества
  const handleIncrease = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrease = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1)); // Не даем опуститься ниже 1
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000); // Сбрасываем сообщение через 2 секунды
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
        
        <div className="product-card__controls">
          <div className="quantity-selector">
            {/* Кнопка МИНУС */}
            <button 
              className="quantity-btn" 
              onClick={handleDecrease}
              disabled={quantity <= 1} // Блокируем, если 1
            >
              <Minus size={16} />
            </button>
            
            {/* Отображаем текущее число */}
            <span className="quantity">{quantity}</span>
            
            {/* Кнопка ПЛЮС */}
            <button 
              className="quantity-btn" 
              onClick={handleIncrease}
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="product-card__price">
            {price > 0 ? `${price.toLocaleString('ru-RU')} ₽` : 'Цена не указана'}
          </div>
        </div>
        
        <button 
          className={`product-card__cart-btn ${added ? 'added' : ''}`} 
          onClick={handleAddToCart}
        >
          {added ? '✓ ДОБАВЛЕНО' : 'В КОРЗИНУ'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
