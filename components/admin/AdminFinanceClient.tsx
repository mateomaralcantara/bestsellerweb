"use client";

import { FormEvent, useState } from "react";
import type { AdminUserRow } from "@/lib/admin/admin-data";
import { postAdminAction } from "./admin-client";

export default function AdminFinanceClient({
  config,
  users,
}: {
  config: {
    defaultAuthorRate: number;
    defaultAffiliateRate: number;
    earningsHoldDays: number;
    minimumPayout: number;
  };
  users: AdminUserRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);

    try {
      await postAdminAction(action, payload);
      setMessage("Cambio financiero aplicado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error financiero.");
    } finally {
      setBusy(false);
    }
  }

  async function updateConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await submit("finance.config.update", {
      defaultAuthorRatePct: Number(fd.get("authorRate")),
      defaultAffiliateRatePct: Number(fd.get("affiliateRate")),
      earningsHoldDays: Number(fd.get("holdDays")),
      minimumPayout: Number(fd.get("minimumPayout")),
      reason: String(fd.get("reason") || ""),
    });
  }

  async function adjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await submit("finance.adjustment", {
      userId: String(fd.get("userId") || ""),
      roleContext: String(fd.get("roleContext") || ""),
      direction: String(fd.get("direction") || ""),
      amount: Number(fd.get("amount")),
      currency: String(fd.get("currency") || "USD"),
      reason: String(fd.get("reason") || ""),
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={updateConfig}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-black text-slate-950">
          Configuración financiera global
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Modifica las reglas predeterminadas para ventas futuras.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="text-sm font-bold text-slate-700">
            Regalía autor %
            <input
              name="authorRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={(config.defaultAuthorRate * 100).toFixed(2)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Comisión afiliado %
            <input
              name="affiliateRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={(config.defaultAffiliateRate * 100).toFixed(2)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Retención días
            <input
              name="holdDays"
              type="number"
              min="0"
              max="180"
              defaultValue={config.earningsHoldDays}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Retiro mínimo
            <input
              name="minimumPayout"
              type="number"
              min="0"
              step="0.01"
              defaultValue={config.minimumPayout.toFixed(2)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <input
          name="reason"
          required
          placeholder="Motivo obligatorio del cambio"
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2"
        />

        <button
          disabled={busy}
          className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 font-black text-white disabled:opacity-50"
        >
          Guardar configuración global
        </button>
      </form>

      <form
        onSubmit={adjustment}
        className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
      >
        <h2 className="text-xl font-black text-amber-950">
          Ajuste financiero administrativo
        </h2>
        <p className="mt-1 text-sm text-amber-900">
          Nunca modifica movimientos históricos: agrega un asiento compensatorio
          auditable al ledger.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <select
            name="userId"
            required
            className="rounded-xl border border-amber-300 bg-white px-3 py-2"
          >
            <option value="">Selecciona usuario</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email || user.fullName || user.id}
              </option>
            ))}
          </select>

          <select
            name="roleContext"
            className="rounded-xl border border-amber-300 bg-white px-3 py-2"
          >
            <option value="customer">Comprador / beneficio</option>
            <option value="author">Autor / regalía</option>
            <option value="affiliate">Afiliado / comisión</option>
          </select>

          <select
            name="direction"
            className="rounded-xl border border-amber-300 bg-white px-3 py-2"
          >
            <option value="credit">Sumar</option>
            <option value="debit">Restar</option>
          </select>

          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="Monto"
            className="rounded-xl border border-amber-300 bg-white px-3 py-2"
          />

          <select
            name="currency"
            className="rounded-xl border border-amber-300 bg-white px-3 py-2"
          >
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
          </select>
        </div>

        <input
          name="reason"
          required
          minLength={5}
          placeholder="Motivo obligatorio: bono, corrección, compensación..."
          className="mt-4 w-full rounded-xl border border-amber-300 bg-white px-3 py-2"
        />

        <button
          disabled={busy}
          className="mt-4 rounded-xl bg-amber-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
        >
          Registrar ajuste auditable
        </button>
      </form>
    </div>
  );
}
