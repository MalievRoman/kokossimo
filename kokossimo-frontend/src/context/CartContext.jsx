import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Загружаем корзину из localStorage при монтировании
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Ошибка загрузки корзины из localStorage:', e);
      }
    }
  }, []);

  // Сохраняем корзину в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Добавить товар в корзину
  const addToCart = (product, quantity = 1) => {
    const normalizedPrice =
      typeof product.price === 'string' ? parseFloat(product.price) : Number(product.price);
    const safePrice = Number.isFinite(normalizedPrice) ? normalizedPrice : 0;
    const normalizedDiscount = Number(product.discount);
    const safeDiscount =
      Number.isFinite(normalizedDiscount) && normalizedDiscount > 0 && normalizedDiscount < 100
        ? normalizedDiscount
        : 0;

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        // Если товар уже есть, увеличиваем количество
        return prevItems.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                // Актуализируем скидку, если товар добавили повторно из карточки
                discount: safeDiscount
              }
            : item
        );
      } else {
        // Если товара нет, добавляем новый
        return [...prevItems, {
          id: product.id,
          name: product.name,
          price: safePrice,
          discount: safeDiscount,
          image: product.image,
          quantity: quantity,
          is_gift_certificate: Boolean(product.is_gift_certificate)
        }];
      }
    });
  };

  // Удалить товар из корзины
  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  // Изменить количество товара
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  // Очистить корзину
  const clearCart = () => {
    setCartItems([]);
  };

  // Получить общее количество товаров в корзине
  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  // Получить общую стоимость корзины
  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
