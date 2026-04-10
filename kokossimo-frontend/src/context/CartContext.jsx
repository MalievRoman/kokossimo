import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getProduct, getUserCart, mergeUserCart, replaceUserCart } from '../services/api';

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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '');
  const cartModeRef = useRef('guest');
  const skipNextServerSyncRef = useRef(false);
  const serverSyncTimerRef = useRef(null);

  const GUEST_CART_KEY = 'cart_guest';
  const LEGACY_CART_KEY = 'cart';
  const MERGED_GUEST_HASH_KEY_PREFIX = 'cart_guest_merged_hash_user_';

  const parseStoredCart = (raw) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizeServerItem = (item) => {
    const numericId = Number(item?.id);
    const id =
      Number.isFinite(numericId) &&
      String(item?.id ?? '').trim() !== '' &&
      String(item?.id).trim() === String(numericId)
        ? numericId
        : item?.id;
    const quantity = Math.max(1, Number(item?.quantity) || 1);
    const stockRaw = Number(item?.stock);
    const stock = Number.isFinite(stockRaw) ? Math.max(0, Math.floor(stockRaw)) : null;
    const normalizedPrice = Number(item?.price);
    const price = Number.isFinite(normalizedPrice) ? normalizedPrice : 0;
    const normalizedDiscount = Number(item?.discount);
    const discount =
      Number.isFinite(normalizedDiscount) && normalizedDiscount > 0 && normalizedDiscount < 100
        ? normalizedDiscount
        : 0;

    const isAvailable = stock == null ? true : stock > 0;
    const safeQuantity = !isAvailable ? quantity : stock == null ? quantity : Math.min(quantity, stock);

    return {
      id,
      name: item?.name || '',
      price,
      discount,
      image: item?.image || null,
      quantity: safeQuantity,
      stock,
      is_available: isAvailable,
      is_gift_certificate: Boolean(item?.is_gift_certificate),
    };
  };

  const buildGuestCartMergeHash = (items) => {
    if (!Array.isArray(items) || items.length === 0) return '';
    const stable = items
      .map((item) => ({
        id: String(item?.id ?? ''),
        quantity: Number(item?.quantity) || 0,
        price: Number(item?.price) || 0,
        name: String(item?.name ?? ''),
        is_gift_certificate: Boolean(item?.is_gift_certificate),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(stable);
  };

  const readGuestCart = () => {
    const guestRaw = localStorage.getItem(GUEST_CART_KEY);
    if (guestRaw) return parseStoredCart(guestRaw);

    const legacy = parseStoredCart(localStorage.getItem(LEGACY_CART_KEY));
    if (legacy.length > 0) {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(legacy));
    }
    return legacy;
  };

  const writeGuestCart = (items) => {
    const serialized = JSON.stringify(items);
    localStorage.setItem(GUEST_CART_KEY, serialized);
    localStorage.setItem(LEGACY_CART_KEY, serialized);
  };

  const getMaxAvailableQuantity = (product) => {
    const numericStock = Number(product?.stock);
    if (!Number.isFinite(numericStock)) return null;
    return Math.max(0, Math.floor(numericStock));
  };

  // Отслеживаем изменения auth-токена в этой и других вкладках.
  useEffect(() => {
    const syncAuth = () => setAuthToken(localStorage.getItem('authToken') || '');
    window.addEventListener('auth-token-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('auth-token-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  // Переключение источника корзины: guest(localStorage) / user(API).
  useEffect(() => {
    let cancelled = false;
    cartModeRef.current = 'hydrating';

    const hydrateCart = async () => {
      if (!authToken) {
        if (cancelled) return;
        cartModeRef.current = 'guest';
        setCartItems(readGuestCart());
        return;
      }

      try {
        const guestItems = readGuestCart();
        const serverResponse = await getUserCart(authToken);
        let nextItems = Array.isArray(serverResponse?.data?.items)
          ? serverResponse.data.items.map(normalizeServerItem)
          : [];
        const userId = serverResponse?.data?.user_id;

        if (guestItems.length > 0 && userId) {
          const guestHash = buildGuestCartMergeHash(guestItems);
          const mergeHashKey = `${MERGED_GUEST_HASH_KEY_PREFIX}${userId}`;
          const previousHash = localStorage.getItem(mergeHashKey) || '';
          if (guestHash !== previousHash) {
            const mergeResponse = await mergeUserCart(authToken, guestItems);
            nextItems = Array.isArray(mergeResponse?.data?.items)
              ? mergeResponse.data.items.map(normalizeServerItem)
              : [];
            localStorage.setItem(mergeHashKey, guestHash);
          }
        }

        if (cancelled) return;
        cartModeRef.current = 'auth';
        skipNextServerSyncRef.current = true;
        setCartItems(nextItems);
      } catch {
        if (cancelled) return;
        cartModeRef.current = 'guest';
        setCartItems(readGuestCart());
      }
    };

    hydrateCart();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Persist guest cart in localStorage.
  useEffect(() => {
    if (cartModeRef.current !== 'guest') return;
    writeGuestCart(cartItems);
  }, [cartItems]);

  // Persist authorized cart on backend.
  useEffect(() => {
    if (cartModeRef.current !== 'auth' || !authToken) return;

    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }

    if (serverSyncTimerRef.current) {
      clearTimeout(serverSyncTimerRef.current);
    }

    serverSyncTimerRef.current = setTimeout(() => {
      replaceUserCart(authToken, cartItems).catch(() => {});
    }, 150);

    return () => {
      if (serverSyncTimerRef.current) {
        clearTimeout(serverSyncTimerRef.current);
      }
    };
  }, [authToken, cartItems]);

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

    const maxAvailable = getMaxAvailableQuantity(product);
    if (maxAvailable === 0) return;

    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        const nextQuantity = existingItem.quantity + quantity;
        const clampedQuantity = maxAvailable == null ? nextQuantity : Math.min(nextQuantity, maxAvailable);
        // Если товар уже есть, увеличиваем количество
        return prevItems.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: clampedQuantity,
                // Актуализируем скидку, если товар добавили повторно из карточки
                discount: safeDiscount,
                stock: maxAvailable
              }
            : item
        );
      } else {
        const initialQuantity = maxAvailable == null ? quantity : Math.min(quantity, maxAvailable);
        if (initialQuantity <= 0) return prevItems;
        // Если товара нет, добавляем новый
        return [...prevItems, {
          id: product.id,
          name: product.name,
          price: safePrice,
          discount: safeDiscount,
          image: product.image,
          quantity: initialQuantity,
          stock: maxAvailable,
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
          ? (() => {
              const stock = Number(item.stock);
              const isUnavailable = item.stock != null && Number.isFinite(stock) && stock <= 0;

              if (isUnavailable) {
                return item;
              }

              return {
                ...item,
                quantity: item.stock == null ? quantity : Math.min(quantity, item.stock)
              };
            })()
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
    return cartItems.reduce((total, item) => {
      const stock = Number(item.stock);
      const isFiniteStock = Number.isFinite(stock);
      const effectiveQty = isFiniteStock ? Math.min(item.quantity, stock) : item.quantity;
      return total + Math.max(0, effectiveQty);
    }, 0);
  };

  // Получить общую стоимость корзины
  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const stock = Number(item.stock);
      const isFiniteStock = Number.isFinite(stock);
      const effectiveQty = isFiniteStock ? Math.min(item.quantity, stock) : item.quantity;
      return total + item.price * Math.max(0, effectiveQty);
    }, 0);
  };

  const refreshCart = useCallback(async () => {
    if (!authToken) {
      const guestItems = readGuestCart();
      const productItems = guestItems.filter((item) => {
        if (item?.is_gift_certificate) return false;
        const rawId = item?.id;
        return typeof rawId === 'number' || (typeof rawId === 'string' && rawId.trim() && !Number.isNaN(Number(rawId)));
      });
      if (productItems.length === 0) {
        setCartItems(guestItems);
        return;
      }

      const refreshed = await Promise.all(
        productItems.map(async (item) => {
          const id = typeof item.id === 'number' ? item.id : Number(item.id);
          if (!Number.isFinite(id)) return item;
          try {
            const response = await getProduct(id);
            const product = response?.data;
            const stock = Number(product?.stock);
            const isFiniteStock = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
            return {
              ...item,
              name: product?.name || item.name,
              price: Number(product?.price) || item.price,
              discount: Number(product?.discount) || item.discount,
              image: product?.image || item.image,
              stock: isFiniteStock,
              is_available: isFiniteStock == null ? true : isFiniteStock > 0,
            };
          } catch {
            return item;
          }
        })
      );

      setCartItems((prev) => {
        const refreshedMap = new Map(refreshed.map((i) => [String(i.id), i]));
        return prev.map((item) => {
          const next = refreshedMap.get(String(item.id));
          return next ? { ...item, ...next } : item;
        });
      });
      return;
    }

    try {
      const serverResponse = await getUserCart(authToken);
      const nextItems = Array.isArray(serverResponse?.data?.items)
        ? serverResponse.data.items.map(normalizeServerItem)
        : [];
      skipNextServerSyncRef.current = true;
      setCartItems(nextItems);
    } catch {
      // ignore refresh failures
    }
  }, [authToken]);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    refreshCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
