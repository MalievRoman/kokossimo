import React from 'react';
import { Phone, MessageCircle, Send, Instagram } from 'lucide-react';
import './ContactsPage.css';

const ContactsPage = () => {
  return (
    <div className="contacts-page page-animation">
      <div className="container">
        <h1 className="page-title">КОНТАКТЫ</h1>

        <section className="contacts-section">
          <p className="contacts-text">
            Для связи с нами вы можете воспользоваться следующими способами:
          </p>
          <ul className="contacts-list">
            <li>
              <Phone size={18} />
              <a href="tel:+79375068999">+7 (937) 506-89-99</a>
            </li>
            <li>
              <MessageCircle size={18} />
              <a href="https://wa.me/79375068999" target="_blank" rel="noreferrer">
                Написать в WhatsApp
              </a>
            </li>
            <li>
              <Send size={18} />
              <a href="https://t.me/" target="_blank" rel="noreferrer">
                Написать в Telegram
              </a>
            </li>
            <li>
              <Instagram size={18} />
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Написать в Instagram
              </a>
            </li>
          </ul>
          <p className="contacts-hours">
            Мы на связи каждый день с 9:00 до 20:00
          </p>
        </section>

        <section className="contacts-section contacts-support">
          <h2 className="section-title">ОБРАТНАЯ СВЯЗЬ И ПОДДЕРЖКА</h2>
          <p className="contacts-text">
            Столкнулись с трудностями при оформлении заказа или есть предложения,
            как повысить качество работы и улучшить наши сервисы? Будем рады
            обратной связи! Пожалуйста, напишите в онлайн-чат Telegram, WhatsApp
            или позвоните нам по телефону +7 (937) 506-89-99.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ContactsPage;
