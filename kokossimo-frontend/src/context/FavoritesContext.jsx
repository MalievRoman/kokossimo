/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const FavoritesContext = createContext();

const getInitialFavorites = () => {
  try {
    const savedFavorites = localStorage.getItem('favorites');
    if (!savedFavorites) return [];
    const parsed = JSON.parse(savedFavorites);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Ошибка загрузки избранного из localStorage:', e);
    return [];
  }
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState(getInitialFavorites);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addToFavorites = (product) => {
    setFavorites((prevFavorites) => {
      if (prevFavorites.find((item) => item.id === product.id)) {
        return prevFavorites;
      }

      return [
        ...prevFavorites,
        {
          id: product.id,
          name: product.name,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          image: product.image,
          description: product.description,
          is_new: product.is_new || product.isNew,
          discount: product.discount || 0,
          is_gift_certificate: Boolean(product.is_gift_certificate),
        },
      ];
    });
  };

  const removeFromFavorites = (productId) => {
    setFavorites((prevFavorites) => prevFavorites.filter((item) => item.id !== productId));
  };

  const isFavorite = (productId) => favorites.some((item) => item.id === productId);

  const toggleFavorite = (product) => {
    if (isFavorite(product.id)) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  const getFavoritesCount = () => favorites.length;

  const value = {
    favorites,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    getFavoritesCount,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
