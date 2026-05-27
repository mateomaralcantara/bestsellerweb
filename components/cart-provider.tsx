"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CartItem } from "@/lib/types";
interface CartContextValue { items: CartItem[]; addItem: (item: CartItem) => void; removeItem: (id: string, format: string) => void; clearCart: () => void; itemCount: number; total: number; }
const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "bestseller-cart";
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { const saved = localStorage.getItem(CART_STORAGE_KEY); if (saved) setItems(JSON.parse(saved)); }, []);
  useEffect(() => { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); }, [items]);
  const value = useMemo(() => ({
    items,
    addItem: (item: CartItem) => setItems((current) => { const existing = current.find((e) => e.id === item.id && e.format === item.format); if (existing) return current.map((e) => e.id === item.id && e.format === item.format ? { ...e, quantity: e.quantity + item.quantity } : e); return [...current, item]; }),
    removeItem: (id: string, format: string) => setItems((current) => current.filter((e) => !(e.id === id && e.format === format))),
    clearCart: () => setItems([]),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error("useCart must be used within CartProvider"); return context; }
