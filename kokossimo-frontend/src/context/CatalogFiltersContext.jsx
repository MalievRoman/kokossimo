import React, { createContext, useContext, useState } from 'react';

const CatalogFiltersContext = createContext(null);

export const useCatalogFilters = () => useContext(CatalogFiltersContext);

export const CatalogFiltersProvider = ({ children }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const value = {
    selectedCategories,
    setSelectedCategories,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
  };

  return (
    <CatalogFiltersContext.Provider value={value}>
      {children}
    </CatalogFiltersContext.Provider>
  );
};
