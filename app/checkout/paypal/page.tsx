import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBookCheckoutItem } from "@/lib/paypal/book-checkout";
import { getPayPalClientId } from "@/lib/paypal/config";
import { userAlreadyOwnsBook } from "@/lib/paypal/purchases";
import { PayPalCheckoutButton } from "@/components/payments/paypal-checkout-button";
import { FuturePaymentMethods } from "@/components/payments/future-payment-methods";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    bookId?: string;
  };
};

function money(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

export default async function PayPalCheckoutPage({
  searchParams,
}: Props) {
  const bookId = searchParams?.bookId?.trim() || "";
  if (!bookId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth?next=${encodeURIComponent(
        `/checkout/paypal?bookId=${bookId}`
      )}`
    );
  }

  if (await userAlreadyOwnsBook({ userId: user.id, bookId })) {
    redirect(
      `/checkout/paypal/success?bookId=${encodeURIComponent(bookId)}`
    );
  }

  let book: Awaited<ReturnType<typeof getBookCheckoutItem>> | null = null;
  let checkoutError = "";

  try {
    book = await getBookCheckoutItem(bookId);
  } catch (error) {
    console.error(error);
    checkoutError =
      error instanceof Error
        ? error.message
        : "No se pudo preparar el precio PayPal.";
  }

  if (!book) {
    return (
      <main className="commercial-dark commercial-grid min-h-[720px] px-4 py-16">
        <div className="mx-auto max-w-xl rounded-[34px] border border-white/15 bg-white p-8 text-center shadow-[0_35px_90px_rgba(0,0,0,0.3)] sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl font-black text-amber-800">
            !
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-[#07111f]">
            PayPal todavía no está listo para este libro
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            Falta configurar un precio de cobro compatible.
          </p>
          {process.env.NODE_ENV !== "production" ? (
            <p className="mt-4 rounded-xl bg-slate-100 p-3 text-left text-sm text-slate-700">
              {checkoutError}
            </p>
          ) : null}
          <Link
            href="/catalog"
            className="premium-button mt-7 bg-[#155eef] text-sm text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="commercial-dark commercial-grid commercial-shine relative overflow-hidden pb-24 pt-12">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al libro
          </Link>

          <div className="mt-8 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Compra segura
              </p>
              <h1 className="mt-5 text-balance text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                Completa tu compra con confianza.
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                PayPal procesa el pago. BestSeller habilita el lector cuando la
                transacción queda confirmada.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                Datos protegidos
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Acceso tras confirmación
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto -mt-14 grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="commercial-card rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex shrink-0 items-center justify-center rounded-[26px] bg-gradient-to-br from-[#e7f0ff] via-white to-[#e8fbff] p-5 sm:w-48">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="book-cover-shadow h-56 w-36 rounded-r-lg rounded-l-sm object-cover"
                />
              ) : (
                <div className="flex h-56 w-36 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-500">
                  Sin portada
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 py-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#155eef]">
                Tu pedido
              </p>
              <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[#07111f] sm:text-3xl">
                {book.title}
              </h2>

              {book.subtitle ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {book.subtitle}
                </p>
              ) : null}

              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Total a pagar
                </p>
                <p className="mt-1 text-4xl font-black tracking-tight text-[#07111f]">
                  {money(book.amount, book.currency)}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Pago único · Acceso digital a tu cuenta
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {["Precio validado", "Pago cifrado", "Lectura privada"].map(
              (label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-[34px] border border-blue-100 bg-white shadow-[0_32px_90px_rgba(0,48,135,0.16)] lg:sticky lg:top-32">
          <div className="bg-gradient-to-br from-[#001c64] via-[#003087] to-[#0070ba] p-6 text-white sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Método principal
            </p>
            <h2 className="mt-2 text-2xl font-black">Pagar con PayPal</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">
              Elige PayPal, tarjeta de crédito o débito si está disponible para
              tu cuenta y ubicación.
            </p>
          </div>

          <div className="p-6 sm:p-7">
            <PayPalCheckoutButton
              bookId={book.id}
              clientId={getPayPalClientId()}
              currency={book.currency}
            />

            <div className="mt-7 border-t border-slate-200 pt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Próximamente
              </p>
              <FuturePaymentMethods />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
