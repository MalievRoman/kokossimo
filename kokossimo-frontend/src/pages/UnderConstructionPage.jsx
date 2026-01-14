import React from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';

const UnderConstructionPage = () => {
  return (
    <div className="page-animation" style={styles.container}>
      <div style={styles.content}>
        <Construction size={80} color="#8B4513" style={{marginBottom: '2rem'}} />
        
        <h1 style={styles.title}>СТРАНИЦА В РАЗРАБОТКЕ</h1>
        
        <p style={styles.text}>
          Мы активно работаем над этим разделом. <br />
          Совсем скоро здесь появится что-то интересное!
        </p>

        <Link to="/" style={styles.button}>
          <ArrowLeft size={18} /> НА ГЛАВНУЮ
        </Link>
      </div>
    </div>
  );
};

// Простые inline-стили для этой страницы
const styles = {
  container: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: '2rem',
    textAlign: 'center',
  },
  content: {
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: '2rem',
    color: '#333',
    marginBottom: '1rem',
    textTransform: 'uppercase',
  },
  text: {
    color: '#666',
    marginBottom: '2.5rem',
    lineHeight: '1.6',
    fontSize: '1.1rem',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 25px',
    backgroundColor: '#4a2c2a',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '600',
    textTransform: 'uppercase',
    transition: 'background 0.3s',
  }
};

export default UnderConstructionPage;
