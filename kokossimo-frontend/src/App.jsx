import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

// Компоненты layout
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Страницы
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import CertificatesPage from './pages/CertificatesPage';
import UnderConstructionPage from './pages/UnderConstructionPage';
import AboutPage from './pages/AboutPage';
import ContactsPage from './pages/ContactsPage';
import NotFoundPage from './pages/NotFoundPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import PaymentPage from './pages/PaymentPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
};

function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      
      <main>
        <Routes>
          {/* 1. Сначала самые важные и конкретные страницы */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          
          {/* 2. Потом страницы "В разработке" */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/delivery" element={<UnderConstructionPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/checkout" element={<PaymentPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          
          {/* 3. И ТОЛЬКО В САМОМ КОНЦЕ - заглушка для всего остального */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
