import React from 'react';

const AboutPage = () => {
  return (
    <div className="page-animation py-5 bg-white">
      <div className="container">
        <h1 className="page-title">О КОМПАНИИ</h1>

        <section className="mt-5 p-4 border rounded-3" style={{ background: '#fcf8f7', borderColor: '#e7dcd8' }}>
          <h2 className="section-title text-center">НАША МИССИЯ</h2>
          <p className="mb-0 text-center" style={{ fontSize: '1.1rem', color: '#7c2b2a', lineHeight: 1.6 }}>
            «Мы дарим эмоции и красоту, открывая для каждого новый уровень
            вдохновения и уверенности».
          </p>
        </section>

        <section className="mt-4">
          <p className="mb-3" style={{ fontSize: '1.1rem', color: '#4b3a39' }}>
            С 2023 года КОКО — это:
          </p>
          <ul className="mb-0 ps-3 d-grid gap-2" style={{ color: '#6b5a58', lineHeight: 1.6 }}>
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
