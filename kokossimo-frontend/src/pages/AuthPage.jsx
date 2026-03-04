import React, { useEffect, useMemo, useState } from 'react';
import { loginUser, sendEmailCode, verifyEmailCode } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

const AuthPage = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState('intro');
  const [authToken, setAuthToken] = useState('');
  const [form, setForm] = useState({
    loginEmail: '',
    loginPassword: '',
    registerEmail: '',
    registerPassword: '',
    registerPasswordRepeat: '',
    registerCode: '',
    resetEmail: '',
    resetCode: '',
    resetPassword: '',
    resetPasswordRepeat: '',
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const canResendCode = resendSeconds === 0;

  const backLabel = useMemo(() => {
    if (screen === 'login' || screen === 'register' || screen === 'restoreRequest') {
      return 'назад';
    }
    return 'вернуться';
  }, [screen]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }
    const timerId = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [resendSeconds]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const clearStatus = () => setStatus({ type: '', message: '' });

  const startCooldown = () => setResendSeconds(120);

  const goToScreen = (nextScreen) => {
    clearStatus();
    setScreen(nextScreen);
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.loginEmail || !form.loginPassword) {
      setStatus({ type: 'error', message: 'Введите email и пароль.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await loginUser({
        identifier: form.loginEmail,
        password: form.loginPassword,
      });
      localStorage.setItem('authToken', response.data.token);
      window.dispatchEvent(new Event('auth-token-changed'));
      navigate('/profile');
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось выполнить операцию. Проверьте данные.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterStart = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.registerEmail || !form.registerPassword || !form.registerPasswordRepeat) {
      setStatus({ type: 'error', message: 'Заполните все поля.' });
      return;
    }
    if (form.registerPassword !== form.registerPasswordRepeat) {
      setStatus({ type: 'error', message: 'Пароли не совпадают.' });
      return;
    }
    setIsSendingCode(true);
    try {
      await sendEmailCode({
        email: form.registerEmail,
        purpose: 'register',
      });
      startCooldown();
      setScreen('registerCode');
      setStatus({ type: 'success', message: 'Код подтверждения отправлен на почту.' });
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось отправить код. Проверьте email.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRegisterVerify = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.registerCode) {
      setStatus({ type: 'error', message: 'Введите код подтверждения.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await verifyEmailCode({
        email: form.registerEmail,
        code: form.registerCode,
        purpose: 'register',
        password: form.registerPassword,
      });
      localStorage.setItem('authToken', response.data.token);
      window.dispatchEvent(new Event('auth-token-changed'));
      setAuthToken(response.data.token);
      setScreen('registerSuccess');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Неверный или просроченный код.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendRegisterCode = async () => {
    if (!canResendCode) {
      return;
    }
    clearStatus();
    setIsSendingCode(true);
    try {
      await sendEmailCode({
        email: form.registerEmail,
        purpose: 'register',
      });
      startCooldown();
      setStatus({ type: 'success', message: 'Новый код отправлен.' });
    } catch (error) {
      const message = error?.response?.data?.detail || 'Не удалось отправить код повторно.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRestoreRequest = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.resetEmail) {
      setStatus({ type: 'error', message: 'Введите email.' });
      return;
    }
    setIsSendingCode(true);
    try {
      await sendEmailCode({
        email: form.resetEmail,
        purpose: 'reset',
      });
      startCooldown();
      setScreen('restoreSent');
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось отправить код. Проверьте email.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRestorePassword = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.resetCode || !form.resetPassword || !form.resetPasswordRepeat) {
      setStatus({ type: 'error', message: 'Заполните все поля.' });
      return;
    }
    if (form.resetPassword !== form.resetPasswordRepeat) {
      setStatus({ type: 'error', message: 'Пароли не совпадают.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyEmailCode({
        email: form.resetEmail,
        code: form.resetCode,
        purpose: 'reset',
        password: form.resetPassword,
      });
      setScreen('restoreSuccess');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Неверный или просроченный код.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page page-animation">
      <div className="auth-layout">
        <div className="auth-brand">
          <div className="auth-brand-logo-wrap">
            <img src="/assets/full_logo.png" alt="Кокоссимо" className="auth-brand-logo" />
          </div>
        </div>
        <div className="auth-panel">
          <div className="auth-panel-inner">
            {screen === 'intro' && (
              <div className="auth-content">
                <h1 className="auth-title auth-title--cabinet">Личный кабинет</h1>
                <button type="button" className="auth-btn auth-btn--primary auth-btn--intro-login" onClick={() => goToScreen('login')}>
                  Войти
                </button>
                <button type="button" className="auth-btn auth-btn--ghost auth-btn--intro-register" onClick={() => goToScreen('register')}>
                  Зарегистрироваться
                </button>
                <button type="button" className="auth-link auth-link--forgot" onClick={() => goToScreen('restoreRequest')}>
                  Забыли пароль?
                </button>
                <button type="button" className="auth-back-link auth-back-link--site" onClick={() => navigate('/')}>
                  <span aria-hidden="true">‹</span> Обратно на сайт
                </button>
              </div>
            )}

            {screen === 'login' && (
              <form className="auth-content auth-form auth-form--login" onSubmit={handleLoginSubmit}>
                <h1 className="auth-title auth-title--login">Вход</h1>
                <label className="auth-field">
                  <span>Почта</span>
                  <input
                    type="email"
                    placeholder="Ваш email"
                    value={form.loginEmail}
                    onChange={handleChange('loginEmail')}
                  />
                </label>
                <label className="auth-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    placeholder="Ваш пароль"
                    value={form.loginPassword}
                    onChange={handleChange('loginPassword')}
                  />
                </label>
                <button type="button" className="auth-link auth-link--forgot" onClick={() => goToScreen('restoreRequest')}>
                  Забыли пароль?
                </button>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--login" disabled={isSubmitting}>
                  {isSubmitting ? 'Вход...' : 'Войти'}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('intro')}>
                  <span aria-hidden="true">‹</span> {backLabel}
                </button>
              </form>
            )}

            {screen === 'register' && (
              <form className="auth-content auth-form auth-form--register" onSubmit={handleRegisterStart}>
                <h1 className="auth-title auth-title--register">Регистрация</h1>
                <label className="auth-field">
                  <span>Почта</span>
                  <input
                    type="email"
                    placeholder="Введите Ваш email"
                    value={form.registerEmail}
                    onChange={handleChange('registerEmail')}
                  />
                </label>
                <label className="auth-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    placeholder="Придумайте пароль"
                    value={form.registerPassword}
                    onChange={handleChange('registerPassword')}
                  />
                </label>
                <label className="auth-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    placeholder="Повторите пароль еще раз"
                    value={form.registerPasswordRepeat}
                    onChange={handleChange('registerPasswordRepeat')}
                  />
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSendingCode}>
                  {isSendingCode ? 'Отправка...' : 'Продолжить'}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('intro')}>
                  <span aria-hidden="true">‹</span> {backLabel}
                </button>
              </form>
            )}

            {screen === 'registerCode' && (
              <form className="auth-content auth-form auth-form--register-code" onSubmit={handleRegisterVerify}>
                <h1 className="auth-title auth-title--register">Регистрация</h1>
                <p className="auth-description">
                  На вашу электронную почту отправлен код подтверждения. Если письмо не пришло, проверьте
                  папку &laquo;Спам&raquo;.
                </p>
                <label className="auth-field">
                  <span>Код</span>
                  <input
                    type="text"
                    placeholder="Введите код подтверждения"
                    value={form.registerCode}
                    onChange={handleChange('registerCode')}
                  />
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Проверка...' : 'Продолжить'}
                </button>
                <button
                  type="button"
                  className="auth-link auth-link--resend"
                  onClick={resendRegisterCode}
                  disabled={isSendingCode || !canResendCode}
                >
                  {canResendCode ? 'Отправить повторно' : `Отправить повторно ${resendSeconds}`}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('register')}>
                  <span aria-hidden="true">‹</span> назад
                </button>
              </form>
            )}

            {screen === 'registerSuccess' && (
              <div className="auth-content auth-content--center">
                <h1 className="auth-title auth-title--success-register">Вы успешно зарегистрированы</h1>
                <img src="/assets/congrats.png" alt="Успешно" className="auth-congrats-image" />
                <button
                  type="button"
                  className="auth-btn auth-btn--primary auth-btn--form-primary"
                  onClick={() => {
                    if (authToken) {
                      localStorage.setItem('authToken', authToken);
                      window.dispatchEvent(new Event('auth-token-changed'));
                    }
                    navigate('/profile');
                  }}
                >
                  В личный кабинет
                </button>
              </div>
            )}

            {screen === 'restoreRequest' && (
              <form className="auth-content auth-form auth-form--restore-request" onSubmit={handleRestoreRequest}>
                <h1 className="auth-title auth-title--restore">Восстановление профиля</h1>
                <p className="auth-description">Введите электронную почту вашего аккаунта</p>
                <label className="auth-field">
                  <span>Почта</span>
                  <input
                    type="email"
                    placeholder="Введите Ваш email"
                    value={form.resetEmail}
                    onChange={handleChange('resetEmail')}
                  />
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSendingCode}>
                  {isSendingCode ? 'Отправка...' : 'Продолжить'}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('login')}>
                  <span aria-hidden="true">‹</span> назад
                </button>
              </form>
            )}

            {screen === 'restoreSent' && (
              <div className="auth-content">
                <h1 className="auth-title">Восстановление профиля</h1>
                <p className="auth-description">
                  На Вашу электронную почту была выслана инструкция по сбросу пароля
                </p>
                <button type="button" className="auth-btn auth-btn--primary" onClick={() => goToScreen('login')}>
                  Вернуться ко входу
                </button>
                <button type="button" className="auth-link auth-link--muted" onClick={() => goToScreen('restorePassword')}>
                  У меня есть код
                </button>
              </div>
            )}

            {screen === 'restorePassword' && (
              <form className="auth-content auth-form auth-form--restore-password" onSubmit={handleRestorePassword}>
                <h1 className="auth-title auth-title--restore">Придумайте пароль</h1>
                <label className="auth-field">
                  <span>Код подтверждения</span>
                  <input
                    type="text"
                    placeholder="Введите код из письма"
                    value={form.resetCode}
                    onChange={handleChange('resetCode')}
                  />
                </label>
                <label className="auth-field">
                  <span>Новый пароль</span>
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    value={form.resetPassword}
                    onChange={handleChange('resetPassword')}
                  />
                </label>
                <label className="auth-field">
                  <span>Новый пароль</span>
                  <input
                    type="password"
                    placeholder="Повторите пароль еще раз"
                    value={form.resetPasswordRepeat}
                    onChange={handleChange('resetPasswordRepeat')}
                  />
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохранение...' : 'Подтвердить'}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('restoreRequest')}>
                  <span aria-hidden="true">‹</span> назад
                </button>
              </form>
            )}

            {screen === 'restoreSuccess' && (
              <div className="auth-content auth-content--center">
                <h1 className="auth-title auth-title--center">Пароль успешно восстановлен</h1>
                <img src="/assets/congrats.png" alt="Успешно" className="auth-congrats-image" />
                <button type="button" className="auth-btn auth-btn--primary" onClick={() => goToScreen('login')}>
                  Вернуться ко входу
                </button>
              </div>
            )}

            {status.message && <p className={`auth-status auth-status--${status.type}`}>{status.message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
