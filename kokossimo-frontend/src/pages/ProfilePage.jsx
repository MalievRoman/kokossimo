import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

const formatBirthDateInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}.${month}`;
  return `${day}.${month}.${year}`;
};

const ProfilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const isAuthenticated = Boolean(authToken);
  const { addToCart } = useCart();
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
  const [birthDate, setBirthDate] = useState(
    formatBirthDateInput(localStorage.getItem('profileBirthDate') || '')
  );
  const [status, setStatus] = useState({ type: '', message: '' });
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

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
        setProfile({
          ...response.data,
          phone: formatRuPhone(response.data?.phone || ''),
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

  const userName = useMemo(() => {
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    return fullName || 'Гость';
  }, [profile.first_name, profile.last_name]);

  const latestOrder = orders[0] || null;

  const formatPrice = (value) => Number(value || 0).toLocaleString('ru-RU');

  const getOrderStatusLabel = (orderStatus) => STATUS_LABELS[orderStatus] || orderStatus || '—';

  const showTemporaryStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 3000);
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/profile?tab=${tabKey}`);
  };

  const handleSaveSettings = async () => {
    if (!authToken) {
      showTemporaryStatus('error', 'Сначала войдите в аккаунт.');
      return;
    }

    const [firstName = '', ...rest] = fullNameInput.trim().split(/\s+/);
    const lastName = rest.join(' ');

    try {
      const response = await updateProfile(authToken, {
        first_name: firstName,
        last_name: lastName,
        email: profile.email,
        phone: profile.phone,
      });
      setProfile({
        ...response.data,
        phone: formatRuPhone(response.data?.phone || ''),
      });
      localStorage.setItem('profileBirthDate', birthDate);
      showTemporaryStatus('success', 'Данные профиля сохранены.');
    } catch (error) {
      if (error?.response?.status === 401) {
        resetAuthState('Сессия истекла. Войдите в аккаунт заново.');
        return;
      }
      showTemporaryStatus('error', 'Не удалось сохранить профиль.');
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
    addToCart(favoriteItem, 1);
    showTemporaryStatus('success', 'Товар добавлен в корзину.');
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
                  <div>
                    <h2 className="profile-user-name">{userName}</h2>
                    <p className="profile-user-meta">{profile.phone || '+7 (___) ___-__-__'}</p>
                    <p className="profile-user-meta">{profile.email || 'Добавьте email в параметрах'}</p>
                    <button
                      type="button"
                      className="profile-btn profile-btn--outline profile-btn--logout-main"
                      onClick={handleLogout}
                    >
                      ВЫЙТИ ИЗ ПРОФИЛЯ
                    </button>
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
                    <img
                      src={`${import.meta.env.BASE_URL}assets/cart.png`}
                      alt=""
                      aria-hidden="true"
                      className="profile-shortcut-icon"
                    />
                    МОИ ЗАКАЗЫ
                  </button>
                  <button
                    type="button"
                    className="profile-shortcut"
                    onClick={() => handleTabChange('favorites')}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}assets/heart.png`}
                      alt=""
                      aria-hidden="true"
                      className="profile-shortcut-icon"
                    />
                    ИЗБРАННОЕ
                  </button>
                </div>

                <section className="profile-panel profile-latest-order">
                  {!latestOrder ? (
                    <p className="profile-muted">Пока нет заказов.</p>
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
                          className="profile-btn profile-btn--primary profile-btn--repeat"
                          onClick={() => handleRepeatOrder(order)}
                        >
                          ПОВТОРИТЬ
                        </button>
                        <Link to="/catalog" className="profile-btn profile-btn--outline profile-btn--review">
                          ОСТАВИТЬ ОТЗЫВ
                        </Link>
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
                  favorites.map((item) => (
                    <article key={item.id} className="profile-panel profile-favorite-row">
                      <div className="profile-favorite-main">
                        <img
                          src={item.image || `${import.meta.env.BASE_URL}assets/account.png`}
                          alt={item.name}
                          className="profile-favorite-image"
                        />
                        <div>
                          <h3 className="profile-favorite-name">{item.name}</h3>
                          <p className="profile-favorite-price">{formatPrice(item.price)} ₽</p>
                        </div>
                      </div>
                      <div className="profile-favorite-actions">
                        <button
                          type="button"
                          className="profile-btn profile-btn--primary profile-btn--to-cart"
                          onClick={() => handleAddFavoriteToCart(item)}
                        >
                          В КОРЗИНУ
                        </button>
                        <button
                          type="button"
                          className="profile-btn profile-btn--outline profile-btn--remove"
                          onClick={() => removeFromFavorites(item.id)}
                        >
                          УДАЛИТЬ
                        </button>
                      </div>
                    </article>
                  ))
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
                    onChange={(event) => setFullNameInput(event.target.value)}
                  />
                </label>
                <label className="profile-field">
                  <span>Номер телефона</span>
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, phone: formatRuPhone(event.target.value) }))
                    }
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
                    value={birthDate}
                    onChange={(event) => setBirthDate(formatBirthDateInput(event.target.value))}
                  />
                </label>
                <label className="profile-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className="profile-btn profile-btn--primary profile-btn--full"
                  onClick={handleSaveSettings}
                >
                  СОХРАНИТЬ ИЗМЕНЕНИЯ
                </button>
                <button
                  type="button"
                  className="profile-btn profile-btn--outline profile-btn--full"
                  onClick={handleLogout}
                >
                  ВЫЙТИ
                </button>
                <button
                  type="button"
                  className="profile-btn profile-btn--disabled profile-btn--full"
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
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
