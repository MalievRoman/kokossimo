import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getProductRatings } from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';

// Карточка товара в верстке под koko_website (main_page.html).
// Важные моменты:
// - разметка и классы совпадают с .product-card из koko-main.css;
// - кнопка "В КОРЗИНУ" видна сначала одна;
// - после клика вместо неё показываются контролы количества (- / +);
// - цвета, размеры и отступы полностью берутся из koko-main.css.

const ProductCard = ({ product }) => {
  if (!product) return null;

  const { addToCart, updateQuantity, removeFromCart, cartItems } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  // Текущее количество товара в корзине
  const cartItem = cartItems.find((item) => item.id === product.id);
  const quantity = cartItem?.quantity || 0;

  // Флаги и данные из API
  const isNew = Boolean(product.is_new ?? product.isNew);
  const discount = Number.isFinite(Number(product.discount))
    ? Number(product.discount)
    : 0;
  const ratingValue = Number(product.rating_avg ?? product.rating ?? product.average_rating ?? 0);
  const ratingCount = Number(product.rating_count ?? product.ratingCount ?? 0);
  const [ratingData, setRatingData] = useState({
    avg: Number.isFinite(ratingValue) ? ratingValue : 0,
    count: Number.isFinite(ratingCount) ? ratingCount : 0,
  });
  const roundedRating = Math.round(ratingData.avg || 0);

  // Цена
  let price = 0;
  try {
    if (typeof product.price === 'string') {
      price = parseFloat(product.price);
    } else if (typeof product.price === 'number') {
      price = product.price;
    }
    if (!Number.isFinite(price)) {
      price = 0;
    }
  } catch {
    price = 0;
  }

  // Старую цену восстанавливаем из скидки (если есть)
  let oldPrice = null;
  if (price > 0 && discount > 0 && discount < 100) {
    oldPrice = Math.round(price / (1 - discount / 100));
  }

  // Картинка: относительные пути дополняем адресом бэкенда
  const imageUrl = resolveMediaUrl(
    product.image,
    'https://placehold.co/400x400/F5E6D3/8B4513?text=No+Image'
  );
  const description = String(product.short_description ?? product.description ?? '').trim();

  const favorite = isFavorite(product.id);

  useEffect(() => {
    const hasServerStats = Number.isFinite(ratingValue) && Number.isFinite(ratingCount);
    const shouldFetch = !hasServerStats || (ratingValue === 0 && ratingCount === 0);
    if (!shouldFetch) {
      setRatingData({ avg: ratingValue, count: ratingCount });
      return undefined;
    }

    let isActive = true;
    getProductRatings(product.id)
      .then((response) => {
        if (!isActive) return;
        const list = Array.isArray(response.data) ? response.data : [];
        if (list.length === 0) {
          setRatingData({ avg: 0, count: 0 });
          return;
        }
        const total = list.reduce((sum, item) => sum + Number(item.rating || 0), 0);
        setRatingData({ avg: total / list.length, count: list.length });
      })
      .catch(() => {
        if (isActive) setRatingData({ avg: ratingValue || 0, count: ratingCount || 0 });
      });

    return () => {
      isActive = false;
    };
  }, [product.id, ratingValue, ratingCount]);

  // Обработчики корзины
  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleIncrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity <= 1) {
      removeFromCart(product.id);
    } else {
      updateQuantity(product.id, quantity - 1);
    }
  };

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  };

  const formatRub = (n) =>
    price > 0 ? `${Number(n).toLocaleString('ru-RU')} ₽` : 'Цена не указана';


  const favoriteIcon = favorite ? `${import.meta.env.BASE_URL}assets/fav_pressed.svg` : `${import.meta.env.BASE_URL}assets/fav.svg`;

  const showQtyControls = quantity > 0;

  return (
    <div className="product-card" data-product-id={product.id}>
      <div className="product-card__media">
        {(isNew || discount > 0) && (
          <div className="product-card__badges">
            {isNew && (
              <span className="product-card__badge product-card__badge--new">
                новинка
              </span>
            )}
            {discount > 0 && (
              <span className="product-card__badge product-card__badge--discount">
                −{discount}%
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className={`product-card__favorite ${favorite ? 'is-active' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        >
          <img src={favoriteIcon} alt="" aria-hidden="true" />
        </button>

        <Link
          className="product-card__image-link"
          to={`/product/${product.id}`}
          aria-label={product.name}
        >
          <div className="product-card__image">
            {imageUrl && <img src={imageUrl} alt={product.name} />}
          </div>
        </Link>
      </div>

      <div className="product-card__info">
        <div className="product-card__title">{product.name}</div>

        <div className="product-card__meta">
          <div className="product-card__rating">
            <span className="product-card__rating-stars" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={`product-card__rating-star ${index < roundedRating ? 'is-filled' : ''}`}
                >
                  ★
                </span>
              ))}
            </span>
            <span className="product-card__rating-value">
              {Number.isFinite(ratingData.avg) ? ratingData.avg.toFixed(1) : '0.0'}
            </span>
            <span className="product-card__rating-count">
              ({Number.isFinite(ratingData.count) ? ratingData.count : 0})
            </span>
          </div>

          <div className="product-card__desc">{description}</div>

          <div className="product-card__prices">
            {discount > 0 && oldPrice ? (
              <>
                <span className="product-card__price--new">
                  {formatRub(price)}
                </span>
                <span className="product-card__price--old">
                  {formatRub(oldPrice)}
                </span>
              </>
            ) : (
              <span className="product-card__price">
                {price > 0 ? formatRub(price) : 'Цена не указана'}
              </span>
            )}
          </div>

          {/* Кнопка + контролы количества как в оригинальном макете:
              сначала только кнопка "В КОРЗИНУ", после клика — минус/qty/плюс */}
          <button
            type="button"
            className={`product-card__btn ${showQtyControls ? 'is-hidden' : ''}`}
            onClick={handleAddToCart}
          >
            В КОРЗИНУ
          </button>

          <div
            className={`product-card__qty ${showQtyControls ? '' : 'is-hidden'}`}
            data-qty-controls
          >
            <button
              type="button"
              className="product-card__qty-btn"
              onClick={handleDecrease}
            >
              −
            </button>
            <div className="product-card__qty-value" data-qty-value>
              {showQtyControls ? quantity : 1}
            </div>
            <button
              type="button"
              className="product-card__qty-btn"
              onClick={handleIncrease}
              data-qty-plus
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
