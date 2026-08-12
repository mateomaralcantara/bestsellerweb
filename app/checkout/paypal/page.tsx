import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
            !
          </div>
          <h1 className="mt-5 text-3xl font-black text-slate-950">
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
            className="mt-7 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Volver al catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
            Compra segura
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Completa la compra de tu libro
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            El lector se habilitará cuando PayPal confirme el pago.
          </p>

          <div className="mt-8 flex gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="h-44 w-28 rounded-lg object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-44 w-28 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-500">
                Sin portada
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950">
                {book.title}
              </h2>

              {book.subtitle ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {book.subtitle}
                </p>
              ) : null}

              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Total
              </p>

              <p className="mt-1 text-3xl font-black text-slate-950">
                {money(book.amount, book.currency)}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Pago único · Acceso digital
              </p>
            </div>
          </div>

          <Link
            href={`/catalog/${book.slug}`}
            className="mt-6 inline-block text-sm font-bold text-blue-700 hover:underline"
          >
            ← Volver al libro
          </Link>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-black text-slate-950">
            Método de pago
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Paga mediante PayPal o con las opciones habilitadas para
            tu cuenta y ubicación.
          </p>

          <div className="mt-6">
            <PayPalCheckoutButton
              bookId={book.id}
              clientId={getPayPalClientId()}
              currency={book.currency}
            />
          </div>

          <div className="mt-7 border-t border-slate-200 pt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Próximamente
            </p>
            <FuturePaymentMethods />
          </div>
        </aside>
      </div>
    </main>
  );
}
