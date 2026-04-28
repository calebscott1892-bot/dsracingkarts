"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Cart, CartItem } from "@/types/database";

interface CartContextValue {
  cart: Cart;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (variationId: string) => void;
  updateQuantity: (variationId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calcItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("dsr-cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem("dsr-cart", JSON.stringify(newItems));
    } catch {
      // sessionStorage not available
    }
  }, []);

  const addItem = useCallback(
    (newItem: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.variation_id === newItem.variation_id
        );
        let updated: CartItem[];
        if (existing) {
          updated = prev.map((i) =>
            i.variation_id === newItem.variation_id
              ? {
                  ...i,
                  quantity: i.quantity + (newItem.quantity || 1),
                }
              : i
          );
        } else {
          updated = [...prev, { ...newItem, quantity: newItem.quantity || 1 }];
        }
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const removeItem = useCallback(
    (variationId: string) => {
      setItems((prev) => {
        const updated = prev.filter((i) => i.variation_id !== variationId);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const updateQuantity = useCallback(
    (variationId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variationId);
        return;
      }
      setItems((prev) => {
        const updated = prev.map((i) =>
          i.variation_id === variationId ? { ...i, quantity } : i
        );
        persist(updated);
        return updated;
      });
    },
    [persist, removeItem]
  );

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const cart: Cart = {
    items,
    subtotal: calcSubtotal(items),
    item_count: calcItemCount(items),
  };

  return (
    <CartContext.Provider
      value={{ cart, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
