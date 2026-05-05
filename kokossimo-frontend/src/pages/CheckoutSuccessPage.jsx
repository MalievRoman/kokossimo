import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { refreshOrderPayment } from '../services/api';
import './CheckoutSuccessPage.css';

const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  const orderHref = orderId ? `/profile?tab=orders&order=${orderId}` : '/profile?tab=orders';
  const [isCheckingPayment, setIsCheckingPayment] = useState(true);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [checkError, setCheckError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const verifyPayment = async () => {
      if (!orderId) {
        navigate('/checkout/failed', { replace: true });
        return;
      }

      const authToken = localStorage.getItem('authToken') || '';
      if (!authToken) {
        navigate('/auth', { replace: true });
        return;
      }

      setIsCheckingPayment(true);
      setIsPaymentConfirmed(false);
      setCheckError('');

      try {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await refreshOrderPayment(authToken, orderId);
          if (isCancelled) {
            return;
          }

          const order = response?.data || {};
          const paymentStatus = String(order.payment_status || '').toLowerCase();

          if (paymentStatus === 'succeeded') {
            setIsPaymentConfirmed(true);
            setIsCheckingPayment(false);
            return;
          }

          if (paymentStatus === 'canceled' || paymentStatus === 'cancelled') {
            navigate(`/checkout/failed?order=${orderId}`, { replace: true });
            return;
          }

          if (attempt < 3) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 1500);
            });
          }
        }

        navigate(`/checkout/failed?order=${orderId}`, { replace: true });
      } catch (error) {
        if (error?.__kokoAuthRedirect || isCancelled) {
          return;
        }
        setCheckError(
          error?.response?.data?.detail ||
            error?.message ||
            'Не удалось проверить статус оплаты. Попробуйте открыть заказ позже.'
        );
        setIsCheckingPayment(false);
      }
    };

    verifyPayment();

    return () => {
      isCancelled = true;
    };
  }, [navigate, orderId]);

  if (isCheckingPayment) {
    return (
      <div className="checkout-success page-animation">
        <div className="container">
          <section
            className="checkout-success__content checkout-success__content--loading"
            aria-labelledby="checkout-success-title"
          >
            <h1 className="checkout-success__title checkout-success__title--loading" id="checkout-success-title">
              ПРОВЕРЯЕМ ОПЛАТУ
            </h1>
            <p className="checkout-success__text checkout-success__text--loading">
              Подождите немного, мы уточняем результат оплаты
            </p>
            <div className="checkout-success__loader" aria-hidden="true">
              <span className="checkout-success__loader-dot" />
              <span className="checkout-success__loader-dot" />
              <span className="checkout-success__loader-dot" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (checkError) {
    return (
      <div className="checkout-success page-animation">
        <div className="container">
          <section className="checkout-success__content" aria-labelledby="checkout-success-title">
            <h1 className="checkout-success__title" id="checkout-success-title">
              НЕ УДАЛОСЬ ПРОВЕРИТЬ ОПЛАТУ
            </h1>
            <p className="checkout-success__text">{checkError}</p>
            <div className="checkout-success__actions">
              <Link to={orderHref} className="checkout-success__button checkout-success__button--solid">
                ПЕРЕЙТИ К ЗАКАЗУ
              </Link>
              <Link to="/catalog" className="checkout-success__button checkout-success__button--outline">
                ПРОДОЛЖИТЬ ПОКУПКИ
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!isPaymentConfirmed) {
    return (
      <div className="checkout-success page-animation">
        <div className="container">
          <section className="checkout-success__content" aria-labelledby="checkout-success-title">
            <h1 className="checkout-success__title" id="checkout-success-title">
              НЕ УДАЛОСЬ ПОДТВЕРДИТЬ ОПЛАТУ
            </h1>
            <p className="checkout-success__text">
              Мы не получили подтверждение успешной оплаты. Перейдите к заказу и попробуйте проверить статус позже.
            </p>
            <div className="checkout-success__actions">
              <Link to={orderHref} className="checkout-success__button checkout-success__button--solid">
                ПЕРЕЙТИ К ЗАКАЗУ
              </Link>
              <Link to="/catalog" className="checkout-success__button checkout-success__button--outline">
                ПРОДОЛЖИТЬ ПОКУПКИ
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-success page-animation">
      <div className="container">
        <section className="checkout-success__content" aria-labelledby="checkout-success-title">
          <h1 className="checkout-success__title" id="checkout-success-title">
            ЗАКАЗ ОФОРМЛЕН
          </h1>
          <p className="checkout-success__text">Ваш заказ принят и уже обрабатывается.</p>
          <img className="checkout-success__image" src="/assets/congrats.png" alt="" aria-hidden="true" />
          <div className="checkout-success__actions">
            <Link to={orderHref} className="checkout-success__button checkout-success__button--solid">
              ПЕРЕЙТИ К ЗАКАЗУ
            </Link>
            <Link to="/catalog" className="checkout-success__button checkout-success__button--outline">
              ПРОДОЛЖИТЬ ПОКУПКИ
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
