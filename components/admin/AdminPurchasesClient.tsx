"use client";

import { FormEvent, useState } from "react";
import type { ActivePurchaseRow } from "@/lib/admin-purchases";
import { postAdminAction } from "./admin-client";

export default function AdminPurchasesClient({
  rows,
}: {
  rows: ActivePurchaseRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refund(
    event: FormEvent<HTMLFormElement>,
    row: ActivePurchaseRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(row.id);

    try {
      await postAdminAction("purchase.refund", {
        purchaseId: row.id,
        amount: Number(fd.get("amount")),
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Reembolso procesado y registrado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error procesando reembolso.");
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
        <article
          key={row.id}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-black text-slate-950">{row.bookTitle}</p>
              <p className="mt-1 text-sm text-slate-600">
                {row.userName} · {row.userEmail || row.userId}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {row.paymentProvider || "pago"} · {row.paymentReference || "sin referencia"}
              </p>
            </div>

            <p className="text-2xl font-black text-slate-950">
              {row.currency} {Number(row.amountPaid ?? 0).toFixed(2)}
            </p>
          </div>

          {row.paymentProvider === "paypal" && row.paymentReference ? (
            <form
              onSubmit={(event) => refund(event, row)}
              className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
            >
              <input
                name="amount"
                type="number"
                min="0.01"
                max={Number(row.amountPaid ?? 0)}
                step="0.01"
                defaultValue={Number(row.amountPaid ?? 0).toFixed(2)}
                required
                className="w-36 rounded-xl border border-rose-300 bg-white px-3 py-2"
              />
              <input
                name="reason"
                required
                minLength={5}
                placeholder="Motivo obligatorio del reembolso"
                className="min-w-[260px] flex-1 rounded-xl border border-rose-300 bg-white px-3 py-2"
              />
              <button
                disabled={busy !== null}
                className="rounded-xl bg-rose-700 px-5 py-2 font-black text-white disabled:opacity-50"
              >
                Reembolsar por PayPal
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}
