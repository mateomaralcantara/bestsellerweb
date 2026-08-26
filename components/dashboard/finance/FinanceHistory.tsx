import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import type { FinanceLedgerRow } from "@/lib/finance/types";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
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

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (["available", "paid", "completed", "succeeded"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["pending", "processing"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (["failed", "cancelled", "reversed", "refunded"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function FinanceHistory({
  rows,
}: {
  rows: FinanceLedgerRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-8 text-center">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
          <ReceiptText className="h-6 w-6" />
        </div>
        <h3 className="relative mt-4 text-lg font-black text-slate-950">
          Tu historial empieza aquí
        </h3>
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Todavía no hay movimientos financieros para esta cuenta. Cuando
          generes ventas, regalías, comisiones o retiros aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_55px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black">Actividad financiera</p>
            <p className="text-xs text-slate-400">
              Últimos movimientos de tu cuenta
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
          {rows.length} movimientos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Fecha
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Operación
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Rol
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Detalle
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Monto
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                Estado
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => {
              const signed =
                row.direction === "credit" ? row.amount : -row.amount;
              const positive = signed >= 0;

              return (
                <tr
                  key={row.id}
                  className="group transition hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {new Intl.DateTimeFormat("es-DO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.created_at))}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-xl",
                          positive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700",
                        ].join(" ")}
                      >
                        {positive ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>

                      <span className="font-bold text-slate-900">
                        {labels[row.event_type]}
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 capitalize text-slate-600">
                    {row.role_context}
                  </td>

                  <td className="min-w-[280px] px-5 py-4 text-slate-600">
                    {row.description ??
                      row.reference ??
                      "Movimiento financiero"}
                  </td>

                  <td
                    className={[
                      "whitespace-nowrap px-5 py-4 text-right text-base font-black",
                      positive ? "text-emerald-700" : "text-rose-700",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {positive ? (
                        <Sparkles className="h-3.5 w-3.5" />
                      ) : null}
                      {positive ? "+" : ""}
                      {money(signed, row.currency)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
                        statusClass(row.effective_status),
                      ].join(" ")}
                    >
                      {row.effective_status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
