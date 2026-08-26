import AdminAffiliatesClient from "@/components/admin/AdminAffiliatesClient";
import { getAdminAffiliates } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  await requireAdminPage("affiliates.read");
  const rows = await getAdminAffiliates();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
        Red comercial
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Afiliados</h2>
      <p className="mt-2 text-sm text-slate-600">
        Aprueba, rechaza, cambia códigos y fija comisiones individuales.
      </p>
      <div className="mt-6"><AdminAffiliatesClient rows={rows} /></div>
    </div>
  );
}
