import Link from "next/link";
import { BookOpen, CalendarDays, CreditCard } from "lucide-react";
import type { ActivePurchaseRow } from "@/lib/admin-purchases";

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-DO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "America/Santo_Domingo",
  }).format(date);
}

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || !Number.isFinite(amount)) return "Pago confirmado";

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function PurchasedBookCard({
  purchase,
}: {
  purchase: ActivePurchaseRow;
}) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        {purchase.coverUrl ? (
          <img
            src={purchase.coverUrl}
            alt={purchase.bookTitle}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <BookOpen className="h-10 w-10" />
            <span className="text-sm">Sin portada</span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow">
          Comprado
        </span>
      </div>

      <div className="p-5">
        <h3 className="line-clamp-2 text-lg font-black text-slate-950">
          {purchase.bookTitle}
        </h3>

        <div className="mt-4 space-y-2 text-xs text-slate-500">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {formatDate(purchase.paidAt)}
          </p>
          <p className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {formatAmount(purchase.amountPaid, purchase.currency)}
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {purchase.bookSlug ? (
            <Link
              href={`/reader/${purchase.bookSlug}`}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Empezar a leer
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">
              Libro no disponible
            </span>
          )}

          {purchase.bookSlug ? (
            <Link
              href={`/catalog/${purchase.bookSlug}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Ver ficha
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
