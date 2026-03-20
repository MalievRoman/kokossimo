import React from 'react';
import './AboutPage.css';

const AboutPage = () => {
  return (
    <div className="about-page page-animation">
      <div className="container">
        <h1 className="page-title">О КОМПАНИИ</h1>

        <section className="about-section about-mission">
          <h2 className="section-title section-title--center">НАША МИССИЯ</h2>
          <p className="about-quote">
            «Мы дарим эмоции и красоту, открывая для каждого новый уровень
            вдохновения и уверенности».
          </p>
        </section>

        <section className="about-section">
          <p className="about-lead">
            С 2023 года КОКО — это:
          </p>
          <ul className="about-list">
            <li>
              ведущая компания парфюмерно-косметического рынка в Республике
              Калмыкии;
            </li>
            <li>
              большой выбор качественных товаров, уникальные бренды,
              представленные исключительно у нас, и персональный подход к
              каждому покупателю;
            </li>
            <li>
              команда опытных специалистов, которой доверяют тысячи покупателей.
            </li>
          </ul>
        </section>

        <section className="about-section about-delivery">
          <h2 className="section-title">СПОСОБЫ ДОСТАВКИ</h2>
          <p className="about-delivery-intro">
            Выберите удобный вариант доставки, а точные условия всегда
            показываются при оформлении заказа.
          </p>

          <div className="about-delivery-grid">
            <article className="delivery-card">
              <h3 className="delivery-card__title">СДЭК</h3>
              <p className="delivery-card__text">
                Доставка осуществляется через СДЭК до пункта выдачи, опция
                доступна в зависимости от города доставки.
              </p>
              <ul className="delivery-card__list">
                <li>Срок доставки: до 10 рабочих дней в зависимости от региона.</li>
                <li>
                  Стоимость доставки рассчитывается индивидуально и зависит от
                  региона и параметров заказа.
                </li>
                <li>
                  Точная стоимость и срок доставки будут рассчитаны и показаны при
                  оформлении заказа.
                </li>
                <li>
                  После отправки заказа вам будет предоставлен трек-номер для
                  отслеживания.
                </li>
              </ul>
            </article>

            <article className="delivery-card">
              <h3 className="delivery-card__title">Курьерская доставка</h3>
              <p className="delivery-card__text">
                Курьерская доставка осуществляется по городу Элиста.
              </p>
              <ul className="delivery-card__list">
                <li>Срок доставки: до 2 рабочих дней.</li>
                <li>Стоимость доставки: 250 рублей.</li>
                <li>
                  После подтверждения оплаты вам будут предоставляться статусы
                  доставки.
                </li>
              </ul>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
