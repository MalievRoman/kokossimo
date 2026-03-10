import React, { createContext, useContext, useState, useMemo } from 'react';

const CatalogFiltersContext = createContext(null);

export const useCatalogFilters = () => useContext(CatalogFiltersContext);

export const CatalogFiltersProvider = ({ children }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const value = useMemo(
    () => ({
      selectedCategories,
      setSelectedCategories,
      priceMin,
      setPriceMin,
      priceMax,
      setPriceMax,
    }),
    [selectedCategories, priceMin, priceMax]
  );

  return (
    <CatalogFiltersContext.Provider value={value}>
      {children}
    </CatalogFiltersContext.Provider>
  );
};
