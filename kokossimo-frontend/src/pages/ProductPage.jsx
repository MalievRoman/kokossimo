import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getProduct, getProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductSlider from '../components/product/ProductSlider';
import { resolveMediaUrl } from '../utils/media';
import './ProductPage.css';

const FALLBACK_IMAGE = 'https://placehold.co/600x600/F5E6D3/8B4513?text=No+Image';
const capitalizeWords = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word))
    .join(' ');
const capitalizeFirst = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
};

const ProductPage = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('description');
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActiveTab('description');
    setCurrentImage(0);

    getProduct(id)
      .then((response) => {
        const fetchedProduct = response.data;
        setProduct(fetchedProduct);
        window.scrollTo(0, 0);

        if (fetchedProduct.category_slug) {
          getProducts({ category: fetchedProduct.category_slug })
            .then((res) => {
              const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
              setRelatedProducts(data.filter((item) => item.id !== fetchedProduct.id).slice(0, 10));
            })
            .catch(() => setRelatedProducts([]));
        } else {
          setRelatedProducts([]);
        }
      })
      .catch(() => {
        setProduct(null);
        setRelatedProducts([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const images = useMemo(() => {
    if (!product) return [];
    const mainImage = resolveMediaUrl(product.image, FALLBACK_IMAGE);
    return [mainImage];
  }, [product]);

  const activeImage = images[currentImage] || images[0] || FALLBACK_IMAGE;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!product) return <div className="loading">Товар не найден</div>;

  const favorite = isFavorite(product.id);
  const price = Number.parseFloat(product.price) || 0;
  const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null;
  const isInStock = typeof product.is_in_stock === 'boolean' ? product.is_in_stock : (stock == null ? true : stock > 0);

  const breadcrumbCategory = (product.category_slug || 'каталог').replaceAll('-', ' ');
  const breadcrumbCategoryLabel = capitalizeWords(breadcrumbCategory);
  const productKind = capitalizeFirst(product.product_subcategory_name || 'Парфюмерная вода');
  const tabText = String(product.description || '').trim();

  const handleAddToCart = () => {
    if (!isInStock) return;
    addToCart(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="product-page page-animation">
      <div className="container">
        <nav className="product-breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/">Главная</Link>
          <span>—</span>
          <Link to="/catalog">Каталог</Link>
          <span>—</span>
          <span>{breadcrumbCategoryLabel}</span>
          <span>—</span>
          <span className="current">{product.name}</span>
        </nav>

        <div className="product-main">
          <div className="product-gallery">
            <div className="gallery-main-wrapper">
              <img src={activeImage} alt={product.name} className="gallery-main-image" />
            </div>
          </div>

          <div className="product-info">
            <h1 className="product-title">{product.name}</h1>

            <p className="product-kind">{productKind}</p>

            <div className="product-price-block">
              <span className="current-price">{price.toLocaleString('ru-RU')} ₽</span>
            </div>

            <div className="product-actions">
              <button
                type="button"
                className={`add-to-cart-btn-large ${added ? 'added' : ''}`}
                onClick={handleAddToCart}
                disabled={!isInStock}
              >
                {!isInStock ? 'НЕТ В НАЛИЧИИ' : added ? 'ДОБАВЛЕНО' : 'В КОРЗИНУ'}
              </button>
              <button
                type="button"
                className={`wishlist-btn ${favorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(product)}
                aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        <div className="product-tabs-section">
          <div className="tabs-header">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              Описание
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
              onClick={() => setActiveTab('specs')}
            >
              Характеристики
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              Отзывы
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'description' && (
              <div className="text-content">
                <p>{tabText || 'Описание появится позже.'}</p>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="specs-content">
                <h3>Состав</h3>
                <p>{tabText || 'Информация о составе появится позже.'}</p>
                <h3>Применение</h3>
                <p>{tabText || 'Информация о применении появится позже.'}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="reviews-placeholder">
                СКОРО ПОЯВЯТСЯ
              </div>
            )}

          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="related-products">
            <ProductSlider
              title="ВАМ МОЖЕТ ПОНРАВИТЬСЯ"
              products={relatedProducts}
              showLinks={false}
              withContainer={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
