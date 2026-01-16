import React, { useState } from 'react';
import './CertificatesPage.css';

const CertificatesPage = () => {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  const handleCustomAmountChange = (e) => {
    setCustomAmount(e.target.value);
    setSelectedAmount(null); // Сбрасываем выбор готового номинала
  };

  const handleSelectAmount = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount(''); // Сбрасываем поле своего номинала
  };

  const handleBuy = () => {
    const finalAmount = selectedAmount || customAmount;
    if (!finalAmount) {
      alert('Пожалуйста, выберите номинал или введите свой');
      return;
    }
    alert(`Сертификат на сумму ${finalAmount} ₽ добавлен в корзину!`);
    // Здесь будет логика добавления в корзину
  };

  return (
    <div className="certificates-page page-animation">
      <div className="container">
        
        <div className="certificates-hero">
          {/* Блок с описанием */}
          <div className="certificates-hero__panel certificates-intro">
            <h1 className="page-title">ПОДАРОЧНЫЙ СЕРТИФИКАТ</h1>
            <div className="intro-content">
              <div className="intro-text">
                <p>
                  Лучший подарок — это уверенность, что он понравится. Подарочный
                  сертификат — идеальный способ подарить близким и друзьям
                  возможность выбрать что-то особенное для себя и получить именно
                  те эмоции, которые запомнятся надолго. Стопроцентное попадание
                  без долгих поисков и сомнений!
                </p>
                
                <div className="custom-amount-wrapper">
                  <button className="buy-btn" onClick={handleBuy}>
                    СЕРТИФИКАТ СО СВОИМ НОМИНАЛОМ
                  </button>
                </div>
              </div>
              
              {/* Декоративная буква К на фоне */}
              <div className="intro-bg-letter">K</div>
            </div>
          </div>

          {/* Карточки сертификатов */}
          <div className="certificates-hero__cards">
            <div className="certificates-grid">
              {/* 1000 ₽ */}
              <div className="certificate-item">
                <div 
                  className={`certificate-card ${selectedAmount === 1000 ? 'selected' : ''}`}
                  onClick={() => handleSelectAmount(1000)}
                >
                  <div className="cert-top">
                    <span>КОКОССИМО!</span>
                    <span className="star">✦</span>
                  </div>
                  <div className="cert-center">
                    <div className="cert-chevron"></div>
                  </div>
                  <div className="cert-bottom">
                    <span className="cert-label">ПОДАРОЧНЫЙ СЕРТИФИКАТ</span>
                    <span className="cert-price">1 000 ₽</span>
                  </div>
                </div>
                <p className="certificate-caption">Подарочный сертификат номиналом 1000 рублей</p>
              </div>

              {/* 3000 ₽ */}
              <div className="certificate-item">
                <div 
                  className={`certificate-card ${selectedAmount === 3000 ? 'selected' : ''}`}
                  onClick={() => handleSelectAmount(3000)}
                >
                  <div className="cert-top">
                    <span>КОКОССИМО!</span>
                    <span className="star">✦</span>
                  </div>
                  <div className="cert-center">
                    <div className="cert-chevron"></div>
                  </div>
                  <div className="cert-bottom">
                    <span className="cert-label">ПОДАРОЧНЫЙ СЕРТИФИКАТ</span>
                    <span className="cert-price">3 000 ₽</span>
                  </div>
                </div>
                <p className="certificate-caption">Подарочный сертификат номиналом 3000 рублей</p>
              </div>

              {/* 5000 ₽ */}
              <div className="certificate-item">
                <div 
                  className={`certificate-card ${selectedAmount === 5000 ? 'selected' : ''}`}
                  onClick={() => handleSelectAmount(5000)}
                >
                  <div className="cert-top">
                    <span>КОКОССИМО!</span>
                    <span className="star">✦</span>
                  </div>
                  <div className="cert-center">
                    <div className="cert-chevron"></div>
                  </div>
                  <div className="cert-bottom">
                    <span className="cert-label">ПОДАРОЧНЫЙ СЕРТИФИКАТ</span>
                    <span className="cert-price">5 000 ₽</span>
                  </div>
                </div>
                <p className="certificate-caption">Подарочный сертификат номиналом 5000 рублей</p>
              </div>
            </div>
          </div>
        </div>

        <div className="certificates-info">
          <div className="certificates-info__section">
            <h2 className="section-title">ЧТО ТАКОЕ ПОДАРОЧНЫЕ СЕРТИФИКАТЫ</h2>
            <p>
              Подарочный сертификат — это сертификат с фиксированным номиналом,
              который можно использовать при покупке товаров в нашем магазине.
              Он даёт право оплатить покупку полностью или частично в пределах
              указанной суммы.
            </p>
            <p className="certificates-note">
              Обратите внимание: у каждого сертификата есть срок действия, до
              которого им необходимо воспользоваться.
            </p>
          </div>

          <div className="certificates-info__section">
            <h2 className="section-title">КАК КУПИТЬ СЕРТИФИКАТ</h2>
            <ol>
              <li>В магазине — у кассы</li>
              <li>Электронно — онлайн, с получением сертификата в цифровом формате</li>
            </ol>
          </div>

          <div className="certificates-info__section">
            <h2 className="section-title">КАК ИСПОЛЬЗОВАТЬ СЕРТИФИКАТ</h2>
            <ul>
              <li>Выберите товары в магазине</li>
              <li>Предъявите сертификат на кассе при оплате</li>
              <li>Сумма сертификата будет учтена при расчёте покупки</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CertificatesPage;
