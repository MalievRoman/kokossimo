import React, { useEffect, useMemo, useState } from 'react';
import { loginUser, sendEmailCode, verifyEmailCode } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

const AuthPage = () => {
  const REGISTER_RESEND_SECONDS = 120;
  const RESET_RESEND_SECONDS = 20;
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
  const [resetToken, setResetToken] = useState('');
  const [resendSeconds, setResendSeconds] = useState({
    register: 0,
    reset: 0,
  });
  const [lastCodeEmails, setLastCodeEmails] = useState({
    register: '',
    reset: '',
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    loginPassword: false,
    registerPassword: false,
    registerPasswordRepeat: false,
    resetPassword: false,
    resetPasswordRepeat: false,
  });

  const canResendRegisterCode = resendSeconds.register === 0;
  const canResendResetCode = resendSeconds.reset === 0;

  const backLabel = useMemo(() => {
    if (screen === 'login' || screen === 'register' || screen === 'restoreRequest') {
      return 'назад';
    }
    return 'вернуться';
  }, [screen]);

  useEffect(() => {
    if (resendSeconds.register <= 0 && resendSeconds.reset <= 0) {
      return undefined;
    }
    const timerId = setInterval(() => {
      setResendSeconds((prev) => ({
        register: prev.register > 0 ? prev.register - 1 : 0,
        reset: prev.reset > 0 ? prev.reset - 1 : 0,
      }));
    }, 1000);
    return () => clearInterval(timerId);
  }, [resendSeconds]);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return undefined;

    const previousContent = viewport.getAttribute('content') || '';
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );

    return () => {
      viewport.setAttribute('content', previousContent);
    };
  }, []);

  const clearStatus = () => setStatus({ type: '', message: '' });

  const MIN_PASSWORD_LENGTH = 6;

  const startCooldown = (purpose, seconds) => {
    setResendSeconds((prev) => ({
      ...prev,
      [purpose]: Math.max(0, Number(seconds) || 0),
    }));
  };

  const getCooldownSeconds = (responseData, fallbackSeconds) => {
    const secondsLeft = Number(responseData?.seconds_left);
    return Number.isFinite(secondsLeft) && secondsLeft > 0 ? secondsLeft : fallbackSeconds;
  };

  const DEFAULT_SERVER_ERROR_MESSAGE = 'Что-то пошло не так. Попробуйте позже.';

  const isServerSideFailure = (error) => {
    const statusCode = error?.response?.status;
    if (typeof statusCode === 'number') {
      return statusCode >= 500;
    }
    // Network / CORS / timeout cases: no response received.
    return Boolean(error);
  };

  const getAuthErrorMessage = (error, fallbackMessage) => {
    if (isServerSideFailure(error)) {
      return DEFAULT_SERVER_ERROR_MESSAGE;
    }

    const data = error?.response?.data;
    if (!data) {
      return fallbackMessage;
    }

    if (typeof data.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }

    const passwordError = data.password?.[0] || data.password;
    if (typeof passwordError === 'string' && passwordError.trim()) {
      return passwordError;
    }

    const codeError = data.code?.[0] || data.code;
    if (typeof codeError === 'string' && codeError.trim()) {
      return codeError;
    }

    const firstFieldError = Object.values(data).find((value) =>
      typeof value === 'string' || (Array.isArray(value) && typeof value[0] === 'string')
    );
    if (typeof firstFieldError === 'string') {
      return firstFieldError;
    }
    if (Array.isArray(firstFieldError) && typeof firstFieldError[0] === 'string') {
      return firstFieldError[0];
    }

    return fallbackMessage;
  };

  const goToScreen = (nextScreen) => {
    clearStatus();
    if (nextScreen === 'restoreRequest') {
      setResetToken('');
      setForm((prev) => ({
        ...prev,
        resetCode: '',
        resetPassword: '',
        resetPasswordRepeat: '',
      }));
    }
    setScreen(nextScreen);
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
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
      const serverFallback = DEFAULT_SERVER_ERROR_MESSAGE;
      const validationFallback = 'Не удалось выполнить операцию. Проверьте данные.';
      const fallback = isServerSideFailure(error) ? serverFallback : validationFallback;
      const message = error?.response?.data?.detail || fallback;
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
    if (form.registerPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus({ type: 'error', message: `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов.` });
      return;
    }
    if (resendSeconds.register > 0 && lastCodeEmails.register === form.registerEmail) {
      setScreen('registerCode');
      setStatus({ type: 'success', message: 'Код уже отправлен. Введите код из письма или дождитесь таймера.' });
      return;
    }
    setIsSendingCode(true);
    try {
      const response = await sendEmailCode({
        email: form.registerEmail,
        purpose: 'register',
      });
      setLastCodeEmails((prev) => ({ ...prev, register: form.registerEmail }));
      startCooldown('register', getCooldownSeconds(response?.data, REGISTER_RESEND_SECONDS));
      setScreen('registerCode');
      setStatus({ type: 'success', message: response?.data?.detail || 'Код подтверждения отправлен на почту.' });
    } catch (error) {
      const serverFallback = DEFAULT_SERVER_ERROR_MESSAGE;
      const validationFallback = 'Не удалось отправить код. Проверьте email.';
      const fallback = isServerSideFailure(error) ? serverFallback : validationFallback;
      const message = error?.response?.data?.detail || fallback;
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
      const message = getAuthErrorMessage(error, 'Неверный или просроченный код.');
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendRegisterCode = async () => {
    if (!canResendRegisterCode) {
      return;
    }
    clearStatus();
    setIsSendingCode(true);
    try {
      const response = await sendEmailCode({
        email: form.registerEmail,
        purpose: 'register',
      });
      startCooldown('register', getCooldownSeconds(response?.data, REGISTER_RESEND_SECONDS));
      setStatus({ type: 'success', message: response?.data?.detail || 'Новый код отправлен.' });
    } catch (error) {
      const fallback = isServerSideFailure(error) ? DEFAULT_SERVER_ERROR_MESSAGE : 'Не удалось отправить код повторно.';
      const message = error?.response?.data?.detail || fallback;
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
    if (resendSeconds.reset > 0 && lastCodeEmails.reset === form.resetEmail) {
      setScreen('restoreCode');
      return;
    }
    setIsSendingCode(true);
    try {
      const response = await sendEmailCode({
        email: form.resetEmail,
        purpose: 'reset',
      });
      setResetToken('');
      setLastCodeEmails((prev) => ({ ...prev, reset: form.resetEmail }));
      startCooldown('reset', getCooldownSeconds(response?.data, RESET_RESEND_SECONDS));
      setScreen('restoreCode');
    } catch (error) {
      const serverFallback = DEFAULT_SERVER_ERROR_MESSAGE;
      const validationFallback = 'Не удалось отправить код. Проверьте email.';
      const fallback = isServerSideFailure(error) ? serverFallback : validationFallback;
      const message = error?.response?.data?.detail || fallback;
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRestoreCodeVerify = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!form.resetCode) {
      setStatus({ type: 'error', message: 'Введите код подтверждения.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await verifyEmailCode({
        email: form.resetEmail,
        code: form.resetCode,
        purpose: 'reset',
      });
      setResetToken(response?.data?.reset_token || '');
      setScreen('restorePassword');
    } catch (error) {
      const message = getAuthErrorMessage(error, 'Неверный или просроченный код.');
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendResetCode = async () => {
    if (!canResendResetCode) {
      return;
    }
    clearStatus();
    setIsSendingCode(true);
    try {
      const response = await sendEmailCode({
        email: form.resetEmail,
        purpose: 'reset',
      });
      startCooldown('reset', getCooldownSeconds(response?.data, RESET_RESEND_SECONDS));
    } catch (error) {
      const fallback = isServerSideFailure(error) ? DEFAULT_SERVER_ERROR_MESSAGE : 'Не удалось отправить код повторно.';
      const message = error?.response?.data?.detail || fallback;
      setStatus({ type: 'error', message });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleRestorePassword = async (event) => {
    event.preventDefault();
    clearStatus();
    if (!resetToken) {
      setScreen('restoreCode');
      setStatus({ type: 'error', message: 'Сначала подтвердите код из письма.' });
      return;
    }
    if (!form.resetPassword || !form.resetPasswordRepeat) {
      setStatus({ type: 'error', message: 'Заполните оба поля пароля.' });
      return;
    }
    if (form.resetPassword !== form.resetPasswordRepeat) {
      setStatus({ type: 'error', message: 'Пароли не совпадают.' });
      return;
    }
    if (form.resetPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus({ type: 'error', message: `Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов.` });
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyEmailCode({
        email: form.resetEmail,
        purpose: 'reset',
        reset_token: resetToken,
        password: form.resetPassword,
      });
      setResetToken('');
      setScreen('restoreSuccess');
    } catch (error) {
      const message = getAuthErrorMessage(error, 'Неверный или просроченный код.');
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__overlay" />
      <div className="auth-layout">
        <div className="auth-panel">
          <div className="auth-panel-inner page-animation" key={screen}>
            {screen === 'intro' && (
              <div className="auth-content">
                <h1 className="auth-title auth-title--cabinet">Личный кабинет</h1>
                <button type="button" className="auth-btn auth-btn--primary auth-btn--intro-login" onClick={() => goToScreen('login')}>
                  Войти
                </button>
                <button type="button" className="auth-btn auth-btn--ghost auth-btn--intro-register" onClick={() => goToScreen('register')}>
                  Зарегистрироваться
                </button>
                <button type="button" className="auth-link auth-link--forgot auth-link--intro-forgot" onClick={() => goToScreen('restoreRequest')}>
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
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisibility.loginPassword ? 'text' : 'password'}
                      placeholder="Ваш пароль"
                      value={form.loginPassword}
                      onChange={handleChange('loginPassword')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('loginPassword')}
                      aria-label={passwordVisibility.loginPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3.5" />
                        {passwordVisibility.loginPassword ? null : <line x1="4" y1="20" x2="20" y2="4" />}
                      </svg>
                    </button>
                  </div>
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
                  <span>Почта <em className="auth-required">*</em></span>
                  <input
                    type="email"
                    placeholder="Введите Ваш email"
                    value={form.registerEmail}
                    onChange={handleChange('registerEmail')}
                  />
                </label>
                <label className="auth-field">
                  <span>Пароль <em className="auth-required">*</em></span>
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisibility.registerPassword ? 'text' : 'password'}
                      placeholder="Придумайте пароль"
                      value={form.registerPassword}
                      onChange={handleChange('registerPassword')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('registerPassword')}
                      aria-label={passwordVisibility.registerPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3.5" />
                        {passwordVisibility.registerPassword ? null : <line x1="4" y1="20" x2="20" y2="4" />}
                      </svg>
                    </button>
                  </div>
                </label>
                <label className="auth-field">
                  <span>Пароль <em className="auth-required">*</em></span>
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisibility.registerPasswordRepeat ? 'text' : 'password'}
                      placeholder="Повторите пароль еще раз"
                      value={form.registerPasswordRepeat}
                      onChange={handleChange('registerPasswordRepeat')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('registerPasswordRepeat')}
                      aria-label={passwordVisibility.registerPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3.5" />
                        {passwordVisibility.registerPasswordRepeat ? null : <line x1="4" y1="20" x2="20" y2="4" />}
                      </svg>
                    </button>
                  </div>
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
                  disabled={isSendingCode || !canResendRegisterCode}
                >
                  {canResendRegisterCode ? 'Отправить повторно' : `Отправить повторно ${resendSeconds.register}`}
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

            {screen === 'restoreCode' && (
              <form className="auth-content auth-form auth-form--restore-code" onSubmit={handleRestoreCodeVerify}>
                <h1 className="auth-title auth-title--restore">Восстановление профиля</h1>
                <p className="auth-description">
                  На вашу электронную почту отправлен код подтверждения для сброса пароля.
                </p>
                <label className="auth-field">
                  <span>Код</span>
                  <input
                    type="text"
                    placeholder="Введите код подтверждения"
                    value={form.resetCode}
                    onChange={handleChange('resetCode')}
                  />
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button
                  type="button"
                  className="auth-inline-action"
                  onClick={resendResetCode}
                  disabled={isSendingCode || !canResendResetCode}
                >
                  <span>Отправить повторно</span>
                  {resendSeconds.reset > 0 ? (
                    <span className="auth-inline-action__timer">{resendSeconds.reset}</span>
                  ) : null}
                </button>
                <button type="button" className="auth-back-link auth-back-link--site" onClick={() => goToScreen('restoreRequest')}>
                  <span aria-hidden="true">‹</span> Назад
                </button>
              </form>
            )}

            {screen === 'restorePassword' && (
              <form className="auth-content auth-form auth-form--restore-password" onSubmit={handleRestorePassword}>
                <h1 className="auth-title auth-title--restore">Придумайте пароль</h1>
                <label className="auth-field">
                  <span>Новый пароль</span>
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisibility.resetPassword ? 'text' : 'password'}
                      placeholder="Введите пароль"
                      value={form.resetPassword}
                      onChange={handleChange('resetPassword')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('resetPassword')}
                      aria-label={passwordVisibility.resetPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3.5" />
                        {passwordVisibility.resetPassword ? null : <line x1="4" y1="20" x2="20" y2="4" />}
                      </svg>
                    </button>
                  </div>
                </label>
                <label className="auth-field">
                  <span>Новый пароль</span>
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisibility.resetPasswordRepeat ? 'text' : 'password'}
                      placeholder="Повторите пароль еще раз"
                      value={form.resetPasswordRepeat}
                      onChange={handleChange('resetPasswordRepeat')}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => togglePasswordVisibility('resetPasswordRepeat')}
                      aria-label={passwordVisibility.resetPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3.5" />
                        {passwordVisibility.resetPasswordRepeat ? null : <line x1="4" y1="20" x2="20" y2="4" />}
                      </svg>
                    </button>
                  </div>
                </label>
                <button type="submit" className="auth-btn auth-btn--primary auth-btn--form-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохранение...' : 'Подтвердить'}
                </button>
                <button type="button" className="auth-back-link" onClick={() => goToScreen('restoreCode')}>
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
