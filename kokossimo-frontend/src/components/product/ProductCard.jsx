import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { resolveMediaUrl } from '../../utils/media';

// Карточка товара в верстке под koko_website (main_page.html).
// Разметка и классы совпадают с .product-card из koko-main.css.

const ProductCard = ({ product }) => {
  if (!product) return null;

  const { addToCart, updateQuantity, removeFromCart, cartItems } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const cartItem = cartItems.find((item) => item.id === product.id);
  const quantity = cartItem?.quantity || 0;
  const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null;
  const isInStock = typeof product.is_in_stock === 'boolean' ? product.is_in_stock : (stock == null ? true : stock > 0);

  const isNew = Boolean(product.is_new ?? product.isNew);
  const discount = Number.isFinite(Number(product.discount))
    ? Number(product.discount)
    : 0;

  let price = 0;
  try {
    if (typeof product.price === 'string') {
      price = parseFloat(product.price);
    } else if (typeof product.price === 'number') {
      price = product.price;
    }
    if (!Number.isFinite(price)) price = 0;
  } catch {
    price = 0;
  }

  let oldPrice = null;
  if (price > 0 && discount > 0 && discount < 100) {
    oldPrice = Math.round(price / (1 - discount / 100));
  }

  const placeholderImage = 'https://placehold.co/400x400/F5E6D3/8B4513?text=No+Image';
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = resolveMediaUrl(product.image, placeholderImage);
  const displayImageUrl = imageError ? placeholderImage : imageUrl;
  const description = String(product.short_description ?? product.description ?? '').trim();

  const favorite = isFavorite(product.id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInStock) return;
    addToCart(product, 1);
  };

  const handleIncrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canIncrease) return;
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity <= 1) removeFromCart(product.id);
    else updateQuantity(product.id, quantity - 1);
  };

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  };

  const formatRub = (n) =>
    price > 0 ? `${Number(n).toLocaleString('ru-RU')} ₽` : 'Цена не указана';

  const favoriteIcon = favorite
    ? `${import.meta.env.BASE_URL}assets/fav_pressed.svg`
    : `${import.meta.env.BASE_URL}assets/fav.svg`;

  const showQtyControls = quantity > 0;
  const canIncrease = stock == null ? true : quantity < stock;

  return (
    <div className="product-card" data-product-id={product.id}>
      <div className="product-card__media">
        {(isNew || discount > 0) && (
          <div className="product-card__badges">
            {isNew && (
              <span className="product-card__badge product-card__badge--new">новинка</span>
            )}
            {discount > 0 && (
              <span className="product-card__badge product-card__badge--discount">−{discount}%</span>
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
            {displayImageUrl && (
              <img
                src={displayImageUrl}
                alt={product.name}
                onError={() => setImageError(true)}
                onLoad={(e) => {
                  const img = e.target;
                  if (img.naturalWidth === 1 && img.naturalHeight === 1) setImageError(true);
                }}
              />
            )}
          </div>
        </Link>
      </div>

      <div className="product-card__info">
        <div className="product-card__title">{product.name}</div>

        <div className="product-card__meta">
          <div className="product-card__desc">{description}</div>

          <div className="product-card__prices">
            {discount > 0 && oldPrice ? (
              <>
                <span className="product-card__price--new">{formatRub(price)}</span>
                <span className="product-card__price--old">{formatRub(oldPrice)}</span>
              </>
            ) : (
              <span className="product-card__price">
                {price > 0 ? formatRub(price) : 'Цена не указана'}
              </span>
            )}
          </div>
          {!isInStock && (
            <div className="product-card__stock-status">Нет в наличии</div>
          )}

          <div className="product-card__action">
            <button
              type="button"
              className={`product-card__btn ${showQtyControls ? 'is-hidden' : ''}`}
              onClick={handleAddToCart}
              disabled={!isInStock}
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
                disabled={!canIncrease}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
