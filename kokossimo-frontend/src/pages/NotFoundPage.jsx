import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="not-found page-animation">
      <div className="not-found__content">
        <TriangleAlert size={72} className="not-found__icon" />
        <h1 className="not-found__title">СТРАНИЦА НЕ НАЙДЕНА</h1>
        <p className="not-found__text">
          Ошибка 404. Похоже, такой страницы не существует.
        </p>
        <Link to="/" className="not-found__button">
          <ArrowLeft size={18} /> НА ГЛАВНУЮ
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
