import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Загружаем избранное из localStorage при монтировании
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Ошибка загрузки избранного из localStorage:', e);
      }
    }
  }, []);

  // Сохраняем избранное в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

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
        discount: product.discount || 0
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
