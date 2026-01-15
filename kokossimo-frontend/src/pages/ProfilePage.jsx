import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, logoutUser, updateProfile } from '../services/api';
import './ProfilePage.css';

const ProfilePage = () => {
  const [profile, setProfile] = useState({
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
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    getCurrentUser(token)
      .then((response) => {
        setProfile(response.data);
      })
      .catch(() => {
        setStatus({ type: 'error', message: 'Не удалось загрузить профиль.' });
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
    } catch (error) {
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
    } catch (error) {
      setStatus({ type: 'error', message: 'Не удалось сохранить адрес.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };
  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      await logoutUser(token);
    } catch (error) {
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
      setStatus({ type: 'success', message: 'Вы вышли из аккаунта.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };
  return (
    <div className="profile-page page-animation">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Личный кабинет</span>
        </div>

        <h1 className="page-title">ЛИЧНЫЙ КАБИНЕТ</h1>

        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="profile-card">
              <div className="profile-avatar">К</div>
              <div className="profile-name">
                {profile.first_name || profile.last_name
                  ? `${profile.first_name} ${profile.last_name}`.trim()
                  : 'Гость'}
              </div>
              <div className="profile-meta">
                {profile.email || profile.phone
                  ? profile.email || profile.phone
                  : 'Войдите, чтобы сохранять заказы'}
              </div>
              {!profile.email && !profile.phone ? (
                <Link to="/auth" className="btn-primary btn-primary--full">
                  Вход/Регистрация
                </Link>
              ) : (
                <button className="btn-primary btn-primary--full" onClick={handleLogout}>
                  Выйти
                </button>
              )}
            </div>

          </aside>

          <section className="profile-content">
            <div className="profile-section">
              <h2 className="section-title">ЛИЧНЫЕ ДАННЫЕ</h2>
              <div className="profile-grid">
                <label className="profile-field">
                  <span>Имя</span>
                  <input
                    type="text"
                    placeholder="Введите имя"
                    value={profile.first_name}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, first_name: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Фамилия</span>
                  <input
                    type="text"
                    placeholder="Введите фамилию"
                    value={profile.last_name}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, last_name: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Телефон</span>
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, phone: event.target.value }))
                    }
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
              </div>
              <button className="btn-primary" onClick={handleSaveProfile}>
                Сохранить
              </button>
            </div>

            <div className="profile-section">
              <h2 className="section-title">АДРЕС ДОСТАВКИ</h2>
              <div className="profile-grid">
                <label className="profile-field">
                  <span>Город</span>
                  <input
                    type="text"
                    placeholder="Город"
                    value={profile.city}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, city: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Улица</span>
                  <input
                    type="text"
                    placeholder="Улица"
                    value={profile.street}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, street: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Дом</span>
                  <input
                    type="text"
                    placeholder="Дом"
                    value={profile.house}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, house: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Квартира</span>
                  <input
                    type="text"
                    placeholder="Квартира"
                    value={profile.apartment}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, apartment: event.target.value }))
                    }
                  />
                </label>
                <label className="profile-field">
                  <span>Индекс</span>
                  <input
                    type="text"
                    placeholder="000000"
                    value={profile.postal_code}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, postal_code: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button className="btn-primary" onClick={handleSaveAddress}>
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
