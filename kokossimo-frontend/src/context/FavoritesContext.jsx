import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../services/api';

const FavoritesContext = createContext();

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const [storageKey, setStorageKey] = useState('favorites:guest');

  const parseFavorites = (rawValue) => {
    if (!rawValue) return [];
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Ошибка загрузки избранного из localStorage:', e);
      return [];
    }
  };

  const buildUserFavoritesKey = (profile) => {
    const email = (profile?.email || '').trim().toLowerCase();
    if (email) {
      return `favorites:user:${email}`;
    }
    const phone = (profile?.phone || '').replace(/\D/g, '');
    if (phone) {
      return `favorites:user:phone:${phone}`;
    }
    return 'favorites:guest';
  };

  // Следим за сменой токена авторизации и подгружаем избранное конкретного пользователя.
  useEffect(() => {
    let cancelled = false;

    const syncFavoritesWithAuth = async () => {
      const token = localStorage.getItem('authToken');

      if (!token) {
        const guestKey = 'favorites:guest';
        if (!cancelled) {
          setStorageKey(guestKey);
          setFavorites(parseFavorites(localStorage.getItem(guestKey)));
        }
        return;
      }

      try {
        const response = await getCurrentUser(token);
        const nextKey = buildUserFavoritesKey(response.data);
        if (!cancelled) {
          setStorageKey(nextKey);
          setFavorites(parseFavorites(localStorage.getItem(nextKey)));
        }
      } catch {
        // Если токен невалиден, откатываемся к гостевому избранному.
        const guestKey = 'favorites:guest';
        if (!cancelled) {
          setStorageKey(guestKey);
          setFavorites(parseFavorites(localStorage.getItem(guestKey)));
        }
      }
    };

    syncFavoritesWithAuth();

    const handleAuthTokenChanged = () => {
      syncFavoritesWithAuth();
    };

    window.addEventListener('auth-token-changed', handleAuthTokenChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('auth-token-changed', handleAuthTokenChanged);
    };
  }, []);

  // Сохраняем избранное в localStorage при изменении для активного пользователя.
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(favorites));
  }, [favorites, storageKey]);

  // Добавить товар в избранное
  const addToFavorites = (product) => {
    setFavorites(prevFavorites => {
      // Проверяем, не добавлен ли уже товар
      if (prevFavorites.find(item => item.id === product.id)) {
        return prevFavorites;
      }
      return [...prevFavorites, {
        id: product.id,
        name: product.name,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
        image: product.image,
        description: product.description,
        is_new: product.is_new || product.isNew,
        discount: product.discount || 0,
        is_gift_certificate: Boolean(product.is_gift_certificate)
      }];
    });
  };

  // Удалить товар из избранного
  const removeFromFavorites = (productId) => {
    setFavorites(prevFavorites => prevFavorites.filter(item => item.id !== productId));
  };

  // Проверить, есть ли товар в избранном
  const isFavorite = (productId) => {
    return favorites.some(item => item.id === productId);
  };

  // Переключить состояние избранного (добавить/удалить)
  const toggleFavorite = (product) => {
    if (isFavorite(product.id)) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  // Очистить избранное
  const clearFavorites = () => {
    setFavorites([]);
  };

  // Получить количество товаров в избранном
  const getFavoritesCount = () => {
    return favorites.length;
  };

  const value = {
    favorites,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    getFavoritesCount
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
