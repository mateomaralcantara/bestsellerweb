import type { FinanceLedgerRow } from "@/lib/finance/types";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const labels: Record<FinanceLedgerRow["event_type"], string> = {
  purchase: "Compra",
  author_royalty: "Regalía de autor",
  affiliate_commission: "Comisión de afiliado",
  platform_fee: "Comisión de plataforma",
  payment_fee: "Comisión de pago",
  discount: "Descuento",
  credit: "Crédito",
  refund: "Reembolso",
  reversal: "Reverso",
  payout: "Retiro",
  adjustment: "Ajuste",
};

export default function FinanceHistory({ rows }: { rows: FinanceLedgerRow[] }) {
  if (rows.length === 0) return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
      Todavía no hay movimientos financieros para esta cuenta.
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>
          <th className="px-4 py-3 text-left font-bold text-slate-600">Fecha</th>
          <th className="px-4 py-3 text-left font-bold text-slate-600">Operación</th>
          <th className="px-4 py-3 text-left font-bold text-slate-600">Rol</th>
          <th className="px-4 py-3 text-left font-bold text-slate-600">Detalle</th>
          <th className="px-4 py-3 text-right font-bold text-slate-600">Monto</th>
          <th className="px-4 py-3 text-left font-bold text-slate-600">Estado</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const signed = row.direction === "credit" ? row.amount : -row.amount;
            return <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                {new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{labels[row.event_type]}</td>
              <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">{row.role_context}</td>
              <td className="min-w-[260px] px-4 py-3 text-slate-600">{row.description ?? row.reference ?? "Movimiento financiero"}</td>
              <td className={["whitespace-nowrap px-4 py-3 text-right font-black", signed >= 0 ? "text-emerald-700" : "text-rose-700"].join(" ")}>
                {signed >= 0 ? "+" : ""}{money(signed,row.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{row.effective_status}</span>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}