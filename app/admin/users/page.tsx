import AdminUserDirectoryClient from "@/components/admin/AdminUserDirectoryClient";
import { getAdminUsers } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPage("users.read");
  const rows = await getAdminUsers();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-700">
        SUPERADMIN · USUARIOS
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Directorio y creación de usuarios
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Toca cualquier usuario para abrir una ficha exclusiva con todos sus
        datos. También puedes crear una cuenta completa con roles, bloqueos y
        montos iniciales.
      </p>

      <div className="mt-6">
        <AdminUserDirectoryClient rows={rows} />
      </div>
    </div>
  );
}
