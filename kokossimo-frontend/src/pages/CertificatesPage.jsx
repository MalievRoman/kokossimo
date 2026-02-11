import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import './CertificatesPage.css';

const CERTIFICATE_AMOUNTS = [1000, 3000, 5000];
const CUSTOM_AMOUNT_MIN = 1000;
const CUSTOM_AMOUNT_MAX = 20000;
const CUSTOM_AMOUNT_STEP = 500;

const CertificatesPage = () => {
  const { addToCart } = useCart();
  const [activeAmount, setActiveAmount] = useState(CERTIFICATE_AMOUNTS[2]);
  const [customAmount, setCustomAmount] = useState(2000);
  const [recipientName, setRecipientName] = useState('');
  const [status, setStatus] = useState('');

  const isCustom = activeAmount === 'custom';
  const finalAmount = isCustom ? customAmount : activeAmount;

  const clampCustomAmount = (value) =>
    Math.min(CUSTOM_AMOUNT_MAX, Math.max(CUSTOM_AMOUNT_MIN, value));

  const handleSelectAmount = (amount) => {
    setActiveAmount(amount);
    setStatus('');
  };

  const handleSelectCustom = () => {
    setActiveAmount('custom');
    setStatus('');
  };

  const handleCustomAmountChange = (event) => {
    const rawValue = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(rawValue)) {
      setCustomAmount(CUSTOM_AMOUNT_MIN);
      return;
    }
    setCustomAmount(clampCustomAmount(rawValue));
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

  const handlePurchase = () => {
    if (!finalAmount || Number.isNaN(finalAmount)) {
      setStatus('Пожалуйста, выберите номинал.');
      return;
    }
    addToCart(createCertificateProduct(finalAmount), 1);
    setStatus(`Сертификат на сумму ${finalAmount.toLocaleString('ru-RU')} ₽ добавлен в корзину.`);
  };

  return (
    <div className="certificates-page page-animation py-4 py-md-5">
      <div className="container">

        <div className="certificates-hero row g-4 align-items-start mb-5">
          <div className="certificate-preview col-12 col-xl-8">
            <div className="certificate-card">
              <div className="certificate-logo">
                <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="Кокоссимо" />
              </div>
              <div className="certificate-middle">
                <div className="certificate-title">ПОДАРОЧНЫЙ СЕРТИФИКАТ</div>
                <div className="certificate-amount">
                  {(finalAmount || 0).toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="certificate-recipient">
                <span className="certificate-recipient__label">ПОЛУЧАТЕЛЬ:</span>
                {recipientName && (
                  <span className="certificate-recipient__name">{recipientName}</span>
                )}
              </div>
            </div>
          </div>

          <div className="certificate-form col-12 col-xl-4 d-flex flex-column">
            <h1 className="certificate-form__title mb-0">ПОДАРОЧНЫЙ СЕРТИФИКАТ</h1>
            <p className="certificate-form__text mt-3 mb-0">
              Иногда самый лучший подарок — это возможность выбрать именно то,
              что хочется. Подарочный сертификат — идеальный способ выразить
              внимание, порадовать близкого человека и подарить ему немного
              красоты и удовольствия.
            </p>

            <div className="certificate-form__section mt-4 mt-md-5">
              <h2 className="certificate-form__subtitle mb-0">ВЫБОР НОМИНАЛА</h2>
              <div className="certificate-form__amounts d-flex flex-wrap gap-2">
                {CERTIFICATE_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`amount-button btn ${activeAmount === amount ? 'is-active' : ''}`}
                    onClick={() => handleSelectAmount(amount)}
                  >
                    {amount.toLocaleString('ru-RU')} ₽
                  </button>
                ))}
              </div>

              <div className="certificate-form__custom d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className={`amount-button btn ${isCustom ? 'is-active' : ''}`}
                  onClick={handleSelectCustom}
                >
                  СВОЯ СУММА
                </button>
                {isCustom && (
                  <input
                    type="number"
                    className="form-control"
                    min={CUSTOM_AMOUNT_MIN}
                    max={CUSTOM_AMOUNT_MAX}
                    step={CUSTOM_AMOUNT_STEP}
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                  />
                )}
              </div>
              {isCustom && (
                <input
                  type="range"
                  className="certificate-form__slider"
                  min={CUSTOM_AMOUNT_MIN}
                  max={CUSTOM_AMOUNT_MAX}
                  step={CUSTOM_AMOUNT_STEP}
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                />
              )}
            </div>

            <div className="certificate-form__section">
              <h2 className="certificate-form__subtitle mb-0">ИМЯ ПОЛУЧАТЕЛЯ</h2>
              <input
                type="text"
                className="certificate-form__input form-control"
                placeholder="Имя"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
            </div>

            <div className="certificate-preview certificate-preview--mobile">
              <div className="certificate-card">
                <div className="certificate-logo">
                  <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="Кокоссимо" />
                </div>
                <div className="certificate-middle">
                  <div className="certificate-title">ПОДАРОЧНЫЙ СЕРТИФИКАТ</div>
                  <div className="certificate-amount">
                    {(finalAmount || 0).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="certificate-recipient">
                  <span className="certificate-recipient__label">ПОЛУЧАТЕЛЬ:</span>
                  {recipientName && (
                    <span className="certificate-recipient__name">{recipientName}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="certificate-form__purchase btn btn-primary mt-4 mt-md-5"
              onClick={handlePurchase}
            >
              ПРИОБРЕСТИ
            </button>
            {status && <div className="certificate-form__status mt-2">{status}</div>}
          </div>
        </div>

        <div className="certificates-info d-grid gap-4 mb-5">
          <div className="certificates-info__section p-4">
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

          <div className="certificates-info__section p-4">
            <h2 className="section-title">КАК КУПИТЬ СЕРТИФИКАТ</h2>
            <ol>
              <li>В магазине — у кассы</li>
              <li>Электронно — онлайн, с получением сертификата в цифровом формате</li>
            </ol>
          </div>

          <div className="certificates-info__section p-4">
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
