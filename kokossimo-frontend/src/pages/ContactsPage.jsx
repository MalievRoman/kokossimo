import React from 'react';
import { Phone, Mail, Send, MapPin } from 'lucide-react';
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
              <Mail size={18} />
              <a href="mailto:info@kokossimo.ru">info@kokossimo.ru</a>
            </li>
            <li>
              <Send size={18} />
              <a href="https://t.me/kokossimo_info_bot" target="_blank" rel="noreferrer">
                @kokossimo_info_bot
              </a>
            </li>
            <li>
              <MapPin size={18} />
              <span>улица А. Сусеева, 13, Элиста, Республика Калмыкия, 358000</span>
            </li>
          </ul>
          <p className="contacts-hours">
            Мы на связи каждый день с 9:00 до 20:00
          </p>
        </section>
      </div>
    </div>
  );
};

export default ContactsPage;
