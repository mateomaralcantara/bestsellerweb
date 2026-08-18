"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CheckoutPaymentMethods } from "@/components/payments/checkout-payment-methods";
import { currency } from "@/lib/utils";

const trustItems = [
  { icon: ShieldCheck, label: "Pago protegido" },
  { icon: LockKeyhole, label: "Datos privados" },
  { icon: CheckCircle2, label: "Acceso confirmado" },
];

export default function CheckoutPage() {
  const { items, removeItem, total } = useCart();

  return (
    <main className="min-h-screen">
      <section className="commercial-dark commercial-grid relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Checkout protegido
              </p>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                Revisa y completa tu compra
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                Confirma el libro seleccionado y continúa con PayPal. El acceso
                se activa después de que el pago queda aprobado.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wide text-slate-300 sm:text-xs">
              {["Carrito", "Pago", "Lectura"].map((step, index) => (
                <div key={step} className="flex min-w-20 flex-col items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    index === 0
                      ? "bg-[#ffbf3f] text-[#07111f]"
                      : "border border-white/20 bg-white/10 text-white"
                  }`}>
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <section className="space-y-5">
            {items.length ? (
              items.map((item) => (
                <article
                  key={`${item.id}-${item.format}`}
                  className="commercial-card overflow-hidden rounded-[30px] p-5 sm:p-6"
                >
                  <div className="flex gap-4">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="book-cover-shadow h-36 w-24 shrink-0 rounded-r-lg rounded-l-sm object-cover"
                      />
                    ) : (
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <ShoppingBag className="h-7 w-7" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-black tracking-tight text-[#07111f] sm:text-2xl">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.authorName} · {item.format}
                      </p>
                      <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Precio de catálogo
                      </p>
                      <p className="mt-1 text-xl font-black text-[#07111f]">
                        {currency(item.price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.format)}
                      aria-label={`Quitar ${item.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="commercial-card rounded-[30px] border-dashed p-10 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#155eef]">
                  <ShoppingBag className="h-7 w-7" />
                </span>
                <p className="mt-5 text-xl font-black text-[#07111f]">
                  Tu carrito está vacío.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Explora el catálogo y agrega el libro que quieres comenzar a
                  leer.
                </p>
                <Link
                  href="/catalog"
                  className="premium-button mt-5 bg-[#155eef] text-sm text-white"
                >
                  Ver catálogo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            <div className="commercial-card rounded-[30px] p-6">
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
                <p className="text-3xl font-black tracking-tight text-[#07111f]">
                  {currency(total)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {trustItems.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs font-bold text-slate-600"
                  >
                    <Icon className="h-4 w-4 text-emerald-600" />
                    {label}
                  </div>
              ))}
            </div>
          </section>

          <CheckoutPaymentMethods />
        </div>
      </div>
    </main>
  );
}
