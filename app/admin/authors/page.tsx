import AdminAuthorsClient from "@/components/admin/AdminAuthorsClient";
import { getAdminAuthors } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminAuthorsPage() {
  await requireAdminPage("authors.read");
  const rows = await getAdminAuthors();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
        Control editorial
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Autores</h2>
      <p className="mt-2 text-sm text-slate-600">
        Aprueba, rechaza o suspende la capacidad de publicación.
      </p>
      <div className="mt-6"><AdminAuthorsClient rows={rows} /></div>
    </div>
  );
}
