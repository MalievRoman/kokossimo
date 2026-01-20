import React, { useState } from 'react';
import { registerUser, loginUser, sendEmailCode, verifyEmailCode } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPage.css';

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [authMethod, setAuthMethod] = useState('phone');
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    identifier: '',
    password: '',
    passwordRepeat: '',
    emailCode: '',
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    if (activeTab === 'register' && form.password !== form.passwordRepeat) {
      setStatus({ type: 'error', message: 'Пароли не совпадают.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMethod === 'email') {
        const response = await verifyEmailCode({
          email: form.identifier,
          code: form.emailCode,
          purpose: activeTab === 'login' ? 'login' : 'register',
          password: activeTab === 'register' ? form.password : undefined,
          first_name: activeTab === 'register' ? form.name : undefined,
          last_name: activeTab === 'register' ? form.lastName : undefined,
        });
        localStorage.setItem('authToken', response.data.token);
        setStatus({
          type: 'success',
          message: activeTab === 'login' ? 'Вы вошли в аккаунт.' : 'Аккаунт создан.',
        });
        navigate('/profile');
        return;
      }

      if (activeTab === 'login') {
        const response = await loginUser({
          identifier: form.identifier,
          password: form.password,
        });
        localStorage.setItem('authToken', response.data.token);
        setStatus({ type: 'success', message: 'Вы вошли в аккаунт.' });
        navigate('/profile');
      } else {
        const response = await registerUser({
          method: authMethod,
          identifier: form.identifier,
          password: form.password,
          first_name: form.name,
          last_name: form.lastName,
        });
        localStorage.setItem('authToken', response.data.token);
        setStatus({ type: 'success', message: 'Аккаунт создан.' });
        navigate('/profile');
      }
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось выполнить операцию. Проверьте данные.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    setStatus({ type: '', message: '' });
    if (!form.identifier) {
      setStatus({ type: 'error', message: 'Введите email для отправки кода.' });
      return;
    }
    setIsSendingCode(true);
    try {
      const response = await sendEmailCode({
        email: form.identifier,
        purpose: activeTab === 'login' ? 'login' : 'register',
      });
      setStatus({ type: 'success', message: response.data?.detail || 'Код отправлен.' });
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось отправить код. Проверьте email.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  return (
    <div className="auth-page page-animation">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Вход и регистрация</span>
        </div>

        <h1 className="page-title">АККАУНТ</h1>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === 'login' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Вход
            </button>
            <button
              className={`auth-tab ${activeTab === 'register' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-methods">
            <button
              className={`auth-method ${authMethod === 'phone' ? 'is-active' : ''}`}
              onClick={() => setAuthMethod('phone')}
            >
              По номеру телефона
            </button>
            <button
              className={`auth-method ${authMethod === 'email' ? 'is-active' : ''}`}
              onClick={() => setAuthMethod('email')}
            >
              По почте
            </button>
          </div>

          {activeTab === 'login' ? (
            <form className="auth-form" onSubmit={handleSubmit}>
              {authMethod === 'phone' ? (
                <label className="auth-field">
                  <span>Номер телефона</span>
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={form.identifier}
                    onChange={handleChange('identifier')}
                  />
                </label>
              ) : (
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={form.identifier}
                    onChange={handleChange('identifier')}
                  />
                </label>
              )}

              {authMethod === 'phone' && (
                <label className="auth-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    value={form.password}
                    onChange={handleChange('password')}
                  />
                </label>
              )}

              {authMethod === 'email' && (
                <>
                  <div className="auth-field auth-field--inline">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleSendCode}
                      disabled={isSendingCode}
                    >
                      {isSendingCode ? 'ОТПРАВКА...' : 'Отправить код'}
                    </button>
                  </div>
                  <label className="auth-field">
                    <span>Код из письма</span>
                    <input
                      type="text"
                      placeholder="Введите код"
                      value={form.emailCode}
                      onChange={handleChange('emailCode')}
                    />
                  </label>
                </>
              )}

              <button type="submit" className="btn-primary btn-primary--full" disabled={isSubmitting}>
                {isSubmitting ? 'ВХОД...' : 'Войти'}
              </button>
              <Link to="/" className="btn-link btn-link--center">
                Забыли пароль?
              </Link>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>Имя</span>
                <input
                  type="text"
                  placeholder="Введите имя"
                  value={form.name}
                  onChange={handleChange('name')}
                />
              </label>
              <label className="auth-field">
                <span>Фамилия</span>
                <input
                  type="text"
                  placeholder="Введите фамилию"
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                />
              </label>

              {authMethod === 'phone' ? (
                <label className="auth-field">
                  <span>Номер телефона</span>
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={form.identifier}
                    onChange={handleChange('identifier')}
                  />
                </label>
              ) : (
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={form.identifier}
                    onChange={handleChange('identifier')}
                  />
                </label>
              )}

              <label className="auth-field">
                <span>Пароль</span>
                <input
                  type="password"
                  placeholder="Придумайте пароль"
                  value={form.password}
                  onChange={handleChange('password')}
                />
              </label>

              <label className="auth-field">
                <span>Повторите пароль</span>
                <input
                  type="password"
                  placeholder="Повторите пароль"
                  value={form.passwordRepeat}
                  onChange={handleChange('passwordRepeat')}
                />
              </label>

              {authMethod === 'email' && (
                <>
                  <div className="auth-field auth-field--inline">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleSendCode}
                      disabled={isSendingCode}
                    >
                      {isSendingCode ? 'ОТПРАВКА...' : 'Отправить код'}
                    </button>
                  </div>
                  <label className="auth-field">
                    <span>Код из письма</span>
                    <input
                      type="text"
                      placeholder="Введите код"
                      value={form.emailCode}
                      onChange={handleChange('emailCode')}
                    />
                  </label>
                </>
              )}

              <button type="submit" className="btn-primary btn-primary--full" disabled={isSubmitting}>
                {isSubmitting ? 'СОЗДАНИЕ...' : 'Создать аккаунт'}
              </button>
              <p className="auth-note">
                Нажимая «Создать аккаунт», вы соглашаетесь с условиями обработки
                персональных данных.
              </p>
            </form>
          )}
          {status.message && (
            <p className={`auth-status auth-status--${status.type}`}>
              {status.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
