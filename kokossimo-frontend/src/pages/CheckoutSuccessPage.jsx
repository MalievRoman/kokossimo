import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './CheckoutSuccessPage.css';

const CheckoutSuccessPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  const orderHref = orderId ? `/profile?tab=orders&order=${orderId}` : '/profile?tab=orders';

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
