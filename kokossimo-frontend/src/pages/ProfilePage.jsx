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
  const [birthDate, setBirthDate] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [settingsStatus, setSettingsStatus] = useState({ type: '', message: '' });
  const [settingsBaseline, setSettingsBaseline] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [detailsOrder, setDetailsOrder] = useState(null);

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
                    maxLength={FULL_NAME_MAX_LENGTH}
                    className={fullNameError ? 'is-invalid' : ''}
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
            {detailsOrder && (
              <div className="profile-modal" onClick={() => setDetailsOrder(null)}>
                <div className="profile-modal__dialog" onClick={(event) => event.stopPropagation()}>
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
                      <article
                        key={`${detailsOrder.id}-${item.product_id || item.product_name}-${index}`}
                        className="profile-modal__item"
                      >
                        <img
                          src={item.product_image || `${import.meta.env.BASE_URL}assets/account.png`}
                          alt={item.product_name}
                          className="profile-modal__item-image"
                        />
                        <div className="profile-modal__item-main">
                          <div className="profile-modal__item-name">{item.product_name}</div>
                          <div className="profile-modal__item-category">
                            {item.category_name || (item.is_gift_certificate ? 'Подарочный сертификат' : 'Категория товара')}
                          </div>
                        </div>
                        <div className="profile-modal__item-price">{formatPrice(item.line_total || item.price)} ₽</div>
                      </article>
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
              </div>
            )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
