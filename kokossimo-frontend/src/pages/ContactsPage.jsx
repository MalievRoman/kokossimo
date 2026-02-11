import React from 'react';
import { Phone, MessageCircle, Send, Instagram } from 'lucide-react';

const ContactsPage = () => {
  return (
    <div className="page-animation py-5 bg-white">
      <div className="container">
        <h1 className="page-title">КОНТАКТЫ</h1>

        <section className="mt-5">
          <p className="mb-4" style={{ color: '#6b5a58', lineHeight: 1.6 }}>
            Для связи с нами вы можете воспользоваться следующими способами:
          </p>
          <ul className="list-unstyled d-grid gap-3 mb-4">
            <li className="d-flex align-items-center gap-2" style={{ color: '#4b3a39' }}>
              <Phone size={18} />
              <a href="tel:+79375068999" className="text-decoration-none" style={{ color: 'inherit' }}>
                +7 (937) 506-89-99
              </a>
            </li>
            <li className="d-flex align-items-center gap-2" style={{ color: '#4b3a39' }}>
              <MessageCircle size={18} />
              <a className="text-decoration-none" style={{ color: 'inherit' }} href="https://wa.me/79375068999" target="_blank" rel="noreferrer">
                Написать в WhatsApp
              </a>
            </li>
            <li className="d-flex align-items-center gap-2" style={{ color: '#4b3a39' }}>
              <Send size={18} />
              <a className="text-decoration-none" style={{ color: 'inherit' }} href="https://t.me/" target="_blank" rel="noreferrer">
                Написать в Telegram
              </a>
            </li>
            <li className="d-flex align-items-center gap-2" style={{ color: '#4b3a39' }}>
              <Instagram size={18} />
              <a className="text-decoration-none" style={{ color: 'inherit' }} href="https://instagram.com" target="_blank" rel="noreferrer">
                Написать в Instagram
              </a>
            </li>
          </ul>
          <p className="mb-0 fw-semibold" style={{ color: '#7c2b2a' }}>
            Мы на связи каждый день с 9:00 до 20:00
          </p>
        </section>

        <section className="mt-5 p-4 border rounded-3" style={{ background: '#fcf8f7', borderColor: '#e7dcd8' }}>
          <h2 className="section-title">ОБРАТНАЯ СВЯЗЬ И ПОДДЕРЖКА</h2>
          <p className="mb-0" style={{ color: '#6b5a58', lineHeight: 1.6 }}>
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
