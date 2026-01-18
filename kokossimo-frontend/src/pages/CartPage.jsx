import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './CartPage.css';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  // Обработка URL изображения
  const getImageUrl = (image) => {
    if (!image) return 'https://placehold.co/150x150/F5E6D3/8B4513?text=No+Image';
    if (image.startsWith('http')) return image;
    return `http://127.0.0.1:8000${image.startsWith('/') ? image : `/${image}`}`;
  };

  const isAuthenticated = Boolean(localStorage.getItem('authToken'));

  const getProductLink = (item) => (!item.is_gift_certificate ? `/product/${item.id}` : null);

  return (
    <div className="cart-page page-animation">
      <div className="container">
        {/* Хлебные крошки */}
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Корзина</span>
        </div>

        <h1 className="page-title">КОРЗИНА</h1>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag size={64} />
            <h2>Ваша корзина пуста</h2>
            <p>Добавьте товары из каталога</p>
            <Link to="/catalog" className="btn-primary">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            {/* Список товаров */}
            <div className="cart-items">
              <div className="cart-items__header">
                <h2>Товары в корзине ({cartItems.length})</h2>
                <button
                  className="btn-secondary btn-secondary--outline"
                  onClick={clearCart}
                >
                  Очистить корзину
                </button>
              </div>

              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  {item.image ? (
                    getProductLink(item) ? (
                      <Link to={getProductLink(item)} className="cart-item__image">
                        <img src={getImageUrl(item.image)} alt={item.name} />
                      </Link>
                    ) : (
                      <div className="cart-item__image">
                        <img src={getImageUrl(item.image)} alt={item.name} />
                      </div>
                    )
                  ) : (
                    <div className="cart-item__image cart-item__image--gift">
                      <span>Подарочный сертификат</span>
                    </div>
                  )}
                  
                  <div className="cart-item__info">
                    {getProductLink(item) ? (
                      <Link to={getProductLink(item)} className="cart-item__name">
                        {item.name}
                      </Link>
                    ) : (
                      <h3 className="cart-item__name">{item.name}</h3>
                    )}
                    <div className="cart-item__price">
                      {item.price.toLocaleString('ru-RU')} ₽ за шт.
                    </div>
                  </div>

                  <div className="cart-item__quantity">
                    <button
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="cart-item__total">
                    {(item.price * item.quantity).toLocaleString('ru-RU')} ₽
                  </div>

                  <button
                    className="cart-item__remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label="Удалить товар"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Итого */}
            <div className="cart-summary">
              <h2>Итого</h2>
              <div className="cart-summary__row">
                <span>Товаров:</span>
                <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} шт.</span>
              </div>
              <div className="cart-summary__row cart-summary__total">
                <span>К оплате:</span>
                <span>{getTotalPrice().toLocaleString('ru-RU')} ₽</span>
              </div>
              
              <Link
                to={isAuthenticated ? '/checkout' : '/auth'}
                className="btn-primary btn-primary--full"
              >
                Оформить заказ
              </Link>
              
              <Link to="/catalog" className="btn-link btn-link--center">
                Продолжить покупки
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
