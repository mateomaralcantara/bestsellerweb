import { getAdminLedger } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
  }).format(value);
}

export default async function AdminLedgerPage() {
  await requireAdminPage("ledger.read");
  const rows = await getAdminLedger();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
        Libro mayor
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">Ledger</h2>
      <p className="mt-2 text-sm text-slate-600">
        Últimos 500 movimientos. El histórico no se edita ni se elimina.
      </p>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 bg-white">
        <table className="min-w-[1150px] w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {new Date(row.created_at).toLocaleString("es-DO")}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3">
                  {row.user_id || "PLATAFORMA"}
                </td>
                <td className="px-4 py-3">{row.role_context}</td>
                <td className="px-4 py-3 font-bold">{row.event_type}</td>
                <td className="max-w-[320px] truncate px-4 py-3 text-slate-600">
                  {row.description || row.reference || "Movimiento"}
                </td>
                <td
                  className={[
                    "whitespace-nowrap px-4 py-3 text-right font-black",
                    Number(row.signed_amount) >= 0
                      ? "text-emerald-700"
                      : "text-rose-700",
                  ].join(" ")}
                >
                  {money(Number(row.signed_amount), row.currency)}
                </td>
                <td className="px-4 py-3">{row.effective_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
