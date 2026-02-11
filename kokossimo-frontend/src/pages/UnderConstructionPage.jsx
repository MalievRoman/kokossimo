import React from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

const UnderConstructionPage = () => {
  return (
    <div className="page-animation d-flex align-items-center justify-content-center text-center bg-white px-3 py-5" style={{ minHeight: '70vh' }}>
      <div className="d-flex flex-column align-items-center" style={{ maxWidth: '500px' }}>
        <Construction size={80} color="#8B4513" className="mb-4" />

        <h1 className="mb-3 text-uppercase" style={{ fontSize: '2rem', color: '#333' }}>
          СТРАНИЦА В РАЗРАБОТКЕ
        </h1>

        <p className="mb-5" style={{ color: '#666', lineHeight: 1.6, fontSize: '1.1rem' }}>
          Мы активно работаем над этим разделом. <br />
          Совсем скоро здесь появится что-то интересное!
        </p>

        <Link
          to="/"
          className="d-inline-flex align-items-center gap-2 text-uppercase fw-semibold text-decoration-none rounded-1 px-4 py-3"
          style={{ backgroundColor: '#4a2c2a', color: '#fff' }}
        >
          <ArrowLeft size={18} /> НА ГЛАВНУЮ
        </Link>
      </div>
    </div>
  );
};

export default UnderConstructionPage;
