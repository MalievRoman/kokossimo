import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Send, Phone, Mail } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer__container">
        {/* Колонка 1: Каталог */}
        <div className="footer__col">
          <h3 className="footer__title">КАТАЛОГ</h3>
          <ul className="footer__list">
            <li><Link to="/catalog/face">Уход для лица</Link></li>
            <li><Link to="/catalog/body">Уход для тела</Link></li>
            <li><Link to="/catalog/hair">Уход за волосами</Link></li>
            <li><Link to="/catalog/makeup">Макияж</Link></li>
            <li><Link to="/catalog/perfume">Парфюмерия</Link></li>
            <li><Link to="/catalog/vitamins">Витамины</Link></li>
            <li><Link to="/catalog/brands">Бренды</Link></li>
            <li><Link to="/catalog/sets">Наборы косметики</Link></li>
            <li><Link to="/certificates">Сертификаты</Link></li>
            <li><Link to="/new">Новинки</Link></li>
            <li><Link to="/sale" className="sale-link">SALE %</Link></li>
          </ul>
        </div>

        {/* Колонка 2: Покупателям */}
        <div className="footer__col">
          <h3 className="footer__title">ПОКУПАТЕЛЯМ</h3>
          <ul className="footer__list">
            <li><Link to="/delivery">Доставка и оплата</Link></li>
            <li><Link to="/returns">Возврат</Link></li>
            <li><Link to="/reviews">Отзывы</Link></li>
            <li><Link to="/stores">Офлайн магазины</Link></li>
          </ul>
        </div>

        {/* Колонка 3: Контакты */}
        <div className="footer__col">
          <h3 className="footer__title">КОНТАКТЫ</h3>
          <ul className="footer__list contacts-list">
            <li>+7 (999) 123-45-67</li>
            <li>Email: info@kokossimo.ru</li>
          </ul>
          <div className="footer__socials">
            <a href="#" className="social-icon"><Instagram size={20} /></a>
            <a href="#" className="social-icon"><Send size={20} /></a>
            <a href="#" className="social-icon"><Phone size={20} /></a> {/* WhatsApp иконка */}
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
