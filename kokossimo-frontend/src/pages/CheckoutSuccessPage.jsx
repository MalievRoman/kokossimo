import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getOrderDetail } from '../services/api';
import './CheckoutSuccessPage.css';

const CheckoutSuccessPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  const [orderState, setOrderState] = useState({
    loading: false,
    status: '',
    paymentStatus: '',
    error: '',
  });

  useEffect(() => {
    if (!orderId) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    getOrderDetail(token, orderId)
      .then((response) => {
        const data = response.data || {};
        setOrderState({
          loading: false,
          status: data.status || '',
          paymentStatus: data.payment_status || '',
          error: '',
        });
      })
      .catch(() => {
        setOrderState({
          loading: false,
          status: '',
          paymentStatus: '',
          error: 'Не удалось получить актуальный статус заказа.',
        });
      });
  }, [orderId]);

  const statusText = (() => {
    if (orderState.loading) return 'Проверяем статус оплаты...';
    if (orderState.error) return orderState.error;
    if (orderState.paymentStatus === 'succeeded' || orderState.status === 'paid') {
      return 'Оплата подтверждена. Заказ успешно оформлен.';
    }
    if (orderState.paymentStatus === 'canceled' || orderState.status === 'cancelled') {
      return 'Оплата отменена. Вы можете вернуться в корзину и попробовать снова.';
    }
    if (orderState.paymentStatus === 'pending') {
      return 'Заказ создан. Ожидаем подтверждение оплаты от ЮKassa.';
    }
    return 'Спасибо! Ваш заказ принят и уже обрабатывается.';
  })();

  return (
    <div className="checkout-success page-animation">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">ГЛАВНАЯ</Link> <span>— ЗАКАЗ ОФОРМЛЕН</span>
        </div>

        <h1 className="page-title">ЗАКАЗ ОФОРМЛЕН</h1>

        <div className="checkout-success__card">
          <p>{statusText}</p>
          {orderId && <p>Номер заказа: <strong>#{orderId}</strong></p>}
          <div className="checkout-success__actions">
            <Link to="/catalog" className="btn-primary">
              Продолжить покупки
            </Link>
            <Link to="/profile" className="btn-link">
              Перейти в профиль
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
