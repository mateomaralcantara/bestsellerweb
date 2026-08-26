import AdminBooksClient from "@/components/admin/AdminBooksClient";
import { getAdminBooks } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminBooksPage() {
  await requireAdminPage("books.read");
  const rows = await getAdminBooks();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-700">
        Catálogo
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Libros</h2>
      <p className="mt-2 text-sm text-slate-600">
        Modifica título, slug, estado, precio PayPal y reglas financieras por libro.
      </p>
      <div className="mt-6"><AdminBooksClient rows={rows} /></div>
    </div>
  );
}
