import AdminSecurityClient from "@/components/admin/AdminSecurityClient";
import { getAdminSecurity } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  await requireAdminPage("security.read");
  const rows = await getAdminSecurity();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">
        Gobierno de acceso
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Seguridad y permisos
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        El rol admin permite entrar; los permisos determinan qué puede administrar.
        El permiso * concede control total.
      </p>
      <div className="mt-6"><AdminSecurityClient rows={rows} /></div>
    </div>
  );
}
