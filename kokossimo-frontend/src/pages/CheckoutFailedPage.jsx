import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createYooKassaPayment } from '../services/api';
import './CheckoutFailedPage.css';

const CheckoutFailedPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  const ordersHref = orderId ? `/profile?tab=orders&order=${orderId}` : '/profile?tab=orders';
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');

  const handleRetryPayment = async () => {
    setRetryError('');
    if (!orderId) {
      setRetryError('Не удалось определить заказ для повторной оплаты.');
      return;
    }

    const authToken = localStorage.getItem('authToken') || '';
    if (!authToken) {
      setRetryError('Войдите в профиль, чтобы повторить оплату заказа.');
      return;
    }

    setIsRetrying(true);
    try {
      const response = await createYooKassaPayment(orderId, authToken);
      const confirmationUrl = response?.data?.confirmation_url;
      if (confirmationUrl) {
        window.location.href = confirmationUrl;
        return;
      }

      if (response?.data?.payment_status === 'succeeded') {
        window.location.href = `/checkout/success?order=${orderId}`;
        return;
      }

      throw new Error('Не удалось получить ссылку на оплату.');
    } catch (error) {
      if (error?.__kokoAuthRedirect) {
        return;
      }
      setRetryError(
        error?.response?.data?.detail ||
          error?.message ||
          'Не удалось перейти к оплате. Попробуйте позже.'
      );
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="checkout-failed page-animation">
      <div className="container">
        <section className="checkout-failed__content" aria-labelledby="checkout-failed-title">
          <h1 className="checkout-failed__title" id="checkout-failed-title">
            ОПЛАТА НЕ ЗАВЕРШЕНА
          </h1>

          <div className="checkout-failed__panel">
            <p className="checkout-failed__message">Мы не получили подтверждение оплаты по вашему заказу.</p>
            <p className="checkout-failed__description">Заказ не оплачен. Вы можете попробовать снова.</p>
            <div className="checkout-failed__actions">
              <button
                type="button"
                className="checkout-failed__button checkout-failed__button--solid"
                onClick={handleRetryPayment}
                disabled={isRetrying}
              >
                {isRetrying ? 'ПЕРЕХОД К ОПЛАТЕ' : 'ПОВТОРИТЬ ПОПЫТКУ'}
              </button>
              <Link to={ordersHref} className="checkout-failed__button checkout-failed__button--outline">
                ПЕРЕЙТИ К ЗАКАЗАМ
              </Link>
            </div>
            {retryError ? <p className="checkout-failed__error">{retryError}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CheckoutFailedPage;
