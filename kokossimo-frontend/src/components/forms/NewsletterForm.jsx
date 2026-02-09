import React, { useState } from 'react';

// Блок подписки на рассылку под верстку из main_page.html (subscribe)
// Визуал полностью тянется из koko-main.css по классам .subscribe*.

const NewsletterForm = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Здесь можно будет прикрутить реальный запрос к бэкенду.
    // Пока оставим простой alert, чтобы было понятно, что форма живая.
    if (email.trim()) {
      alert(`Спасибо за подписку! Мы будем присылать новости на ${email}`);
      setEmail('');
    }
  };

  return (
    <section className="subscribe block" aria-label="Подписка на рассылку">
      <div className="subscribeplaque">
        <div className="container">
          <div className="subscribecontent">
            <div className="subscribeframe">
              <div className="subscribetitle">
                ПОДПИШИТЕСЬ НА РАССЫЛКУ, ЧТОБЫ БЫТЬ В КУРСЕ НАШИХ НОВОСТЕЙ
              </div>

              <form className="subscribeform" onSubmit={handleSubmit}>
                <input
                  className="subscribeinput"
                  type="email"
                  name="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="subscribebtn" type="submit">
                  ПОДПИСАТЬСЯ
                </button>
              </form>

              <div className="subscribenote">
                Нажимая на кнопку “ПОДПИСАТЬСЯ”, вы даёте согласие на получение
                рассылки рекламно‑информационных материалов
              </div>
            </div>

            <div className="subscribepad" aria-hidden="true"></div>

            <img
              className="subscribedecor"
              src={`${import.meta.env.BASE_URL}assets/beauty_elements.png`}
              alt=""
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsletterForm;
