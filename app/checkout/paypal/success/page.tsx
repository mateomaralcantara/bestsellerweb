import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RemovePurchasedCartItem } from "@/components/payments/remove-purchased-cart-item";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    bookId?: string;
  }>;
};

type Purchase = {
  id: string;
  status: string;
  book:
    | { title?: string | null; slug?: string | null }
    | Array<{ title?: string | null; slug?: string | null }>
    | null;
};

function getBook(purchase: Purchase) {
  return Array.isArray(purchase.book)
    ? purchase.book[0] || null
    : purchase.book;
}

export default async function SuccessPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const bookId = resolvedSearchParams?.bookId?.trim() || "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");
  if (!bookId) redirect("/catalog");

  const { data } = await supabaseAdmin
    .from("book_purchases")
    .select(
      `
        id,
        status,
        book:books (
          title,
          slug
        )
      `
    )
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .in("status", ["paid", "completed", "approved", "succeeded"])
    .limit(1)
    .maybeSingle();

  const purchase = data as unknown as Purchase | null;

  if (!purchase) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
            ⏳
          </div>

          <h1 className="mt-5 text-3xl font-black text-slate-950">
            Estamos confirmando el pago
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Actualiza esta página para consultar nuevamente el estado.
          </p>

          <Link
            href={`/checkout/paypal/success?bookId=${encodeURIComponent(
              bookId
            )}`}
            className="mt-7 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Actualizar estado
          </Link>
        </div>
      </main>
    );
  }

  const book = getBook(purchase);
  const slug = book?.slug || "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <RemovePurchasedCartItem bookId={bookId} />
      <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>

        <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
          Pago confirmado
        </p>

        <h1 className="mt-2 text-3xl font-black text-slate-950">
          Tu libro ya está disponible
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          {book?.title
            ? `La compra de “${book.title}” fue registrada correctamente.`
            : "La compra fue registrada correctamente."}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {slug ? (
            <Link
              href={`/reader/${slug}`}
              className="rounded-xl bg-black px-5 py-3 text-sm font-black text-white"
            >
              Abrir libro completo
            </Link>
          ) : null}

          <Link
            href={slug ? `/catalog/${slug}` : "/catalog"}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
