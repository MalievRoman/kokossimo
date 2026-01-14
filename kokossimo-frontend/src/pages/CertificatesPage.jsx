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
        
        {/* Блок с описанием */}
        <div className="certificates-intro">
          <h1 className="page-title">ПОДАРОЧНЫЙ СЕРТИФИКАТ</h1>
          <div className="intro-content">
            <div className="intro-text">
              <p>
                Иногда самый лучший подарок — это возможность выбрать именно то, что хочется. 
                Подарочный сертификат — идеальный способ выразить внимание, порадовать близкого человека 
                и подарить ему немного красоты и удовольствия.
              </p>
              
              {/* Форма своего номинала */}
              <div className="custom-amount-wrapper">
                <input 
                  type="number" 
                  placeholder="Введите свой номинал" 
                  className="custom-amount-input"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                />
                <button className="buy-btn" onClick={handleBuy}>
                  КУПИТЬ СЕРТИФИКАТ
                </button>
              </div>
            </div>
            
            {/* Декоративная буква К на фоне (можно сделать CSS или SVG) */}
            <div className="intro-bg-letter">K</div>
          </div>
        </div>

        {/* Карточки сертификатов */}
        <div className="certificates-grid">
          {/* 1000 ₽ */}
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

          {/* 3000 ₽ */}
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

          {/* 5000 ₽ */}
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
        </div>

      </div>
    </div>
  );
};

export default CertificatesPage;
