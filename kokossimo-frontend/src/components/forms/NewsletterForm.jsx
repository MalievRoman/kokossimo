import React, { useState } from 'react';
import './NewsletterForm.css';

const NewsletterForm = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Спасибо за подписку! Мы отправили письмо на ${email}`);
    setEmail('');
  };

  return (
    <section className="newsletter">
      <div className="container newsletter__container">
        <div className="newsletter__content">
          <h2 className="newsletter__title">
            ПОДПИШИТЕСЬ НА РАССЫЛКУ, ЧТОБЫ БЫТЬ В КУРСЕ НАШИХ НОВОСТЕЙ
          </h2>
          
          <form className="newsletter__form" onSubmit={handleSubmit}>
            <input 
              type="email" 
              placeholder="Email" 
              className="newsletter__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="newsletter__btn">
              ПОДПИСАТЬСЯ
            </button>
          </form>
          
          <p className="newsletter__disclaimer">
            Нажимая на кнопку "ПОДПИСАТЬСЯ", Вы даете согласие на получение рассылки рекламно-информационных материалов
          </p>
        </div>
        
        {/* Декоративные картинки косметики по краям, если нужно */}
        <div className="newsletter__decor newsletter__decor--left"></div>
        <div className="newsletter__decor newsletter__decor--right"></div>
      </div>
    </section>
  );
};

export default NewsletterForm;
