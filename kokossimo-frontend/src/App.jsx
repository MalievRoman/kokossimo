import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Компоненты layout
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Страницы
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import CertificatesPage from './pages/CertificatesPage';
import UnderConstructionPage from './pages/UnderConstructionPage';
import ProductPage from './pages/ProductPage';

function App() {
  return (
    <div className="app">
      <Header />
      
      <main>
        <Routes>
          {/* 1. Сначала самые важные и конкретные страницы */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          
          {/* 2. Потом страницы "В разработке" */}
          <Route path="/about" element={<UnderConstructionPage />} />
          <Route path="/delivery" element={<UnderConstructionPage />} />
          <Route path="/favorites" element={<UnderConstructionPage />} />
          <Route path="/cart" element={<UnderConstructionPage />} />
          <Route path="/profile" element={<UnderConstructionPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          
          {/* 3. И ТОЛЬКО В САМОМ КОНЦЕ - заглушка для всего остального */}
          <Route path="*" element={<UnderConstructionPage />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
