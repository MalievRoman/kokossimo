import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ProductSlider from '../components/product/ProductSlider';
import { getBestsellers, getNewProducts, getProducts } from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import './CartPage.css';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const location = useLocation();
  const [recommendationPool, setRecommendationPool] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const extractProducts = (response) => {
      const payload = response?.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.results)) return payload.results;
      return [];
    };

    const loadRecommendations = async () => {
      const collected = [];
      const seen = new Set();
      const sources = [
        () => getBestsellers(),
        () => getNewProducts(),
        () => getProducts({ page: 1, page_size: 12, in_stock: 'true' }),
      ];

      for (const load of sources) {
        try {
          const response = await load();
          const products = extractProducts(response);
          for (const product of products) {
            if (!product?.id || seen.has(product.id)) continue;
            seen.add(product.id);
            collected.push(product);
          }
          if (collected.length >= 12) break;
        } catch {
          // ignore source errors and continue with next recommendation feed
        }
      }

      if (!cancelled) {
        setRecommendationPool(collected.slice(0, 12));
      }
    };

    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const cartProductIds = useMemo(
    () => new Set(cartItems.filter((item) => !item.is_gift_certificate).map((item) => item.id)),
    [cartItems]
  );
  const recommendedProducts = useMemo(() => {
    const filtered = recommendationPool.filter((product) => !cartProductIds.has(product.id));
    return filtered.length > 0 ? filtered : recommendationPool;
  }, [recommendationPool, cartProductIds]);

  const getProductLink = (item) => (!item.is_gift_certificate ? `/product/${item.id}` : null);
  const formatRub = (value) => `${Number(value).toLocaleString('ru-RU')} ₽`;

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
            <div className="cart-empty__content">
              <h2 className="cart-empty__title">Ваша корзина пока пуста</h2>
              <p className="cart-empty__text">
                Воспользуйтесь поиском, или перейдите сразу в каталог
              </p>
              <Link to="/catalog" className="cart-empty__button">
                ПЕРЕЙТИ В КАТАЛОГ
              </Link>
            </div>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-layout__left">
              <div className="cart-items__top">
                <h2 className="cart-items__count">
                  ТОВАРОВ В КОРЗИНЕ: {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
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
                  <ItemWrapper key={item.id} {...itemWrapperProps}>
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
                      <div className="cart-item__total-current">{formatRub(item.price * item.quantity)}</div>
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
                      aria-label="Удалить товар"
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
                <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} шт</span>
              </div>
              <div className="cart-summary__divider" />
              <div className="cart-summary__row cart-summary__total">
                <span>Итого:</span>
                <span>{formatRub(getTotalPrice())}</span>
              </div>

              <Link
                to={isAuthenticated ? '/checkout' : '/auth'}
                state={isAuthenticated ? { backgroundLocation: location } : undefined}
                className="cart-summary__submit"
              >
                {isAuthenticated ? 'К ОФОРМЛЕНИЮ' : 'АВТОРИЗОВАТЬСЯ'}
              </Link>
            </div>
          </div>
        )}

        {recommendedProducts.length > 0 && (
          <div className="cart-recommendations">
            <ProductSlider
              title="ВАМ МОЖЕТ ПОНРАВИТЬСЯ"
              products={recommendedProducts}
              showLinks={false}
              withContainer={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
