import React from 'react';
import { Link } from 'react-router-dom';
import './DocumentsPage.css';

const DocumentsPage = () => {
  return (
    <div className="documents-page page-animation">
      <div className="container">
        <h1 className="page-title">ДОКУМЕНТЫ</h1>

        <p className="documents-intro">
          Здесь размещены основные юридические документы интернет-магазина KOKOSSIMO.
          Пожалуйста, ознакомьтесь с ними перед оформлением заказа.
        </p>

        <div className="documents-grid">
          <section className="documents-card">
            <h2 className="documents-card__title">
              Согласие на использование персональных данных
            </h2>
            <p className="documents-card__text">
              Условия обработки и использования ваших персональных данных при
              оформлении заказов и работе с сайтом.
            </p>
            <Link className="documents-card__link" to="/documents/subscription">
              Перейти к документу
            </Link>
          </section>

          <section className="documents-card">
            <h2 className="documents-card__title">
              Публичная оферта о заключении договора купли-продажи
            </h2>
            <p className="documents-card__text">
              Условия совершения покупок, оплаты и доставки товаров интернет-магазина.
            </p>
            <Link className="documents-card__link" to="/documents/offer">
              Перейти к документу
            </Link>
          </section>

          <section className="documents-card">
            <h2 className="documents-card__title">
              Политика в отношении обработки персональных данных
            </h2>
            <p className="documents-card__text">
              Подробные правила хранения, защиты и обработки персональных данных пользователей.
            </p>
            <Link className="documents-card__link" to="/documents/privacy">
              Перейти к документу
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPage;

