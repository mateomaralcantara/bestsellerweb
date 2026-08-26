import AdminUsersClient from "@/components/admin/AdminUsersClient";
import { getAdminUsers } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPage("users.read");
  const rows = await getAdminUsers();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
        Identidad y acceso
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Usuarios</h2>
      <p className="mt-2 text-sm text-slate-600">
        Edita identidad, suspende cuentas, bloquea compras/retiros y administra roles.
      </p>
      <div className="mt-6"><AdminUsersClient rows={rows} /></div>
    </div>
  );
}
