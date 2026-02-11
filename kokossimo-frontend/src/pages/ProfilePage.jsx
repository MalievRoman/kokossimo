import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, getMyOrders, logoutUser, updateProfile } from '../services/api';
import { formatRuPhone, isPhoneInputKeyAllowed } from '../utils/phone';
import './ProfilePage.css';

const ProfilePage = () => {
  const isAuthenticated = Boolean(localStorage.getItem('authToken'));
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
  const [status, setStatus] = useState({ type: '', message: '' });
  const [orders, setOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setOrdersLoading(false);
      return;
    }

    getCurrentUser(token)
      .then((response) => {
        setProfile({
          ...response.data,
          phone: formatRuPhone(response.data?.phone || ''),
        });
      })
      .catch(() => {
        setStatus({ type: 'error', message: 'Не удалось загрузить профиль.' });
      });

    getMyOrders(token)
      .then((response) => {
        setOrders(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        setOrders([]);
      })
      .finally(() => {
        setOrdersLoading(false);
      });
  }, []);

  const handleSaveProfile = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setStatus({ type: 'error', message: 'Сначала войдите в аккаунт.' });
      return;
    }

    try {
      const response = await updateProfile(token, {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone,
      });
      setProfile(response.data);
      setStatus({ type: 'success', message: 'Данные профиля сохранены.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch {
      setStatus({ type: 'error', message: 'Не удалось сохранить профиль.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };

  const handleSaveAddress = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setStatus({ type: 'error', message: 'Сначала войдите в аккаунт.' });
      return;
    }

    try {
      const response = await updateProfile(token, {
        city: profile.city,
        street: profile.street,
        house: profile.house,
        apartment: profile.apartment,
        postal_code: profile.postal_code,
      });
      setProfile(response.data);
      setStatus({ type: 'success', message: 'Адрес доставки сохранен.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch {
      setStatus({ type: 'error', message: 'Не удалось сохранить адрес.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };
  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      await logoutUser(token);
    } catch {
      // Даже если сервер не ответил, очищаем токен локально
    } finally {
      localStorage.removeItem('authToken');
      setProfile({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        city: '',
        street: '',
        house: '',
        apartment: '',
        postal_code: '',
      });
      setOrders([]);
      setOrdersLoading(false);
      setStatus({ type: 'success', message: 'Вы вышли из аккаунта.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };
  return (
    <div className="profile-page page-animation py-4 py-md-5">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Личный кабинет</span>
        </div>

        <h1 className="page-title">ЛИЧНЫЙ КАБИНЕТ</h1>

        <div className="profile-layout row g-4 mt-2">
          <aside className="profile-sidebar col-12 col-xl-3">
            <div className="profile-card border rounded-3 p-4 text-center bg-body-tertiary">
              <div className="profile-avatar">К</div>
              <div className="profile-name">
                {profile.first_name || profile.last_name
                  ? `${profile.first_name} ${profile.last_name}`.trim()
                  : 'Гость'}
              </div>
              <div className="profile-meta">
                {isAuthenticated
                  ? profile.email || (profile.phone !== '+7' ? profile.phone : 'Заполните профиль')
                  : 'Войдите, чтобы сохранять заказы'}
              </div>
              {!isAuthenticated ? (
                <Link to="/auth" className="btn btn-primary w-100">
                  Вход/Регистрация
                </Link>
              ) : (
                <button className="btn btn-primary w-100" onClick={handleLogout}>
                  Выйти
                </button>
              )}
            </div>

          </aside>

          <section className="profile-content col-12 col-xl-9 d-grid gap-4">
            <div className="profile-section border rounded-3 p-4 bg-white">
              <h2 className="section-title">ИСТОРИЯ ЗАКАЗОВ</h2>
              {ordersLoading ? (
                <p style={{ color: '#777' }}>Загрузка заказов...</p>
              ) : orders.length === 0 ? (
                <p style={{ color: '#777' }}>Заказов пока нет.</p>
              ) : (
                <div className="profile-orders">
                  {orders.map((order) => {
                    const isExpanded = Boolean(expandedOrders[order.id]);
                    return (
                      <div
                        key={order.id}
                        className="profile-order-card"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setExpandedOrders((prev) => ({
                            ...prev,
                            [order.id]: !prev[order.id],
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedOrders((prev) => ({
                              ...prev,
                              [order.id]: !prev[order.id],
                            }));
                          }
                        }}
                      >
                      <div>
                        <div className="profile-order-title">Заказ #{order.id}</div>
                        <div className="profile-order-meta">
                          {new Date(order.created_at).toLocaleDateString('ru-RU')} ·{' '}
                          {order.items?.length || 0} товаров
                        </div>
                        {isExpanded && order.items?.length > 0 && (
                          <div className="profile-order-items">
                            {order.items.map((item) => (
                              <div key={`${order.id}-${item.product_id || item.product_name}`} className="profile-order-item">
                                <span className="profile-order-item-name">{item.product_name}</span>
                                <span className="profile-order-item-qty">× {item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="profile-order-status">
                        <span className="profile-order-status-label">{order.status}</span>
                        <span className="profile-order-total">
                          {Number(order.total_price).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="profile-section border rounded-3 p-4 bg-white">
              <h2 className="section-title">ЛИЧНЫЕ ДАННЫЕ</h2>
              <div className="profile-grid row g-3">
                <label className="profile-field col-12 col-md-6">
                  <span>Имя</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Введите имя"
                    value={profile.first_name}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, first_name: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Фамилия</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Введите фамилию"
                    value={profile.last_name}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, last_name: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Телефон</span>
                  <input
                    className="form-control"
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
                <label className="profile-field col-12 col-md-6">
                  <span>Email</span>
                  <input
                    className="form-control"
                    type="email"
                    placeholder="email@example.com"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button className="btn btn-primary" onClick={handleSaveProfile}>
                Сохранить
              </button>
            </div>

            <div className="profile-section border rounded-3 p-4 bg-white">
              <h2 className="section-title">АДРЕС ДОСТАВКИ</h2>
              <div className="profile-grid row g-3">
                <label className="profile-field col-12 col-md-6">
                  <span>Город</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Город"
                    value={profile.city}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, city: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Улица</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Улица"
                    value={profile.street}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, street: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Дом</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Дом"
                    value={profile.house}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, house: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Квартира</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Квартира"
                    value={profile.apartment}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, apartment: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field col-12 col-md-6">
                  <span>Индекс</span>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="000000"
                    value={profile.postal_code}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, postal_code: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button className="btn btn-primary" onClick={handleSaveAddress}>
                Сохранить адрес
              </button>
            </div>

          </section>
        </div>
        {status.message && (
          <div className={`profile-toast profile-toast--${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
