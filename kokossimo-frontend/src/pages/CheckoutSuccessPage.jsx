import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const CheckoutSuccessPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');

  return (
    <div className="page-animation py-4 py-md-5" style={{ minHeight: '60vh' }}>
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <span>Заказ оформлен</span>
        </div>

        <h1 className="page-title">ЗАКАЗ ОФОРМЛЕН</h1>

        <div className="mt-4 bg-white rounded-3 p-4" style={{ color: '#555' }}>
          <p className="mb-2">Спасибо! Ваш заказ принят и уже обрабатывается.</p>
          {orderId && <p className="mb-0">Номер заказа: <strong>#{orderId}</strong></p>}
          <div className="d-flex flex-wrap align-items-center gap-3 mt-4">
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
