import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { getCurrentUser, getMyOrders, logoutUser, updateProfile } from '../services/api';
import { formatRuPhone, isPhoneInputKeyAllowed } from '../utils/phone';
import './ProfilePage.css';

const PROFILE_TABS = [
  { key: 'main', label: 'ГЛАВНАЯ' },
  { key: 'orders', label: 'ЗАКАЗЫ' },
  { key: 'favorites', label: 'ИЗБРАННОЕ' },
  { key: 'bonuses', label: 'БОНУСЫ' },
  { key: 'settings', label: 'ПАРАМЕТРЫ' },
];

const STATUS_LABELS = {
  new: 'Новый',
  processing: 'В обработке',
  paid: 'Оплачен',
  shipped: 'Отправлен',
  delivered: 'Выполнен',
  cancelled: 'Отменен',
};

const FULL_NAME_MAX_LENGTH = 80;
const FULL_NAME_ALLOWED_CHARS_REGEX = /^[A-Za-zА-Яа-яЁё\s'-]*$/;

const formatBirthDateInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}.${month}`;
  return `${day}.${month}.${year}`;
};

const apiBirthDateToInput = (value) => {
  if (typeof value !== 'string') return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '';
  return `${day}.${month}.${year}`;
};

const inputBirthDateToApi = (value) => {
  const normalized = formatBirthDateInput(value);
  const [day, month, year] = normalized.split('.');
  if (!day || !month || !year || year.length !== 4) {
    return null;
  }
  return `${year}-${month}-${day}`;
};

const normalizeFullNameInput = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '')
    .slice(0, FULL_NAME_MAX_LENGTH);

const getFullNameValidationError = (value) => {
  const rawValue = String(value || '');
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (!FULL_NAME_ALLOWED_CHARS_REGEX.test(rawValue)) {
    return 'ФИО может содержать только буквы, пробел, дефис и апостроф.';
  }
  if (!/[A-Za-zА-Яа-яЁё]/.test(rawValue)) {
    return 'Введите корректное ФИО.';
  }
  if (trimmed.length > FULL_NAME_MAX_LENGTH) {
    return `ФИО не должно быть длиннее ${FULL_NAME_MAX_LENGTH} символов.`;
  }
  return '';
};

const ProfilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const isAuthenticated = Boolean(authToken);
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();
  const { favorites, removeFromFavorites } = useFavorites();
  const [activeTab, setActiveTab] = useState('main');
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '+7',
    city: '',
    street: '',
    house: '',
    apartment: '',
    postal_code: '',
  });
  const [fullNameInput, setFullNameInput] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [favoriteCartToastVisible, setFavoriteCartToastVisible] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState({ type: '', message: '' });
  const [settingsBaseline, setSettingsBaseline] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const favoriteCartToastTimerRef = useRef(null);

  const resetAuthState = (message = '') => {
    localStorage.removeItem('authToken');
    window.dispatchEvent(new Event('auth-token-changed'));
    setAuthToken('');
    setProfile({
      first_name: '',
      last_name: '',
      email: '',
      phone: '+7',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postal_code: '',
    });
    setFullNameInput('');
    setBirthDate('');
    setSettingsStatus({ type: '', message: '' });
    setSettingsBaseline(null);
    setOrders([]);
    setOrdersLoading(false);
    setActiveTab('main');
    if (message) {
      showTemporaryStatus('error', message);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromQuery = params.get('tab');
    const isValidTab = PROFILE_TABS.some((tab) => tab.key === tabFromQuery);
    if (isValidTab) {
      setActiveTab(tabFromQuery);
      return;
    }
    setActiveTab('main');
  }, [location.search]);

  useEffect(() => {
    if (!authToken) {
      setOrdersLoading(false);
      return;
    }

    let unauthorizedHandled = false;

    getCurrentUser(authToken)
      .then((response) => {
        const fullName = `${response.data?.first_name || ''} ${response.data?.last_name || ''}`.trim();
        const normalizedPhone = formatRuPhone(response.data?.phone || '');
        const normalizedBirthDate = apiBirthDateToInput(response.data?.birth_date);
        const normalizedEmail = response.data?.email || '';

        setProfile({
          ...response.data,
          phone: normalizedPhone,
        });
        setBirthDate(normalizedBirthDate);
        setSettingsBaseline({
          fullName,
          phone: normalizedPhone,
          email: normalizedEmail,
          birthDate: normalizedBirthDate,
        });
      })
      .catch((error) => {
        if (error?.response?.status === 401) {
          unauthorizedHandled = true;
          resetAuthState('Сессия истекла. Войдите в аккаунт заново.');
          return;
        }
        setStatus({ type: 'error', message: 'Не удалось загрузить профиль.' });
      });

    getMyOrders(authToken)
      .then((response) => {
        setOrders(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        if (error?.response?.status === 401 && !unauthorizedHandled) {
          unauthorizedHandled = true;
          resetAuthState('Сессия истекла. Войдите в аккаунт заново.');
          return;
        }
        setOrders([]);
      })
      .finally(() => {
        setOrdersLoading(false);
      });
  }, [authToken]);

  useEffect(() => {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    setFullNameInput(fullName);
  }, [profile.first_name, profile.last_name]);

  useEffect(() => {
    if (!detailsOrder) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDetailsOrder(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [detailsOrder]);

  useEffect(() => () => {
    if (favoriteCartToastTimerRef.current) {
      clearTimeout(favoriteCartToastTimerRef.current);
    }
  }, []);

  const userName = useMemo(() => {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    return fullName || 'Гость';
  }, [profile.first_name, profile.last_name]);

  const normalizeSettingsComparable = ({
    fullName = '',
    phone = '',
    email = '',
    birthDate: nextBirthDate = '',
  }) => ({
    fullName: String(fullName).trim().replace(/\s+/g, ' '),
    phone: formatRuPhone(String(phone || '')),
    email: String(email || '').trim().toLowerCase(),
    birthDate: formatBirthDateInput(String(nextBirthDate || '')),
  });

  const isSettingsDirty = useMemo(() => {
    if (!settingsBaseline) return false;
    const baselineComparable = normalizeSettingsComparable(settingsBaseline);
    const currentComparable = normalizeSettingsComparable({
      fullName: fullNameInput,
      phone: profile.phone,
      email: profile.email,
      birthDate,
    });
    return (
      baselineComparable.fullName !== currentComparable.fullName ||
      baselineComparable.phone !== currentComparable.phone ||
      baselineComparable.email !== currentComparable.email ||
      baselineComparable.birthDate !== currentComparable.birthDate
    );
  }, [settingsBaseline, fullNameInput, profile.phone, profile.email, birthDate]);
  const fullNameError = useMemo(() => getFullNameValidationError(fullNameInput), [fullNameInput]);

  const latestOrder = orders[0] || null;

  const formatPrice = (value) => Number(value || 0).toLocaleString('ru-RU');

  const getOrderStatusLabel = (orderStatus) => STATUS_LABELS[orderStatus] || orderStatus || '—';
  const formatOrderAddress = (order) => {
    const parts = [order?.city, order?.street, order?.house, order?.apartment]
      .map((part) => (part || '').trim())
      .filter(Boolean);
    return parts.join(', ') || '—';
  };

  const showTemporaryStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const showFavoriteCartToast = () => {
    setFavoriteCartToastVisible(true);
    if (favoriteCartToastTimerRef.current) {
      clearTimeout(favoriteCartToastTimerRef.current);
    }
    favoriteCartToastTimerRef.current = setTimeout(() => {
      setFavoriteCartToastVisible(false);
      favoriteCartToastTimerRef.current = null;
    }, 1500);
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/profile?tab=${tabKey}`);
  };

  const handleSaveSettings = async () => {
    setSettingsStatus({ type: '', message: '' });

    if (!isSettingsDirty) {
      return;
    }

    if (fullNameError) {
      setSettingsStatus({ type: 'error', message: 'Исправьте поле ФИО перед сохранением.' });
      return;
    }

    if (!authToken) {
      setSettingsStatus({ type: 'error', message: 'Сначала войдите в аккаунт.' });
      return;
    }

    const [firstName = '', ...rest] = fullNameInput.trim().split(/\s+/);
    const lastName = rest.join(' ');

    try {
      setIsSubmitting(true);
      const response = await updateProfile(authToken, {
        first_name: firstName,
        last_name: lastName,
        email: profile.email,
        phone: profile.phone,
        birth_date: inputBirthDateToApi(birthDate),
      });
      setProfile({
        ...response.data,
        phone: formatRuPhone(response.data?.phone || ''),
      });
      setBirthDate(apiBirthDateToInput(response.data?.birth_date));
      const updatedFullName = `${response.data?.first_name || ''} ${response.data?.last_name || ''}`.trim();
      const updatedPhone = formatRuPhone(response.data?.phone || '');
      const updatedEmail = response.data?.email || '';
      const updatedBirthDate = apiBirthDateToInput(response.data?.birth_date);
      setSettingsBaseline({
        fullName: updatedFullName,
        phone: updatedPhone,
        email: updatedEmail,
        birthDate: updatedBirthDate,
      });
      setSettingsStatus({ type: 'success', message: 'Данные профиля сохранены.' });
    } catch (error) {
      if (error?.response?.status === 401) {
        resetAuthState('Сессия истекла. Войдите в аккаунт заново.');
        return;
      }
      setSettingsStatus({ type: 'error', message: 'Не удалось сохранить профиль.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!authToken) return;

    try {
      await logoutUser(authToken);
    } catch (error) {
      // Даже если сервер не ответил, очищаем токен локально
    } finally {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new Event('auth-token-changed'));
      setAuthToken('');
      setProfile({
        first_name: '',
        last_name: '',
        email: '',
        phone: '+7',
        city: '',
        street: '',
        house: '',
        apartment: '',
        postal_code: '',
      });
      setFullNameInput('');
      setBirthDate('');
      setOrders([]);
      setOrdersLoading(false);
      showTemporaryStatus('success', 'Вы вышли из аккаунта.');
      setActiveTab('main');
    }
  };

  const handleRepeatOrder = (order) => {
    if (!order?.items?.length) {
      showTemporaryStatus('error', 'В заказе нет товаров для повтора.');
      return;
    }

    order.items.forEach((item) => {
      if (!item.product_id) return;
      addToCart(
        {
          id: item.product_id,
          name: item.product_name,
          price: Number(item.price),
          image: item.product_image,
          discount: 0,
          is_gift_certificate: Boolean(item.is_gift_certificate),
        },
        item.quantity || 1
      );
    });

    showTemporaryStatus('success', `Товары из заказа №${order.id} добавлены в корзину.`);
  };

  const handleAddFavoriteToCart = (favoriteItem) => {
    const stock = Number(favoriteItem?.stock);
    const isOutOfStock =
      favoriteItem?.is_gift_certificate
        ? false
        : (typeof favoriteItem?.is_in_stock === 'boolean'
            ? !favoriteItem.is_in_stock
            : (Number.isFinite(stock) ? stock <= 0 : false));

    if (isOutOfStock) {
      return;
    }

    addToCart(favoriteItem, 1);
    showFavoriteCartToast();
  };

  const handleFavoriteQuantityChange = (productId, newQuantity) => {
    const item = cartItems.find((cartItem) => cartItem.id === productId);
    const stock = Number(item?.stock);
    const isUnavailable = item?.stock != null && Number.isFinite(stock) && stock <= 0;

    if (isUnavailable) {
      return;
    }

    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    updateQuantity(productId, newQuantity);
  };

  return (
    <div className="profile-page page-animation">
      <div className="container profile-container">
        <div className="breadcrumbs">
          <Link to="/">ГЛАВНАЯ</Link> <span>— ПРОФИЛЬ</span>
        </div>

        <div className="profile-tabs">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`profile-tab ${activeTab === tab.key ? 'is-active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="page-animation" key={isAuthenticated ? activeTab : 'guest'}>
          {!isAuthenticated ? (
            <section className="profile-panel profile-panel--guest">
              <h1 className="profile-empty-title">Личный кабинет</h1>
              <p className="profile-empty-text">Войдите в аккаунт, чтобы видеть заказы, избранное и настройки.</p>
              <Link to="/auth" className="profile-btn profile-btn--primary profile-btn--fit">
                Вход / Регистрация
              </Link>
            </section>
          ) : (
            <>
            {activeTab === 'main' && (
              <div className="profile-main-grid">
                <section className="profile-panel profile-user-panel">
                  <img
                    className="profile-user-avatar"
                    src={`${import.meta.env.BASE_URL}assets/account.png`}
                    alt="Фото профиля"
                  />
                  <div className="profile-user-info">
                    <h2 className="profile-user-name">{userName}</h2>
                    <p className="profile-user-meta">{profile.phone || '+7 (___) ___-__-__'}</p>
                    <p className="profile-user-meta">{profile.email || 'Добавьте email в параметрах'}</p>
                  </div>
                </section>

                <section className="profile-panel profile-balance-panel">
                  <div className="profile-balance-value">БОНУСЫ</div>
                  <p className="profile-balance-label">
                    Бонусная программа на данный момент находится в разработке
                  </p>
                </section>

                <div className="profile-shortcuts">
                  <button
                    type="button"
                    className="profile-shortcut"
                    onClick={() => handleTabChange('orders')}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="profile-shortcut-icon"
                    >
                      <path
                        d="M0.965332 0.977539H1.88092C2.05337 0.977539 2.1396 0.977539 2.20899 1.00925C2.27014 1.0372 2.32197 1.08214 2.35828 1.13873C2.39948 1.20293 2.41168 1.2883 2.43607 1.45901L2.76785 3.78145M2.76785 3.78145L3.5052 9.20098C3.59877 9.88871 3.64555 10.2326 3.80997 10.4914C3.95484 10.7195 4.16254 10.9008 4.40808 11.0137C4.68672 11.1417 5.03376 11.1417 5.72785 11.1417H11.7267C12.3874 11.1417 12.7178 11.1417 12.9878 11.0228C13.2258 10.918 13.43 10.749 13.5775 10.5348C13.7448 10.2918 13.8066 9.96736 13.9303 9.31832L14.8581 4.44716C14.9016 4.21872 14.9233 4.10451 14.8918 4.01522C14.8642 3.9369 14.8096 3.87095 14.7378 3.82913C14.656 3.78145 14.5398 3.78145 14.3072 3.78145H2.76785ZM6.57315 14.2961C6.57315 14.6833 6.25931 14.9971 5.87217 14.9971C5.48504 14.9971 5.17119 14.6833 5.17119 14.2961C5.17119 13.909 5.48504 13.5951 5.87217 13.5951C6.25931 13.5951 6.57315 13.909 6.57315 14.2961ZM12.181 14.2961C12.181 14.6833 11.8671 14.9971 11.48 14.9971C11.0928 14.9971 10.779 14.6833 10.779 14.2961C10.779 13.909 11.0928 13.5951 11.48 13.5951C11.8671 13.5951 12.181 13.909 12.181 14.2961Z"
                        stroke="#240100"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="11.5122" cy="14.3291" r="0.448242" fill="#240100" />
                      <circle cx="5.86841" cy="14.3289" r="0.447998" fill="#240100" />
                    </svg>
                    МОИ ЗАКАЗЫ
                  </button>
                  <button
                    type="button"
                    className="profile-shortcut"
                    onClick={() => handleTabChange('favorites')}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="profile-shortcut-icon"
                    >
                      <path
                        d="M8.46112 14.5491C8.20837 14.6383 7.79208 14.6383 7.53933 14.5491C5.38352 13.8131 0.566406 10.743 0.566406 5.53929C0.566406 3.24224 2.41743 1.38379 4.69961 1.38379C6.05256 1.38379 7.24941 2.03796 8.00022 3.04896C8.75104 2.03796 9.95532 1.38379 11.3008 1.38379C13.583 1.38379 15.434 3.24224 15.434 5.53929C15.434 10.743 10.6169 13.8131 8.46112 14.5491Z"
                        stroke="#240100"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    ИЗБРАННОЕ
                  </button>
                </div>

                <section
                  className={`profile-panel profile-latest-order${!latestOrder ? ' profile-latest-order--empty' : ''}`}
                >
                  {!latestOrder ? (
                    <p className="profile-muted">Пока нет заказов</p>
                  ) : (
                    <>
                      <div className="profile-order-head">
                        <span className="profile-order-number">№{latestOrder.id}</span>
                        <span>{new Date(latestOrder.created_at).toLocaleDateString('ru-RU')}</span>
                        <span
                          className={`profile-order-status ${
                            latestOrder.status === 'cancelled' ? 'is-cancelled' : 'is-done'
                          }`}
                        >
                          {getOrderStatusLabel(latestOrder.status)}
                        </span>
                      </div>
                      <div className="profile-order-items">
                        {(latestOrder.items || []).slice(0, 3).map((item) => (
                          <div key={`${latestOrder.id}-${item.product_id || item.product_name}`} className="profile-order-item">
                            <img
                              src={item.product_image || `${import.meta.env.BASE_URL}assets/account.png`}
                              alt={item.product_name}
                              className="profile-order-item-image"
                            />
                            <div>
                              <div className="profile-order-item-name">{item.product_name}</div>
                              <div className="profile-order-item-qty">{item.quantity} шт</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="profile-order-foot">
                        <span className="profile-order-total-text">Итог: {formatPrice(latestOrder.total_price)} ₽</span>
                        <button
                          type="button"
                          className="profile-btn profile-btn--primary profile-btn--repeat"
                          onClick={() => handleRepeatOrder(latestOrder)}
                        >
                          ПОВТОРИТЬ
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'orders' && (
              <section className="profile-orders-list">
                {ordersLoading ? (
                  <div className="profile-panel profile-muted">Загрузка заказов...</div>
                ) : orders.length === 0 ? (
                  <div className="profile-panel profile-muted">У вас пока нет заказов.</div>
                ) : (
                  orders.map((order) => (
                    <article key={order.id} className="profile-panel profile-order-row">
                      <div className="profile-order-head profile-order-head--list">
                        <span className="profile-order-number">№{order.id}</span>
                        <span>{new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
                        <span
                          className={`profile-order-status ${
                            order.status === 'cancelled' ? 'is-cancelled' : 'is-done'
                          }`}
                        >
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="profile-order-summary profile-order-summary--list">
                        <p className="profile-order-items-count">{order.items?.length || 0} товара</p>
                        <span className="profile-order-total-text">Итог: {formatPrice(order.total_price)} ₽</span>
                      </div>
                      <div className="profile-order-actions profile-order-actions--list">
                        <button
                          type="button"
                          className="profile-btn profile-btn--outline profile-btn--details"
                          onClick={() => setDetailsOrder(order)}
                        >
                          ПОДРОБНЕЕ
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}

            {activeTab === 'favorites' && (
              <section className="profile-favorites-list">
                {favorites.length === 0 ? (
                  <div className="profile-panel profile-muted">В избранном пока нет товаров.</div>
                ) : (
                  favorites.map((item) => {
                    const stock = Number(item?.stock);
                    const isOutOfStock =
                      item?.is_gift_certificate
                        ? false
                        : (typeof item?.is_in_stock === 'boolean'
                            ? !item.is_in_stock
                            : (Number.isFinite(stock) ? stock <= 0 : false));
                    const cartItem = cartItems.find((entry) => String(entry.id) === String(item.id));
                    const quantity = cartItem?.quantity || 0;
                    const cartStock = Number(cartItem?.stock ?? item?.stock);
                    const hasFiniteStock = Number.isFinite(cartStock);
                    const showQtyControls = !isOutOfStock && quantity > 0;
                    const isIncreaseDisabled = hasFiniteStock && quantity >= cartStock;

                    return (
                    <article
                      key={item.id}
                      className={`profile-panel profile-favorite-row${isOutOfStock ? ' is-out-of-stock' : ''}`}
                    >
                      {item.is_gift_certificate ? (
                        <div className="profile-favorite-main">
                          <img
                            src={item.image || `${import.meta.env.BASE_URL}assets/account.png`}
                            alt={item.name}
                            className="profile-favorite-image"
                          />
                          <div className="profile-favorite-text">
                            <h3 className="profile-favorite-name">{item.name}</h3>
                            <div className="profile-favorite-price-row">
                              <p className="profile-favorite-price">{formatPrice(item.price)} ₽</p>
                              {isOutOfStock ? (
                                <span className="profile-favorite-stock-status">Нет в наличии</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Link to={`/product/${item.id}`} className="profile-favorite-link">
                          <div className="profile-favorite-main">
                            <img
                              src={item.image || `${import.meta.env.BASE_URL}assets/account.png`}
                              alt={item.name}
                              className="profile-favorite-image"
                            />
                            <div className="profile-favorite-text">
                              <h3 className="profile-favorite-name">{item.name}</h3>
                              <div className="profile-favorite-price-row">
                                <p className="profile-favorite-price">{formatPrice(item.price)} ₽</p>
                                {isOutOfStock ? (
                                  <span className="profile-favorite-stock-status">Нет в наличии</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )}
                      <div className="profile-favorite-actions">
                        {showQtyControls ? (
                          <div
                            className="profile-favorite-quantity"
                            role="group"
                            aria-label="Изменить количество"
                          >
                            <button
                              type="button"
                              className="quantity-btn product-card__qty-btn"
                              onClick={() => handleFavoriteQuantityChange(item.id, quantity - 1)}
                            >
                              −
                            </button>
                            <span className="profile-favorite-quantity-value">{quantity}</span>
                            <button
                              type="button"
                              className="quantity-btn product-card__qty-btn"
                              disabled={isIncreaseDisabled}
                              onClick={() => handleFavoriteQuantityChange(item.id, quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="profile-btn profile-btn--primary profile-btn--to-cart"
                            onClick={() => handleAddFavoriteToCart(item)}
                            disabled={isOutOfStock}
                          >
                            В КОРЗИНУ
                          </button>
                        )}
                        <button
                          type="button"
                          className="profile-btn profile-btn--outline profile-btn--remove"
                          onClick={() => removeFromFavorites(item.id)}
                        >
                          УДАЛИТЬ
                        </button>
                      </div>
                    </article>
                  )})
                )}
              </section>
            )}

            {activeTab === 'bonuses' && (
              <section className="profile-panel profile-bonuses-placeholder">
                <h2>Бонусная программа</h2>
                <p>Страница находится в разработке и скоро появится.</p>
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="profile-panel profile-settings">
                <label className="profile-field">
                  <span>ФИО</span>
                  <input
                    type="text"
                    placeholder="Иванов Иван Иванович"
                    value={fullNameInput}
                    maxLength={FULL_NAME_MAX_LENGTH}
                    className={`profile-settings-input${fullNameError ? ' is-invalid' : ''}`}
                    aria-invalid={fullNameError ? 'true' : 'false'}
                    onChange={(event) => {
                      setSettingsStatus({ type: '', message: '' });
                      setFullNameInput(normalizeFullNameInput(event.target.value));
                    }}
                  />
                  {fullNameError && <small className="profile-field-error">{fullNameError}</small>}
                </label>
                <label className="profile-field">
                  <span>Номер телефона</span>
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    className="profile-settings-input"
                    value={profile.phone}
                    onChange={(event) => {
                      setSettingsStatus({ type: '', message: '' });
                      setProfile((prev) => ({ ...prev, phone: formatRuPhone(event.target.value) }));
                    }}
                    onKeyDown={(event) => {
                      if (!isPhoneInputKeyAllowed(event)) {
                        event.preventDefault();
                      }
                    }}
                  />
                </label>
                <label className="profile-field">
                  <span>Дата рождения</span>
                  <input
                    type="text"
                    placeholder="15.10.1998"
                    className="profile-settings-input"
                    value={birthDate}
                    onChange={(event) => {
                      setSettingsStatus({ type: '', message: '' });
                      setBirthDate(formatBirthDateInput(event.target.value));
                    }}
                  />
                </label>
                <label className="profile-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="profile-settings-input"
                    value={profile.email}
                    onChange={(event) => {
                      setSettingsStatus({ type: '', message: '' });
                      setProfile((prev) => ({ ...prev, email: event.target.value }));
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="profile-btn profile-btn--primary profile-btn--full"
                  onClick={handleSaveSettings}
                  disabled={!isSettingsDirty || isSubmitting || Boolean(fullNameError)}
                >
                  {isSubmitting ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ ИЗМЕНЕНИЯ'}
                </button>
                {settingsStatus.message && (
                  <div className={`profile-settings-status profile-settings-status--${settingsStatus.type}`}>
                    {settingsStatus.message}
                  </div>
                )}
                <button
                  type="button"
                  className="profile-btn profile-btn--outline profile-btn--full"
                  onClick={handleLogout}
                >
                  ВЫЙТИ
                </button>
                <button
                  type="button"
                  className="profile-btn profile-btn--support profile-btn--full"
                  disabled
                >
                  УДАЛИТЬ АККАУНТ
                </button>
                <a
                  className="profile-support"
                  href="https://t.me/kokossimo_info_bot"
                  target="_blank"
                  rel="noreferrer"
                >
                  ПОДДЕРЖКА
                </a>
              </section>
            )}

            {status.message && (
              <div className={`profile-toast profile-toast--${status.type}`}>
                {status.message}
              </div>
            )}
            {favoriteCartToastVisible &&
              createPortal(
                <div className="profile-favorite-toast" aria-live="polite">
                  Товар добавлен в корзину.
                </div>,
                document.body
              )}
            {detailsOrder &&
              createPortal(
                <div
                  className="profile-modal"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setDetailsOrder(null);
                    }
                  }}
                >
                  <div className="profile-modal__dialog" onMouseDown={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="profile-modal__close"
                      onClick={() => setDetailsOrder(null)}
                      aria-label="Закрыть"
                    >
                      ×
                    </button>
                    <h3 className="profile-modal__title">ИНФОРМАЦИЯ О ЗАКАЗЕ</h3>
                    <div className="profile-modal__meta">
                      <div className="profile-modal__meta-label">Номер заказа</div>
                      <div className="profile-modal__meta-value">{detailsOrder.id}</div>
                      <div className="profile-modal__meta-label">Дата заказа</div>
                      <div className="profile-modal__meta-value">{new Date(detailsOrder.created_at).toLocaleDateString('ru-RU')}</div>
                      <div className="profile-modal__meta-label">Статус</div>
                      <div className="profile-modal__meta-value">{getOrderStatusLabel(detailsOrder.status)}</div>
                      <div className="profile-modal__meta-label">Адрес доставки</div>
                      <div className="profile-modal__meta-value">{formatOrderAddress(detailsOrder)}</div>
                    </div>
                    <h4 className="profile-modal__subtitle">СОСТАВ ЗАКАЗА</h4>
                    <div className="profile-modal__items">
                      {(detailsOrder.items || []).map((item, index) => (
                        (() => {
                          const productId = item.product_id ?? item.id;
                          const hasProductPage = !item.is_gift_certificate && Number.isFinite(Number(productId));
                          const openProductPage = () => {
                            if (!hasProductPage) return;
                            setDetailsOrder(null);
                            navigate(`/product/${productId}`);
                          };

                          return (
                            <article
                              key={`${detailsOrder.id}-${item.product_id || item.product_name}-${index}`}
                              className={`profile-modal__item ${hasProductPage ? 'profile-modal__item--clickable' : ''}`}
                              role={hasProductPage ? 'link' : undefined}
                              tabIndex={hasProductPage ? 0 : undefined}
                              onClick={hasProductPage ? openProductPage : undefined}
                              onKeyDown={
                                hasProductPage
                                  ? (event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        openProductPage();
                                      }
                                    }
                                  : undefined
                              }
                              aria-label={hasProductPage ? `Открыть товар ${item.product_name}` : undefined}
                            >
                              <img
                                src={item.product_image || `${import.meta.env.BASE_URL}assets/account.png`}
                                alt={item.product_name}
                                className="profile-modal__item-image"
                              />
                              <div className="profile-modal__item-main">
                                <div className="profile-modal__item-name">{item.product_name}</div>
                              </div>
                              <div className="profile-modal__item-price">{formatPrice(item.line_total || item.price)} ₽</div>
                            </article>
                          );
                        })()
                      ))}
                    </div>
                    <div className="profile-modal__total">Итого: {formatPrice(detailsOrder.total_price)} ₽</div>
                    <button
                      type="button"
                      className="profile-btn profile-btn--outline profile-modal__repeat-btn"
                      onClick={() => {
                        handleRepeatOrder(detailsOrder);
                        setDetailsOrder(null);
                      }}
                    >
                      ПОВТОРИТЬ ЗАКАЗ
                    </button>
                  </div>
                </div>,
                document.body
              )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
