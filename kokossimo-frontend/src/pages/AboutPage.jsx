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
      </div>
    </div>
  );
};

export default AboutPage;
