"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { FuturePaymentMethods } from "@/components/payments/future-payment-methods";

function PayPalMark() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#142c8e] text-xl font-black italic text-white shadow-sm">
      P
    </span>
  );
}

export function CheckoutPaymentMethods() {
  const { items } = useCart();

  return (
    <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
      <section className="overflow-hidden rounded-[30px] border-2 border-[#0070ba] bg-white shadow-xl">
        <div className="bg-gradient-to-r from-[#003087] to-[#0070ba] p-5 text-white">
          <div className="flex items-center gap-3">
            <PayPalMark />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                Método principal
              </p>
              <h2 className="text-2xl font-black">PayPal</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-blue-50">
            Pago seguro. El acceso al libro se activa cuando PayPal confirma
            el cobro.
          </p>
        </div>

        <div className="space-y-3 p-5">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Agrega un libro para continuar con PayPal.
              <Link
                href="/catalog"
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#ffd140] px-4 py-3 font-black text-[#142c8e]"
              >
                Ir al catálogo
              </Link>
            </div>
          ) : (
            <>
              {items.length > 1 ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Durante esta primera etapa, PayPal procesa cada libro en un
                  pago separado.
                </p>
              ) : null}

              {items.map((item) => (
                <Link
                  key={`${item.id}-${item.format}`}
                  href={`/checkout/paypal?bookId=${encodeURIComponent(
                    item.id
                  )}`}
                  className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#e5b900] bg-[#ffd140] px-4 py-3 text-center font-black text-[#142c8e] transition hover:-translate-y-0.5 hover:bg-[#f7c928]"
                >
                  <PayPalMark />
                  <span className="min-w-0">
                    <span className="block">Pagar con PayPal</span>
                    {items.length > 1 ? (
                      <span className="block truncate text-xs font-semibold">
                        {item.title}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            El importe se vuelve a validar en el servidor antes de crear la
            orden.
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Otros métodos
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Se conservan visibles, pero aún no aceptan cobros.
        </p>
        <div className="mt-4">
          <FuturePaymentMethods />
        </div>
      </section>
    </aside>
  );
}
