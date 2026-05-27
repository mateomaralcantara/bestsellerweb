"use client";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Book, BookFormat } from "@/lib/types";
import { useCart } from "@/components/cart-provider";
export function AddToCartButton({ book, format }: { book: Book; format: BookFormat }) {
  const { addItem } = useCart(); const [added, setAdded] = useState(false);
  return <button type="button" onClick={() => { addItem({ id: book.id, slug: book.slug, title: book.title, authorName: book.author?.name || "Autor", price: book.price, format, quantity: 1, cover_url: book.cover_url }); setAdded(true); setTimeout(() => setAdded(false), 1800); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-600 px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700"><ShoppingCart className="h-4 w-4" />{added ? "Agregado" : `Agregar ${format}`}</button>;
}
