"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-provider";

export function RemovePurchasedCartItem({ bookId }: { bookId: string }) {
  const { items, removeItem } = useCart();

  useEffect(() => {
    for (const item of items) {
      if (item.id === bookId) {
        removeItem(item.id, item.format);
      }
    }
  }, [bookId, items, removeItem]);

  return null;
}
