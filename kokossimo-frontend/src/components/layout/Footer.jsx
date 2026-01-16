import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Send, Phone, MessageCircle } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer__container">
        {/* Колонка 1: Каталог */}
        <div className="footer__col">
          <h3 className="footer__title">КАТАЛОГ</h3>
          <ul className="footer__list">
            <li><Link to="/catalog?filter=уход-за-лицом">Уход за лицом</Link></li>
            <li><Link to="/catalog?filter=уход-за-телом">Уход за телом</Link></li>
            <li><Link to="/catalog?filter=уход-за-волосами">Уход за волосами</Link></li>
            <li><Link to="/catalog?filter=макияж">Макияж</Link></li>
            <li><Link to="/catalog?filter=парфюмерия">Парфюмерия</Link></li>
            <li><Link to="/catalog?filter=наборы-миниатюр">Наборы миниатюр</Link></li>
            <li><Link to="/certificates">Сертификаты</Link></li>
          </ul>
        </div>

        {/* Колонка 2: Покупателям */}
        <div className="footer__col">
          <h3 className="footer__title">ПОКУПАТЕЛЯМ</h3>
          <ul className="footer__list">
            <li><Link to="/delivery">Доставка и оплата</Link></li>
            <li><Link to="/certificates">Подарочные сертификаты</Link></li>
            <li><Link to="/contacts">Контакты</Link></li>
            <li><Link to="/about">О компании</Link></li>
          </ul>
        </div>

        {/* Колонка 3: Контакты */}
        <div className="footer__col">
          <h3 className="footer__title">КОНТАКТЫ</h3>
          <ul className="footer__list contacts-list">
            <li>
              <a href="tel:+79375068999">+7 (937) 506-89-99</a>
            </li>
          </ul>
          <div className="footer__socials">
            <a href="https://instagram.com" className="social-icon" target="_blank" rel="noreferrer">
              <Instagram size={20} />
            </a>
            <a href="https://t.me/" className="social-icon" target="_blank" rel="noreferrer">
              <Send size={20} />
            </a>
            <a href="https://wa.me/79375068999" className="social-icon" target="_blank" rel="noreferrer">
              <MessageCircle size={20} />
            </a>
            <a href="tel:+79375068999" className="social-icon">
              <Phone size={20} />
            </a>
          </div>
        </div>

        {/* Колонка 4: Информация */}
        <div className="footer__col">
          <h3 className="footer__title">ИНФОРМАЦИЯ</h3>
          <ul className="footer__list">
            <li><Link to="/privacy">Политика конфиденциальности</Link></li>
            <li><Link to="/offer">Договор оферты</Link></li>
            <li><Link to="/subscription">Согласие на получение рассылки</Link></li>
          </ul>
          <p className="footer__meta-text">
            *Компания Meta признана экстремистской и запрещена в РФ
          </p>
        </div>
      </div>

      <div className="footer__bottom">
        <h2 className="footer__logo">KOKÓSSIMO</h2>
        <p className="footer__year">2025</p>
      </div>
    </footer>
  );
};

export default Footer;
