import React, { useState } from 'react'; // Добавляем useState
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  // Состояние для хранения количества товара
  const [quantity, setQuantity] = useState(1);

  // Функции для изменения количества
  const handleIncrease = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrease = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1)); // Не даем опуститься ниже 1
  };

  const handleAddToCart = () => {
    alert(`Добавлено ${quantity} шт. товара "${product.name}" в корзину`);
    // Здесь позже будет вызов addToCart(product, quantity) из контекста
  };

  return (
    <div className="product-card">
      <div className="product-card__badges">
        {product.isNew && <span className="badge badge--new">новинка</span>}
        {product.discount && <span className="badge badge--discount">– {product.discount}%</span>}
      </div>
      
      <Link to={`/product/${product.id}`} className="product-card__image-wrapper">
        <img src={product.image} alt={product.name} className="product-card__image" />
      </Link>
      
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
          
          <div className="product-card__price">{product.price.toLocaleString('ru-RU')} ₽</div>
        </div>
        
        <button className="product-card__cart-btn" onClick={handleAddToCart}>
          В КОРЗИНУ
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
