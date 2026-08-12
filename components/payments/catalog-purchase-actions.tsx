"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";

type Props = {
  bookId: string;
  slug: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  price: number | null;
  format: string;
  paypalReady: boolean;
};

export function CatalogPurchaseActions({
  bookId,
  slug,
  title,
  authorName,
  coverUrl,
  price,
  format,
  paypalReady,
}: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const hasLocalPrice =
    typeof price === "number" && Number.isFinite(price) && price > 0;

  function addBookToCart() {
    if (!hasLocalPrice) return false;

    const cartItem = {
      id: bookId,
      slug,
      title,
      authorName,
      price,
      format,
      quantity: 1,
      cover_url: coverUrl,
    } as Parameters<typeof addItem>[0];

    addItem(cartItem);
    setAdded(true);
    return true;
  }

  function buyNow() {
    if (addBookToCart()) {
      router.push("/checkout");
      return;
    }

    if (paypalReady) {
      router.push(
        `/checkout/paypal?bookId=${encodeURIComponent(bookId)}`
      );
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={buyNow}
        disabled={!hasLocalPrice && !paypalReady}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        <ShoppingCart className="h-4 w-4" />
        {hasLocalPrice
          ? "Comprar libro"
          : paypalReady
            ? "Comprar con PayPal"
            : "Precio pendiente"}
      </button>

      <button
        type="button"
        onClick={addBookToCart}
        disabled={!hasLocalPrice}
        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {added ? "Agregado al carrito" : "Agregar al carrito"}
      </button>

      <p
        className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${
          paypalReady
            ? "bg-blue-50 text-blue-800"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {paypalReady
          ? "PayPal disponible en el siguiente paso."
          : "Configura el precio PayPal en USD para habilitar el cobro."}
      </p>
    </div>
  );
}
