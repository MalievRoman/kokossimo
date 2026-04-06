import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { resolveMediaUrl } from '../utils/media';
import './CartPage.css';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalItems, getTotalPrice, refreshCart } = useCart();
  const location = useLocation();
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSyncError('');
    Promise.resolve(refreshCart()).catch(() => {
      if (cancelled) return;
      setSyncError('Не удалось обновить корзину. Проверьте подключение и попробуйте ещё раз.');
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCart]);

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  // Обработка URL изображения
  const getImageUrl = (image) => {
    return resolveMediaUrl(image, 'https://placehold.co/150x150/F5E6D3/8B4513?text=No+Image');
  };

  const isAuthenticated = Boolean(localStorage.getItem('authToken'));

  const getProductLink = (item) => (!item.is_gift_certificate ? `/product/${item.id}` : null);
  const formatRub = (value) => `${Number(value).toLocaleString('ru-RU')} ₽`;

  const unavailableItems = useMemo(
    () => cartItems.filter((item) => item.stock != null && Number(item.stock) <= 0),
    [cartItems]
  );
  const hasUnavailable = unavailableItems.length > 0;
  const unavailableHint = hasUnavailable
    ? `Некоторые товары недоступны: ${unavailableItems.map((i) => i.name).filter(Boolean).slice(0, 2).join(', ')}${
        unavailableItems.length > 2 ? '…' : ''
      }`
    : '';

  return (
    <div className="cart-page page-animation">
      <div className="container">
        {/* Хлебные крошки */}
        <div className="breadcrumbs">
          <Link to="/">ГЛАВНАЯ</Link> <span>— КОРЗИНА</span>
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
            <div className="cart-layout__left">
              {syncError ? <div className="cart-sync-error">{syncError}</div> : null}
              {hasUnavailable ? (
                <div className="cart-sync-warning" role="status">
                  {unavailableHint || 'Некоторые товары сейчас нет в наличии. Удалите их, чтобы оформить заказ.'}
                </div>
              ) : null}
              <div className="cart-items__top">
                <h2 className="cart-items__count">
                  ТОВАРОВ В КОРЗИНЕ: {getTotalItems()}
                </h2>
                <button
                  type="button"
                  className="cart-items__clear"
                  onClick={clearCart}
                >
                  ОЧИСТИТЬ
                </button>
              </div>

              {/* Список товаров */}
              <div className="cart-items">
                <div className="cart-items__list">
              {cartItems.map((item) => {
                const isUnavailable = item.stock != null && Number(item.stock) <= 0;
                const hasDiscount =
                  Number.isFinite(Number(item.discount)) &&
                  Number(item.discount) > 0 &&
                  Number(item.discount) < 100;
                const discount = hasDiscount ? Number(item.discount) : 0;
                const oldUnitPrice = hasDiscount
                  ? Math.round(item.price / (1 - discount / 100))
                  : null;
                const oldTotalPrice = oldUnitPrice ? oldUnitPrice * item.quantity : null;

                const productUrl = getProductLink(item);
                const ItemWrapper = productUrl ? Link : 'div';
                const itemWrapperProps = productUrl ? { to: productUrl, className: 'cart-item cart-item--clickable' } : { className: 'cart-item' };

                return (
                  <ItemWrapper
                    key={item.id}
                    {...itemWrapperProps}
                    aria-disabled={isUnavailable || undefined}
                    className={`${itemWrapperProps.className}${isUnavailable ? ' cart-item--unavailable' : ''}`}
                  >
                    {item.image ? (
                      <div className="cart-item__image">
                        <img src={getImageUrl(item.image)} alt={item.name} />
                      </div>
                    ) : (
                      <div className="cart-item__image cart-item__image--gift">
                        <span>Подарочный сертификат</span>
                      </div>
                    )}

                    <div className="cart-item__info">
                      <h3 className="cart-item__name">{item.name}</h3>
                      {isUnavailable ? <div className="cart-item__badge">Нет в наличии</div> : null}
                      <div className="cart-item__price">
                        {hasDiscount && oldUnitPrice ? (
                          <>
                            <span className="cart-item__price-current">{formatRub(item.price)} за шт.</span>
                            <span className="cart-item__price-old">{formatRub(oldUnitPrice)}</span>
                            <span className="cart-item__price-discount">−{discount}%</span>
                          </>
                        ) : (
                          <span className="cart-item__price-current">{formatRub(item.price)} за шт.</span>
                        )}
                      </div>
                    </div>

                    <div
                      className="cart-item__quantity"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="group"
                      aria-label="Изменить количество"
                    >
                      <button
                        type="button"
                        className="quantity-btn"
                        disabled={isUnavailable}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuantityChange(item.id, item.quantity - 1);
                        }}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        type="button"
                        className="quantity-btn"
                        disabled={isUnavailable}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuantityChange(item.id, item.quantity + 1);
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="cart-item__total">
                      <div className="cart-item__total-current">
                        {isUnavailable ? '—' : formatRub(item.price * item.quantity)}
                      </div>
                      {hasDiscount && oldTotalPrice ? (
                        <div className="cart-item__total-old">{formatRub(oldTotalPrice)}</div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="cart-item__remove"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFromCart(item.id);
                      }}
                      aria-label={isUnavailable ? 'Удалить недоступный товар' : 'Удалить товар'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </ItemWrapper>
                );
              })}
              </div>
            </div>
            </div>

            {/* Сумма заказа */}
            <div className="cart-summary">
              <h2 className="cart-summary__title">СУММА ЗАКАЗА</h2>
              <div className="cart-summary__row">
                <span>Товаров:</span>
                <span>{getTotalItems()} шт</span>
              </div>
              <div className="cart-summary__divider" />
              <div className="cart-summary__row cart-summary__total">
                <span>Итого:</span>
                <span>{formatRub(getTotalPrice())}</span>
              </div>

              {hasUnavailable ? (
                <button type="button" className="cart-summary__submit cart-summary__submit--disabled" disabled>
                  К ОФОРМЛЕНИЮ
                </button>
              ) : (
                <Link
                  to={isAuthenticated ? '/checkout' : '/auth'}
                  state={isAuthenticated ? { backgroundLocation: location } : undefined}
                  className="cart-summary__submit"
                >
                  К ОФОРМЛЕНИЮ
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
