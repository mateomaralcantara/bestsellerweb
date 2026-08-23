"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/types";

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string, format: string) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "bestseller-cart";

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.slug === "string" &&
    typeof item.title === "string" &&
    typeof item.format === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
}

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredCartItem).map((item) => ({
      ...item,
      quantity: 1,
    }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readStoredCart());
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem: (item) => {
        if (!Number.isFinite(item.price) || item.price <= 0) return;

        setItems((current) => {
          const normalized = { ...item, quantity: 1 };
          const exists = current.some(
            (entry) =>
              entry.id === normalized.id &&
              entry.format === normalized.format
          );

          if (exists) {
            return current.map((entry) =>
              entry.id === normalized.id &&
              entry.format === normalized.format
                ? normalized
                : entry
            );
          }

          return [...current, normalized];
        });
      },
      removeItem: (id, format) =>
        setItems((current) =>
          current.filter(
            (entry) => !(entry.id === id && entry.format === format)
          )
        ),
      clearCart: () => setItems([]),
      itemCount: items.length,
      total: items.reduce((sum, item) => sum + item.price, 0),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}
