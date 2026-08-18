"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { trackBookInterest } from "@/lib/book-interest-client";

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
    trackBookInterest(bookId, "add_to_cart");
    return true;
  }

  function buyNow() {
    if (addBookToCart()) {
      trackBookInterest(bookId, "checkout_start");
      router.push("/checkout");
      return;
    }

    if (paypalReady) {
      trackBookInterest(bookId, "checkout_start");
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-5 py-3.5 font-black text-white shadow-[0_14px_30px_rgba(21,94,239,0.26)] transition hover:-translate-y-0.5 hover:bg-[#2b78ff] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
      >
        <ShoppingCart className="h-4 w-4" />
        {hasLocalPrice
          ? "Comprar libro"
          : paypalReady
            ? "Comprar con PayPal"
            : "Precio pendiente"}
        <ArrowRight className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={addBookToCart}
        disabled={!hasLocalPrice}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-[#155eef] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {added ? <Check className="h-4 w-4" /> : null}
        {added ? "Agregado al carrito" : "Agregar al carrito"}
      </button>

      <p
        className={`rounded-xl px-3 py-2.5 text-center text-xs font-bold ${
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
