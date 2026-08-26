import AdminFinanceClient from "@/components/admin/AdminFinanceClient";
import { getAdminFinanceConfig, getAdminUsers } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  await requireAdminPage("finance.read");
  const [config, users] = await Promise.all([
    getAdminFinanceConfig(),
    getAdminUsers(),
  ]);

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
        Motor financiero
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Control financiero
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Cambia reglas globales y registra beneficios, regalías, comisiones o
        correcciones mediante asientos auditables.
      </p>
      <div className="mt-6"><AdminFinanceClient config={config} users={users} /></div>
    </div>
  );
}
