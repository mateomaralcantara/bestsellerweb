import AdminPayoutsClient from "@/components/admin/AdminPayoutsClient";
import { getAdminPayouts } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  await requireAdminPage("payouts.read");
  const rows = await getAdminPayouts();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
        Tesorería
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Retiros</h2>
      <p className="mt-2 text-sm text-slate-600">
        Mueve cada solicitud por procesamiento, pago, fallo o cancelación.
      </p>
      <div className="mt-6"><AdminPayoutsClient rows={rows} /></div>
    </div>
  );
}
