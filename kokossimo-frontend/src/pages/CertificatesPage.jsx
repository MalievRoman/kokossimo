import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import './CertificatesPage.css';

const CertificatesPage = () => {
  const { addToCart } = useCart();
  const { addToFavorites } = useFavorites();
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleCustomAmountChange = (e) => {
    setCustomAmount(e.target.value);
    setSelectedAmount(null); // Сбрасываем выбор готового номинала
  };

  const handleSelectAmount = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount(''); // Сбрасываем поле своего номинала
  };

  const getFinalAmount = () => {
    const raw = selectedAmount || customAmount;
    if (!raw) return null;
    const normalized = String(raw).replace(/\s/g, '').replace(',', '.');
    const value = Number.parseFloat(normalized);
    if (Number.isNaN(value) || value <= 0) return null;
    return Math.round(value);
  };

  const createCertificateProduct = (amount) => ({
    id: `gift-${amount}`,
    name: `Подарочный сертификат на ${amount.toLocaleString('ru-RU')} ₽`,
    description: 'Подарочный сертификат',
    price: amount,
    image: null,
    is_new: false,
    discount: 0,
    is_gift_certificate: true,
  });

  const handleAddToCart = () => {
    const amount = getFinalAmount();
    if (!amount) {
      setStatus('Пожалуйста, выберите номинал или введите свой.');
      return;
    }
    addToCart(createCertificateProduct(amount), 1);
    setStatus(`Сертификат на сумму ${amount.toLocaleString('ru-RU')} ₽ добавлен в корзину.`);
  };

  const handleAddToFavorites = () => {
    const amount = getFinalAmount();
    if (!amount) {
      setStatus('Пожалуйста, выберите номинал или введите свой.');
      return;
    }
    addToFavorites(createCertificateProduct(amount));
    setStatus(`Сертификат на сумму ${amount.toLocaleString('ru-RU')} ₽ добавлен в избранное.`);
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
                  <input
                    type="number"
                    min="1"
                    placeholder="Введите сумму, ₽"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                  />
                  <div className="custom-amount-actions">
                    <button className="buy-btn" onClick={handleAddToCart}>
                      В корзину
                    </button>
                    <button className="buy-btn buy-btn--ghost" onClick={handleAddToFavorites}>
                      В избранное
                    </button>
                  </div>
                  {status && <div className="custom-amount-status">{status}</div>}
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
