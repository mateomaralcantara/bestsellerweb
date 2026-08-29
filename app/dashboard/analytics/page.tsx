import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AnalyticsRow = {
  book_id: string;
  slug: string;
  title: string;
  verified_sales_count: number | string | null;
  refund_count: number | string | null;
  gross_revenue: number | string | null;
  review_count: number | string | null;
  verified_rating: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  preview_starts: number | string | null;
  preview_completions: number | string | null;
  checkout_starts: number | string | null;
  reader_completions: number | string | null;
  click_through_rate: number | string | null;
  preview_to_purchase_rate: number | string | null;
  bestseller_score: number | string | null;
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value: unknown) {
  return new Intl.NumberFormat("es-DO").format(Math.round(n(value)));
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n(value));
}

function percent(value: unknown) {
  return `${n(value).toFixed(2)}%`;
}

export default async function AuthorAnalyticsPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/analytics")}`);
  }

  const { data, error } = await supabaseAdmin
    .from("author_book_analytics")
    .select("*")
    .eq("owner_user_id", auth.user.id)
    .order("verified_sales_count", { ascending: false });

  const rows = (data ?? []) as AnalyticsRow[];
  const migrationMissing = Boolean(error);

  const totals = rows.reduce(
    (acc, row) => {
      acc.sales += n(row.verified_sales_count);
      acc.revenue += n(row.gross_revenue);
      acc.impressions += n(row.impressions);
      acc.clicks += n(row.clicks);
      acc.previews += n(row.preview_starts);
      acc.checkouts += n(row.checkout_starts);
      acc.completions += n(row.reader_completions);
      return acc;
    },
    { sales: 0, revenue: 0, impressions: 0, clicks: 0, previews: 0, checkouts: 0, completions: 0 }
  );

  const conversion = totals.previews > 0 ? (totals.sales / totals.previews) * 100 : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">Author Intelligence</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Analítica editorial y comercial</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Métricas derivadas de eventos, compras y lecturas reales. No se utilizan contadores promocionales.
          </p>
        </div>
        <Link href="/dashboard/books/published" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
          Mis libros
        </Link>
      </div>

      {migrationMissing ? (
        <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          La migración Marketplace 9.x todavía no está aplicada en Supabase. El dashboard quedará activo al ejecutar la migración incluida en el repositorio.
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ventas verificadas", integer(totals.sales)],
          ["Ingresos brutos", money(totals.revenue)],
          ["Impresiones", integer(totals.impressions)],
          ["Preview → compra", `${conversion.toFixed(2)}%`],
        ].map(([label, value]) => (
          <article key={label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Clicks", totals.clicks],
          ["Previews", totals.previews],
          ["Checkout", totals.checkouts],
          ["Lecturas completas", totals.completions],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{integer(value)}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-black text-slate-950">Rendimiento por libro</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Libro</th>
                <th className="px-5 py-3">Ventas</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">CTR</th>
                <th className="px-5 py-3">Preview→Compra</th>
                <th className="px-5 py-3">Completados</th>
                <th className="px-5 py-3">Bestseller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.book_id}>
                  <td className="px-5 py-4 font-bold text-slate-950">
                    <Link href={`/catalog/${row.slug}`} className="hover:text-[#155eef]">{row.title}</Link>
                  </td>
                  <td className="px-5 py-4">{integer(row.verified_sales_count)}</td>
                  <td className="px-5 py-4">{n(row.verified_rating).toFixed(2)}</td>
                  <td className="px-5 py-4">{percent(row.click_through_rate)}</td>
                  <td className="px-5 py-4">{percent(row.preview_to_purchase_rate)}</td>
                  <td className="px-5 py-4">{integer(row.reader_completions)}</td>
                  <td className="px-5 py-4 font-black">{n(row.bestseller_score).toFixed(2)}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">Todavía no hay actividad suficiente para mostrar analítica.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
