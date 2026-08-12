"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CheckoutPaymentMethods } from "@/components/payments/checkout-payment-methods";
import { currency } from "@/lib/utils";

export default function CheckoutPage() {
  const { items, removeItem, total } = useCart();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-700">
            Checkout
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            Tu carrito
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Revisa tu libro y continúa con PayPal. AZUL y CardNET permanecen
            visibles como métodos próximos.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <section className="space-y-5">
            {items.length ? (
              items.map((item) => (
                <article
                  key={`${item.id}-${item.format}`}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex gap-4">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="h-32 w-24 shrink-0 rounded-xl object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <ShoppingBag className="h-7 w-7" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-black text-slate-950">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.authorName} · {item.format}
                      </p>
                      <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Precio de catálogo
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {currency(item.price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.format)}
                      aria-label={`Quitar ${item.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-4 font-bold text-slate-800">
                  Tu carrito está vacío.
                </p>
                <Link
                  href="/catalog"
                  className="mt-4 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                >
                  Ver catálogo
                </Link>
              </div>
            )}

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    Total de catálogo
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    PayPal mostrará el precio configurado en USD antes de
                    confirmar cada pago.
                  </p>
                </div>
                <p className="text-2xl font-black text-slate-950">
                  {currency(total)}
                </p>
              </div>
            </div>
          </section>

          <CheckoutPaymentMethods />
        </div>
      </div>
    </main>
  );
}
