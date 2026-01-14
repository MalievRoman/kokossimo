import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Minus, Plus, Heart, Share2, Star } from 'lucide-react';
import { getProduct, getProducts } from '../services/api';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import ProductSlider from '../components/product/ProductSlider';
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

  // Загрузка данных товара по ID
  useEffect(() => {
    setLoading(true);
    getProduct(id)
      .then(response => {
        setProduct(response.data);
        setQuantity(1);
        setCurrentImage(0);
        window.scrollTo(0, 0);
        
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
    if (!img) return 'https://placehold.co/600x600/F5E6D3/8B4513?text=No+Image';
    if (img.startsWith('http')) return img;
    return `http://127.0.0.1:8000${img.startsWith('/') ? img : `/${img}`}`;
  };

  // Моковые дополнительные фото (в реальности они приходят с бэка)
  const images = [
    getImageUrl(product.image),
    "https://placehold.co/600x600/F5E6D3/8B4513?text=Photo+2",
    "https://placehold.co/600x600/F5E6D3/8B4513?text=Photo+3",
    "https://placehold.co/600x600/F5E6D3/8B4513?text=Photo+4"
  ];

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

  return (
    <div className="product-page page-animation">
      <div className="container">
        
        {/* Верхняя часть: Галерея и Инфо */}
        <div className="product-main">
          
          {/* ГАЛЕРЕЯ */}
          <div className="product-gallery">
            <div className="gallery-main-wrapper">
               <img src={images[currentImage]} alt={product.name} className="gallery-main-image" />
               {isNew && <span className="product-badge new">New</span>}
               {discount > 0 && <span className="product-badge sale">-{discount}%</span>}
            </div>
            
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
          </div>

          {/* ИНФОРМАЦИЯ */}
          <div className="product-info">
            <div className="product-meta">
              <span className="sku">Артикул: {product.id}00{product.id}</span>
              <div className="rating">
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <Star size={16} fill="#FFD700" color="#FFD700" />
                <span className="rating-count">(12 отзывов)</span>
              </div>
            </div>

            <h1 className="product-title">{product.name}</h1>
            <p className="product-short-desc">{product.description}</p>
            
            <div className="product-price-block">
              <span className="current-price">{price.toLocaleString('ru-RU')} ₽</span>
              {discount > 0 && (
                 <span className="old-price">
                   {Math.round(price / (1 - discount / 100)).toLocaleString('ru-RU')} ₽
                 </span>
              )}
            </div>

            <div className="product-actions">
              <div className="quantity-control">
                <button 
                  onClick={() => setQuantity(q => q > 1 ? q - 1 : 1)}
                  disabled={quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}>
                  <Plus size={18} />
                </button>
              </div>

              <button 
                className={`add-to-cart-btn-large ${added ? 'added' : ''}`}
                onClick={handleAddToCart}
              >
                {added ? '✓ ДОБАВЛЕНО' : 'ДОБАВИТЬ В КОРЗИНУ'}
              </button>
              
              <button 
                className={`wishlist-btn ${favorite ? 'active' : ''}`}
                onClick={handleFavoriteClick}
                aria-label={favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                <Heart size={24} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            
            <div className="product-extra-actions">
               <button className="share-btn">
                 <Share2 size={16} /> Поделиться
               </button>
            </div>
          </div>
        </div>

        {/* Табы с описанием */}
        <div className="product-tabs-section">
          <div className="tabs-header">
            <button 
              className={`tab-btn ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              ОПИСАНИЕ
            </button>
            <button 
              className={`tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
              onClick={() => setActiveTab('specs')}
            >
              ХАРАКТЕРИСТИКИ
            </button>
            <button 
              className={`tab-btn ${activeTab === 'delivery' ? 'active' : ''}`}
              onClick={() => setActiveTab('delivery')}
            >
              ДОСТАВКА
            </button>
            <button 
              className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              ОТЗЫВЫ (12)
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
            
            {activeTab === 'delivery' && (
              <div className="text-content">
                <p>Бесплатная доставка по Москве при заказе от 5000 ₽.</p>
                <p>Срок доставки: 1-2 дня.</p>
                <p>Доставка по России: СДЭК, Почта России (3-7 дней).</p>
              </div>
            )}
            
            {activeTab === 'reviews' && (
              <div className="reviews-placeholder">
                <p>Здесь пока нет отзывов. Будьте первым!</p>
                <button className="write-review-btn">Написать отзыв</button>
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
