import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type VersionRow = {
  id: string;
  book_id: string;
  version_number: number;
  checksum_sha256: string | null;
  change_notes: string | null;
  is_current: boolean;
  created_at: string;
  books?: { title?: string | null; slug?: string | null } | null;
  epub_preflight_reports?: { score?: number | null; status?: string | null } | null;
};

export default async function EditorialVersionsPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/editorial-versions")}`);
  }

  const { data: ownedBooks } = await supabaseAdmin
    .from("books")
    .select("id")
    .eq("owner_user_id", auth.user.id);
  const ids = (ownedBooks ?? []).map((book) => book.id);

  let rows: VersionRow[] = [];
  let migrationError = "";

  if (ids.length) {
    const { data, error } = await supabaseAdmin
      .from("book_editorial_versions")
      .select("id, book_id, version_number, checksum_sha256, change_notes, is_current, created_at, books(title,slug), epub_preflight_reports(score,status)")
      .in("book_id", ids)
      .order("created_at", { ascending: false });

    if (error) migrationError = error.message;
    else rows = (data ?? []) as unknown as VersionRow[];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">Control editorial</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Versiones de tus libros</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Cada checksum distinto crea una nueva versión auditable. El historial evita reemplazos silenciosos y mantiene trazabilidad del EPUB publicado.</p>
        </div>
        <Link href="/dashboard/epub-quality" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">EPUB Quality Gate</Link>
      </div>

      {migrationError ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">La migración Marketplace 9.x todavía no está aplicada: {migrationError}</p> : null}

      <section className="mt-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Libro</th><th className="px-5 py-3">Versión</th><th className="px-5 py-3">Preflight</th><th className="px-5 py-3">Checksum</th><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Estado</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 font-black text-slate-950">{row.books?.slug ? <Link href={`/catalog/${row.books.slug}`} className="hover:text-[#155eef]">{row.books.title || row.book_id}</Link> : row.books?.title || row.book_id}</td>
                  <td className="px-5 py-4">v{row.version_number}</td>
                  <td className="px-5 py-4">{row.epub_preflight_reports?.score != null ? `${row.epub_preflight_reports.score}/100 · ${row.epub_preflight_reports.status || ""}` : "—"}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{row.checksum_sha256 ? `${row.checksum_sha256.slice(0, 12)}…` : "—"}</td>
                  <td className="px-5 py-4">{new Date(row.created_at).toLocaleDateString("es-DO")}</td>
                  <td className="px-5 py-4">{row.is_current ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Actual</span> : <span className="text-slate-400">Histórica</span>}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Todavía no hay versiones registradas. Ejecuta EPUB Quality Gate para inventariar tus EPUB existentes.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
