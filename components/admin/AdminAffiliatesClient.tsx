"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type AffiliateRow = {
  id: string;
  display_name: string | null;
  handle: string | null;
  referral_code: string | null;
  code: string | null;
  commission_rate: number | string | null;
  commission_rate_override: number | string | null;
  status: string;
  approved_at: string | null;
};

export default function AdminAffiliatesClient({
  rows,
}: {
  rows: AffiliateRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(
    event: FormEvent<HTMLFormElement>,
    row: AffiliateRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(row.id);
    setMessage(null);

    try {
      await postAdminAction("affiliate.update", {
        affiliateId: row.id,
        status: String(fd.get("status") || ""),
        referralCode: String(fd.get("referralCode") || ""),
        commissionRatePct: Number(fd.get("commissionRate")),
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Afiliado actualizado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error actualizando afiliado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold">
          {message}
        </div>
      ) : null}

      {rows.map((row) => (
        <form
          key={row.id}
          onSubmit={(event) => save(event, row)}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div>
              <p className="font-black text-slate-950">
                {row.display_name || row.handle || "Afiliado"}
              </p>
              <p className="mt-1 break-all text-xs text-slate-400">{row.id}</p>
            </div>

            <label className="text-sm font-bold">
              Estado
              <select
                name="status"
                defaultValue={row.status}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </label>

            <label className="text-sm font-bold">
              Código
              <input
                name="referralCode"
                defaultValue={row.referral_code || row.code || ""}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-bold">
              Comisión %
              <input
                name="commissionRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={Number(row.commission_rate ?? 10)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <input
              name="reason"
              required
              placeholder="Motivo obligatorio"
              className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              disabled={busy !== null}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
            >
              Guardar afiliado
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
