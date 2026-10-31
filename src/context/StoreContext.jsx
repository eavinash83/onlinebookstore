import { createContext, useContext, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { calculateTotals } from '../../shared/pricing';

const StoreContext = createContext(null);

// Cart and wishlist state, persisted to localStorage.
export function StoreProvider({ children }) {
  const [cart, setCart] = usePersistentState('cart', []);
  const [wishlist, setWishlist] = usePersistentState('wishlist', []);

  const value = useMemo(() => {
    const addToCart = (product, qty = 1) => {
      setCart((items) => {
        const existing = items.find((i) => i.id === product.id);
        if (existing) {
          return items.map((i) => (i.id === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i));
        }
        const { id, name, price, emoji, color, stock, category } = product;
        return [...items, { id, name, price, emoji, color, stock, category, qty: Math.min(qty, stock) }];
      });
    };

    const updateQty = (id, qty) =>
      setCart((items) =>
        qty <= 0 ? items.filter((i) => i.id !== id) : items.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, i.stock) } : i)),
      );

    const removeFromCart = (id) => setCart((items) => items.filter((i) => i.id !== id));
    const clearCart = () => setCart([]);

    const toggleWishlist = (id) => setWishlist((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

    return {
      cart,
      cartCount: cart.reduce((n, i) => n + i.qty, 0),
      totals: calculateTotals(cart),
      addToCart,
      updateQty,
      removeFromCart,
      clearCart,
      wishlist,
      toggleWishlist,
      isWishlisted: (id) => wishlist.includes(id),
      cartQtyFor: (id) => cart.find((i) => i.id === id)?.qty ?? 0,
    };
  }, [cart, wishlist, setCart, setWishlist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
