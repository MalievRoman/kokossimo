import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './CheckoutSuccessPage.css';

const CheckoutSuccessPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');

  return (
    <div className="checkout-success page-animation">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Заказ оформлен</span>
        </div>

        <h1 className="page-title">ЗАКАЗ ОФОРМЛЕН</h1>

        <div className="checkout-success__card">
          <p>Спасибо! Ваш заказ принят и уже обрабатывается.</p>
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
