import AdminPurchasesClient from "@/components/admin/AdminPurchasesClient";
import { getAdminPurchases } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminPurchasesPage() {
  await requireAdminPage("purchases.read");
  const rows = await getAdminPurchases();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">
        Ventas y soporte
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Compras</h2>
      <p className="mt-2 text-sm text-slate-600">
        Consulta compras activas y procesa reembolsos PayPal con reverso contable.
      </p>
      <div className="mt-6"><AdminPurchasesClient rows={rows} /></div>
    </div>
  );
}
