import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Minus, Plus, Heart, Star } from 'lucide-react';
import { getProduct, getProducts, getProductRatings, rateProduct } from '../services/api';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductSlider from '../components/product/ProductSlider';
import { resolveMediaUrl } from '../utils/media';
import './ProductPage.css';

const ProductPage = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(null);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingsList, setRatingsList] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingComment, setRatingComment] = useState('');

  // Загрузка данных товара по ID
  useEffect(() => {
    setLoading(true);
    getProduct(id)
      .then(response => {
        setProduct(response.data);
        setQuantity(1);
        setCurrentImage(0);
        setRatingAvg(response.data.rating_avg || 0);
        setRatingCount(response.data.rating_count || 0);
        setUserRating(response.data.user_rating ?? null);
        setRatingError('');
        window.scrollTo(0, 0);
        
        setRatingsLoading(true);
        getProductRatings(response.data.id)
          .then((ratingsResponse) => {
            setRatingsList(Array.isArray(ratingsResponse.data) ? ratingsResponse.data : []);
          })
          .catch(() => setRatingsList([]))
          .finally(() => setRatingsLoading(false));

        // Загружаем похожие товары из той же категории
        if (response.data.category_slug) {
          getProducts({ category: response.data.category_slug })
            .then(res => {
              const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
              // Исключаем текущий товар
              const filtered = data.filter(p => p.id !== response.data.id).slice(0, 10);
              setRelatedProducts(filtered);
            })
            .catch(() => setRelatedProducts([]));
        }
        setLoading(false);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!product) return <div className="loading">Товар не найден</div>;

  const favorite = isFavorite(product.id);
  
  // Обработка изображения
  const getImageUrl = (img) => {
    return resolveMediaUrl(img, 'https://placehold.co/600x600/F5E6D3/8B4513?text=No+Image');
  };

  // Пока используем только реальные изображения с бэка
  const images = [getImageUrl(product.image)].filter(Boolean);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleFavoriteClick = () => {
    toggleFavorite(product);
  };

  const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  const isNew = product.is_new || product.isNew || false;
  const discount = product.discount || 0;
  const roundedAvg = Math.round(ratingAvg);

  const handleRate = async (value) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setRatingError('Войдите, чтобы поставить оценку.');
      return;
    }
    setRatingSaving(true);
    setRatingError('');
    try {
      const response = await rateProduct(
        product.id,
        { rating: value, comment: ratingComment.trim() || undefined },
        token
      );
      setUserRating(value);
      setRatingAvg(response.data.rating_avg || 0);
      setRatingCount(response.data.rating_count || 0);
      setRatingComment('');
      const freshRatings = await getProductRatings(product.id);
      setRatingsList(Array.isArray(freshRatings.data) ? freshRatings.data : []);
    } catch {
      setRatingError('Не удалось сохранить оценку. Попробуйте позже.');
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <div className="product-page page-animation py-4 py-md-5">
      <div className="container">
        
        {/* Верхняя часть: Галерея и Инфо */}
        <div className="product-main row g-4 mb-5">
          
          {/* ГАЛЕРЕЯ */}
          <div className="product-gallery col-12 col-lg-6">
            <div className="gallery-main-wrapper">
               <img src={images[currentImage]} alt={product.name} className="gallery-main-image" />
               {isNew && <span className="product-badge new">New</span>}
               {discount > 0 && <span className="product-badge sale">-{discount}%</span>}
            </div>
            
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, index) => (
                  <div 
                    key={index}
                    className={`gallery-thumb ${currentImage === index ? 'active' : ''}`}
                    onClick={() => setCurrentImage(index)}
                  >
                    <img src={img} alt={`Thumb ${index}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ИНФОРМАЦИЯ */}
          <div className="product-info col-12 col-lg-6">
            <div className="product-meta">
              <span className="sku">Артикул: {product.id}00{product.id}</span>
            </div>

            <h1 className="product-title">{product.name}</h1>
            <div className="product-rating">
              <div className="rating-display">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={`avg-${value}`}
                    size={16}
                    className={value <= roundedAvg ? 'star filled' : 'star'}
                  />
                ))}
                <span className="rating-value">
                  {ratingAvg ? ratingAvg.toFixed(1) : '0.0'}
                </span>
                <span className="rating-count">({ratingCount})</span>
              </div>
            </div>
            <p className="product-short-desc">{product.description}</p>
            
            <div className="product-price-block">
              <span className="current-price">{price.toLocaleString('ru-RU')} ₽</span>
              {discount > 0 && (
                 <span className="old-price">
                   {Math.round(price / (1 - discount / 100)).toLocaleString('ru-RU')} ₽
                 </span>
              )}
            </div>

            <div className="product-actions d-flex flex-wrap gap-3">
              <div className="quantity-control d-inline-flex align-items-center border rounded-1">
                <button
                  type="button"
                  onClick={() => setQuantity(q => q > 1 ? q - 1 : 1)}
                  disabled={quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => q + 1)}>
                  <Plus size={18} />
                </button>
              </div>

              <button
                type="button"
                className={`add-to-cart-btn-large btn btn-primary ${added ? 'added' : ''}`}
                onClick={handleAddToCart}
              >
                {added ? '✓ ДОБАВЛЕНО' : 'ДОБАВИТЬ В КОРЗИНУ'}
              </button>
              
              <button
                type="button"
                className={`wishlist-btn btn btn-outline-secondary ${favorite ? 'active' : ''}`}
                onClick={handleFavoriteClick}
                aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                <Heart size={24} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            
          </div>
        </div>

        {/* Табы с описанием */}
        <div className="product-tabs-section mb-5">
          <div className="tabs-header d-flex gap-4 border-bottom mb-4">
            <button
              type="button"
              className={`tab-btn btn btn-link text-decoration-none p-0 ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              ОПИСАНИЕ
            </button>
            <button
              type="button"
              className={`tab-btn btn btn-link text-decoration-none p-0 ${activeTab === 'specs' ? 'active' : ''}`}
              onClick={() => setActiveTab('specs')}
            >
              ХАРАКТЕРИСТИКИ
            </button>
            <button
              type="button"
              className={`tab-btn btn btn-link text-decoration-none p-0 ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              ОТЗЫВЫ ({ratingCount})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'description' && (
              <div className="text-content">
                <p>
                  Погрузитесь в мир роскошного ухода с нашим бестселлером "{product.name}". 
                  Этот продукт разработан ведущими дерматологами Кореи для обеспечения максимального 
                  результата в кратчайшие сроки.
                </p>
                <p>
                  <strong>Ключевые преимущества:</strong>
                </p>
                <ul>
                  <li>Глубокое увлажнение на 24 часа</li>
                  <li>Восстановление защитного барьера кожи</li>
                  <li>Подходит для чувствительной кожи</li>
                  <li>Не содержит парабенов и сульфатов</li>
                </ul>
              </div>
            )}
            
            {activeTab === 'specs' && (
              <div className="specs-table">
                <div className="spec-row">
                  <span className="spec-name">Объем:</span>
                  <span className="spec-val">50 мл</span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">Страна:</span>
                  <span className="spec-val">Южная Корея</span>
                </div>
                <div className="spec-row">
                  <span className="spec-name">Тип кожи:</span>
                  <span className="spec-val">Все типы</span>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="reviews-section">
                {ratingsLoading && <div className="reviews-loading">Загрузка отзывов...</div>}
                {!ratingsLoading && ratingsList.length === 0 && (
                  <div className="reviews-empty">Пока нет отзывов. Будьте первым!</div>
                )}
                <div className="review-form border rounded-3 p-3">
                  <label htmlFor="review-comment">Ваш отзыв</label>
                  <div className="review-rating-actions">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={`review-rate-${value}`}
                        type="button"
                        className={value <= (userRating || 0) ? 'star-button filled' : 'star-button'}
                        onClick={() => setUserRating(value)}
                        disabled={ratingSaving}
                        aria-label={`Поставить ${value}`}
                      >
                        <Star size={18} />
                      </button>
                    ))}
                    {userRating && <span className="user-rating">Ваша оценка: {userRating}</span>}
                  </div>
                  <textarea
                    className="form-control"
                    id="review-comment"
                    rows={4}
                    placeholder="Напишите пару слов о товаре (необязательно)"
                    value={ratingComment}
                    onChange={(event) => setRatingComment(event.target.value)}
                    disabled={ratingSaving}
                  />
                  <button
                    type="button"
                    className="review-submit btn btn-primary"
                    onClick={() => handleRate(userRating || 5)}
                    disabled={ratingSaving}
                  >
                    {ratingSaving ? 'Сохраняем...' : 'Отправить отзыв'}
                  </button>
                  {ratingError && <div className="rating-error">{ratingError}</div>}
                </div>
                {!ratingsLoading && ratingsList.length > 0 && (
                  <div className="reviews-list">
                    {ratingsList.map((item) => (
                      <div key={item.id} className="review-card border rounded-3 p-3 bg-white">
                        <div className="review-header">
                          <span className="review-author">{item.user_name}</span>
                          <span className="review-date">
                            {new Date(item.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <div className="review-rating">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star
                              key={`review-${item.id}-${value}`}
                              size={14}
                              className={value <= item.rating ? 'star filled' : 'star'}
                            />
                          ))}
                        </div>
                        {item.comment && <p className="review-text">{item.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>

        {/* Вам может понравиться */}
        {relatedProducts.length > 0 && (
          <div className="related-products">
            <ProductSlider title="ВАМ МОЖЕТ ПОНРАВИТЬСЯ" products={relatedProducts} />
          </div>
        )}

      </div>
    </div>
  );
};

export default ProductPage;
