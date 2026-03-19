import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="footer">
    <div className="footer__inner container">
      <div className="footer__cols">
        <div className="footer__col">
          <h3 className="footer__title">КАТАЛОГ</h3>
          <ul className="footer__list">
            <li><Link className="footer__link" to="/catalog?filter=uhod-za-licom">Уход за лицом</Link></li>
            <li><Link className="footer__link" to="/catalog?filter=uhod-za-telom">Уход за телом</Link></li>
            <li><Link className="footer__link" to="/catalog?filter=uhod-za-volosami">Уход за волосами</Link></li>
            <li><Link className="footer__link" to="/catalog?filter=makeup">Макияж</Link></li>
            <li><Link className="footer__link" to="/catalog?filter=parfume">Парфюмерия</Link></li>
            <li><Link className="footer__link" to="/catalog?filter=nabor-miniatur">Наборы миниатюр</Link></li>
            <li><Link className="footer__link" to="/certificates">Сертификаты</Link></li>
          </ul>
        </div>

        <div className="footer__col">
          <h3 className="footer__title">ПОКУПАТЕЛЯМ</h3>
          <ul className="footer__list">
            <li><Link className="footer__link" to="/documents">Документы</Link></li>
            <li><Link className="footer__link" to="/certificates">Подарочные сертификаты</Link></li>
            <li><Link className="footer__link" to="/contacts">Контакты</Link></li>
            <li><Link className="footer__link" to="/about">О компании</Link></li>
          </ul>
        </div>

        <div className="footer__col">
          <h3 className="footer__title">КОНТАКТЫ</h3>
          <ul className="footer__list">
            <li><a className="footer__link" href="tel:+79375068999">+7 (937) 506-89-99</a></li>
            <li><a className="footer__link" href="mailto:info@kokossimo.ru">info@kokossimo.ru</a></li>
          </ul>

          <div className="footer__social">
            <a className="footer__social-btn" href="https://t.me/" aria-label="Telegram" target="_blank" rel="noreferrer">
              <img src={`${import.meta.env.BASE_URL}assets/telegram.svg`} alt="" />
            </a>
            <a className="footer__social-btn" href="https://vk.com" aria-label="VK" target="_blank" rel="noreferrer">
              <img src={`${import.meta.env.BASE_URL}assets/vk.svg`} alt="" />
            </a>
          </div>
        </div>

        <div className="footer__col">
          <h3 className="footer__title">ИНФОРМАЦИЯ</h3>
          <ul className="footer__list">
            <li><Link className="footer__link" to="/documents/privacy">Политика конфиденциальности</Link></li>
            <li><Link className="footer__link" to="/documents/offer">Договор оферты</Link></li>
            <li><Link className="footer__link" to="/documents/subscription">Согласие на получение рассылки<br /> рекламно-информационных материалов</Link></li>
          </ul>

          <p className="footer__note">
            ИП Сангаджиева Амуланга Очировна
            <br />
            ИНН: 081410434036
            <br />
            ОГРНИП: 325080000024099
          </p>
        </div>
      </div>

      <div className="footer__brand">
        <img className="footer__logo" src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="KOKOSSIMO" />
        <div className="footer__year">2026</div>
      </div>
    </div>
  </footer>
);

export default Footer;
