"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type PayoutRow = {
  id: string;
  user_id: string;
  role_context: string;
  currency: string;
  requested_amount: number | string;
  net_amount: number | string;
  method: string;
  status: string;
  payout_reference: string | null;
  failure_reason: string | null;
  requested_at: string;
};

export default function AdminPayoutsClient({ rows }: { rows: PayoutRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, row: PayoutRow) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(row.id);

    try {
      await postAdminAction("payout.status", {
        payoutId: row.id,
        status: String(fd.get("status") || ""),
        reference: String(fd.get("reference") || ""),
        failureReason: String(fd.get("failureReason") || ""),
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Retiro actualizado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error actualizando retiro.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold">{message}</div> : null}

      {rows.map((row) => (
        <form
          key={row.id}
          onSubmit={(event) => save(event, row)}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 lg:grid-cols-5">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">{row.role_context}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {row.currency} {Number(row.requested_amount).toFixed(2)}
              </p>
              <p className="mt-1 break-all text-xs text-slate-400">{row.user_id}</p>
            </div>

            <label className="text-sm font-bold">
              Estado
              <select
                name="status"
                defaultValue={row.status === "requested" ? "processing" : row.status}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="processing">Procesando</option>
                <option value="paid">Pagado</option>
                <option value="failed">Fallido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>

            <label className="text-sm font-bold">
              Referencia
              <input
                name="reference"
                defaultValue={row.payout_reference ?? ""}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-bold">
              Razón de fallo
              <input
                name="failureReason"
                defaultValue={row.failure_reason ?? ""}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-bold">
              Motivo admin
              <input
                name="reason"
                required
                placeholder="Motivo"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <button
            disabled={busy !== null}
            className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            Actualizar retiro
          </button>
        </form>
      ))}
    </div>
  );
}
