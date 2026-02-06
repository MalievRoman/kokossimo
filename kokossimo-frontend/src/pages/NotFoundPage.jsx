import React from 'react';
import { Link } from 'react-router-dom';
import notFoundImage from '../assets/404/404_image.png';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="not-found page-animation">
      <div className="not-found__inner">
        <img className="not-found__image" src={notFoundImage} alt="404" />
        <p className="not-found__message">
          ОЙ! ЧТО-ТО ПОШЛО НЕ ТАК.
          <br />
          ВОЗМОЖНО СТРАНИЦА, КОТОРУЮ ВЫ ИЩИТЕ, НЕ СУЩЕСТВУЕТ, ДАВАЙТЕ
          ВЕРНЕМСЯ ОБРАТНО.
        </p>
        <Link to="/" className="not-found__button product-card__btn">
          НА ГЛАВНУЮ
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
