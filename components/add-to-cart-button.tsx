"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Book, BookFormat } from "@/lib/types";

export function AddToCartButton({
  book,
  format,
}: {
  book: Book;
  format: BookFormat;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const price = typeof book.price === "number" ? book.price : 0;
  const authorName = book.author?.name || "Autor";
  const canAddToCart = price > 0;

  function handleAddToCart() {
    if (!canAddToCart) return;

    addItem({
      id: book.id,
      slug: book.slug,
      title: book.title,
      authorName,
      price,
      format,
      quantity: 1,
      cover_url: book.cover_url,
    });

    setAdded(true);

    window.setTimeout(() => {
      setAdded(false);
    }, 1800);
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={!canAddToCart}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-600 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:scale-100"
    >
      <ShoppingCart className="h-4 w-4" />
      {added ? "Agregado" : canAddToCart ? `Agregar ${format}` : "Precio no disponible"}
    </button>
  );
}