import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getProduct, getUserFavorites, mergeUserFavorites, replaceUserFavorites } from '../services/api';

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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const modeRef = useRef('guest');
  const skipNextServerSyncRef = useRef(false);
  const serverSyncTimerRef = useRef(null);

  const GUEST_FAVORITES_KEY = 'favorites:guest';
  const MERGED_GUEST_HASH_KEY_PREFIX = 'favorites_guest_merged_hash_user_';

  const parseFavorites = (rawValue) => {
    if (!rawValue) return [];
    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizeFavorite = (product) => {
    const rawId = product?.id;
    const numericId = Number(rawId);
    const id =
      Number.isFinite(numericId) &&
      String(rawId ?? '').trim() !== '' &&
      String(rawId).trim() === String(numericId)
        ? numericId
        : rawId;
    const normalizedPrice = Number(product?.price);
    const price = Number.isFinite(normalizedPrice) ? normalizedPrice : 0;
    const normalizedDiscount = Number(product?.discount);
    const discount =
      Number.isFinite(normalizedDiscount) && normalizedDiscount > 0 && normalizedDiscount < 100
        ? normalizedDiscount
        : 0;
    const normalizedStock = Number(product?.stock);
    const stock = Number.isFinite(normalizedStock) ? Math.max(0, Math.floor(normalizedStock)) : null;
    const isInStock =
      typeof product?.is_in_stock === 'boolean'
        ? product.is_in_stock
        : (stock == null ? true : stock > 0);

    return {
      id,
      name: product?.name || '',
      price,
      image: product?.image || null,
      description: product?.description || '',
      is_new: Boolean(product?.is_new || product?.isNew),
      discount,
      stock,
      is_in_stock: isInStock,
      is_gift_certificate: Boolean(product?.is_gift_certificate),
    };
  };

  const readGuestFavorites = () => parseFavorites(localStorage.getItem(GUEST_FAVORITES_KEY));
  const writeGuestFavorites = (items) => {
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(items));
  };

  const extractFavoriteProductIds = (items) => {
    const unique = new Set();
    (items || []).forEach((item) => {
      const numericId = Number(item?.id);
      if (Number.isFinite(numericId) && numericId > 0) {
        unique.add(Math.floor(numericId));
      }
    });
    return Array.from(unique);
  };

  const buildGuestFavoritesMergeHash = (items) => {
    const ids = extractFavoriteProductIds(items).sort((a, b) => a - b);
    return JSON.stringify(ids);
  };

  // Следим за сменой токена авторизации.
  useEffect(() => {
    const syncAuth = () => setAuthToken(localStorage.getItem('authToken') || '');
    window.addEventListener('auth-token-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('auth-token-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  // Переключение источника избранного: guest(localStorage) / user(API).
  useEffect(() => {
    let cancelled = false;
    modeRef.current = 'hydrating';

    const hydrateFavorites = async () => {
      if (!authToken) {
        if (cancelled) return;
        modeRef.current = 'guest';
        setFavorites(readGuestFavorites());
        return;
      }

      try {
        const guestItems = readGuestFavorites();
        const serverResponse = await getUserFavorites(authToken);
        let nextItems = Array.isArray(serverResponse?.data?.items)
          ? serverResponse.data.items.map(normalizeFavorite)
          : [];
        const userId = serverResponse?.data?.user_id;

        if (guestItems.length > 0 && userId) {
          const hash = buildGuestFavoritesMergeHash(guestItems);
          const mergeHashKey = `${MERGED_GUEST_HASH_KEY_PREFIX}${userId}`;
          const prevHash = localStorage.getItem(mergeHashKey) || '';
          if (hash !== prevHash) {
            const mergeResponse = await mergeUserFavorites(authToken, extractFavoriteProductIds(guestItems));
            nextItems = Array.isArray(mergeResponse?.data?.items)
              ? mergeResponse.data.items.map(normalizeFavorite)
              : [];
            localStorage.setItem(mergeHashKey, hash);
          }
        }

        if (cancelled) return;
        modeRef.current = 'auth';
        skipNextServerSyncRef.current = true;
        setFavorites(nextItems);
      } catch {
        if (cancelled) return;
        modeRef.current = 'guest';
        setFavorites(readGuestFavorites());
      }
    };

    hydrateFavorites();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Сохраняем гостевое избранное.
  useEffect(() => {
    if (modeRef.current !== 'guest') return;
    writeGuestFavorites(favorites);
  }, [favorites]);

  // Подтягиваем актуальные остатки и цену для избранного, чтобы UI не жил на устаревших данных.
  useEffect(() => {
    let cancelled = false;

    const productIds = favorites
      .filter((item) => !item?.is_gift_certificate)
      .map((item) => Number(item?.id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (productIds.length === 0) return;

    const refreshFavoriteProducts = async () => {
      const responses = await Promise.allSettled(productIds.map((id) => getProduct(id)));
      if (cancelled) return;

      const refreshedById = new Map();
      responses.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value?.data) return;
        refreshedById.set(productIds[index], normalizeFavorite(result.value.data));
      });

      if (refreshedById.size === 0) return;

      let hasChanges = false;
      const nextFavorites = favorites.map((item) => {
        const itemId = Number(item?.id);
        if (!Number.isFinite(itemId)) return item;

        const refreshed = refreshedById.get(itemId);
        if (!refreshed) return item;

        const nextItem = {
          ...item,
          ...refreshed,
          is_gift_certificate: Boolean(item?.is_gift_certificate),
        };

        if (
          nextItem.name !== item.name ||
          nextItem.price !== item.price ||
          nextItem.image !== item.image ||
          nextItem.description !== item.description ||
          nextItem.is_new !== item.is_new ||
          nextItem.discount !== item.discount ||
          nextItem.stock !== item.stock ||
          nextItem.is_in_stock !== item.is_in_stock
        ) {
          hasChanges = true;
        }

        return nextItem;
      });

      if (!hasChanges || cancelled) return;

      skipNextServerSyncRef.current = true;
      setFavorites(nextFavorites);
    };

    refreshFavoriteProducts().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [favorites]);

  // Сохраняем серверное избранное для авторизованного пользователя.
  useEffect(() => {
    if (modeRef.current !== 'auth' || !authToken) return;

    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }

    if (serverSyncTimerRef.current) {
      clearTimeout(serverSyncTimerRef.current);
    }

    serverSyncTimerRef.current = setTimeout(() => {
      replaceUserFavorites(authToken, extractFavoriteProductIds(favorites)).catch(() => {});
    }, 150);

    return () => {
      if (serverSyncTimerRef.current) {
        clearTimeout(serverSyncTimerRef.current);
      }
    };
  }, [authToken, favorites]);

  // Добавить товар в избранное
  const addToFavorites = (product) => {
    const normalized = normalizeFavorite(product);
    setFavorites((prevFavorites) => {
      // Проверяем, не добавлен ли уже товар
      if (prevFavorites.find((item) => String(item.id) === String(normalized.id))) {
        return prevFavorites;
      }
      return [...prevFavorites, normalized];
    });
  };

  // Удалить товар из избранного
  const removeFromFavorites = (productId) => {
    setFavorites((prevFavorites) => prevFavorites.filter((item) => String(item.id) !== String(productId)));
  };

  // Проверить, есть ли товар в избранном
  const isFavorite = (productId) => {
    return favorites.some((item) => String(item.id) === String(productId));
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
