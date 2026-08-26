"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type Purchase = {
  id: string;
  bookTitle: string;
  status: string;
  amountPaid: number;
  currency: string;
  revokedAt: string | null;
};

type Summary = {
  currency: string;
  benefitsTotal: number;
  authorEarningsTotal: number;
  affiliateEarningsTotal: number;
  availableToWithdraw: number;
  pendingEarnings: number;
  paidOutTotal: number;
  buyerNetSpend: number;
  refundsTotal: number;
};

async function post360(userId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudo aplicar el cambio.");
}

export default function AdminUser360ExtraClient({
  userId,
  userMetadata,
  appMetadata,
  purchases,
  summaries,
}: {
  userId: string;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
  purchases: Purchase[];
  summaries: Summary[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setMessage(null);
    try { await fn(); setMessage("Cambio aplicado y auditado."); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Error administrativo."); }
    finally { setBusy(null); }
  }

  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    await run("password", () => post360(userId, {
      action: "password.set",
      password: String(fd.get("password") || ""),
      reason: String(fd.get("reason") || ""),
    }));
  }

  async function metadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    let parsed: unknown;
    try { parsed = JSON.parse(String(fd.get("metadata") || "{}")); }
    catch { setMessage("JSON de metadata invalido."); return; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { setMessage("La metadata debe ser un objeto JSON."); return; }
    await run("metadata", () => post360(userId, {
      action: "metadata.update",
      metadata: parsed as Record<string, unknown>,
      reason: String(fd.get("reason") || ""),
    }));
  }

  async function adjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    await run("finance", () => postAdminAction("finance.adjustment", {
      userId,
      roleContext: String(fd.get("roleContext") || "customer"),
      direction: String(fd.get("direction") || "credit"),
      amount: Number(fd.get("amount")),
      currency: String(fd.get("currency") || "USD"),
      reason: String(fd.get("reason") || ""),
    }).then(() => undefined));
  }

  async function access(event: FormEvent<HTMLFormElement>, row: Purchase) {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    await run(`purchase:${row.id}`, () => post360(userId, {
      action: "purchase.access",
      purchaseId: row.id,
      grant: Boolean(row.revokedAt),
      reason: String(fd.get("reason") || ""),
    }));
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold">{message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={password} className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="text-xl font-black">Cambiar contrasena</h3>
          <p className="mt-1 text-sm text-slate-600">La contrasena actual nunca se muestra.</p>
          <input name="password" type="password" minLength={10} required placeholder="Nueva contrasena" className="mt-4 w-full rounded-xl border border-rose-300 bg-white px-3 py-2" />
          <input name="reason" required minLength={3} placeholder="Motivo administrativo" className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2" />
          <button disabled={busy !== null} className="mt-3 rounded-xl bg-rose-700 px-5 py-2 font-black text-white disabled:opacity-50">Cambiar</button>
        </form>

        <form onSubmit={metadata} className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-black">Metadata del usuario</h3>
          <textarea name="metadata" rows={7} defaultValue={JSON.stringify(userMetadata, null, 2)} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs" />
          <input name="reason" required minLength={3} placeholder="Motivo administrativo" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
          <button disabled={busy !== null} className="mt-3 rounded-xl bg-slate-950 px-5 py-2 font-black text-white disabled:opacity-50">Guardar metadata</button>
          <details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-bold">App metadata - solo lectura</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(appMetadata, null, 2)}</pre></details>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaries.map((row) => <div key={row.currency} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black text-slate-500">{row.currency}</p><p className="mt-2 text-sm text-slate-500">Disponible</p><p className="text-2xl font-black text-emerald-700">{row.currency} {row.availableToWithdraw.toFixed(2)}</p><p className="mt-2 text-xs">Beneficios {row.benefitsTotal.toFixed(2)}</p><p className="text-xs">Regalias {row.authorEarningsTotal.toFixed(2)}</p><p className="text-xs">Comisiones {row.affiliateEarningsTotal.toFixed(2)}</p><p className="text-xs">Reembolsos {row.refundsTotal.toFixed(2)}</p></div>)}
      </div>

      <form onSubmit={adjustment} className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-xl font-black text-amber-950">Ajuste financiero auditable</h3>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <select name="roleContext" className="rounded-xl border border-amber-300 bg-white px-3 py-2"><option value="customer">Comprador</option><option value="author">Autor</option><option value="affiliate">Afiliado</option></select>
          <select name="direction" className="rounded-xl border border-amber-300 bg-white px-3 py-2"><option value="credit">Sumar</option><option value="debit">Restar</option></select>
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Monto" className="rounded-xl border border-amber-300 bg-white px-3 py-2" />
          <select name="currency" className="rounded-xl border border-amber-300 bg-white px-3 py-2"><option value="USD">USD</option><option value="DOP">DOP</option></select>
        </div>
        <input name="reason" required minLength={5} placeholder="Motivo" className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2" />
        <button disabled={busy !== null} className="mt-3 rounded-xl bg-amber-700 px-5 py-2 font-black text-white disabled:opacity-50">Registrar ajuste</button>
      </form>

      <div className="space-y-3">
        {purchases.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{row.bookTitle}</p><p className="text-xs text-slate-500">{row.currency} {row.amountPaid.toFixed(2)} - {row.status}</p></div><span className={row.revokedAt ? "rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700" : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"}>{row.revokedAt ? "REVOCADO" : "ACTIVO"}</span></div><form onSubmit={(event) => access(event, row)} className="mt-3 flex flex-wrap gap-2"><input name="reason" required minLength={3} placeholder="Motivo" className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2" /><button disabled={busy !== null} className={row.revokedAt ? "rounded-xl bg-emerald-700 px-4 py-2 font-black text-white" : "rounded-xl bg-rose-700 px-4 py-2 font-black text-white"}>{row.revokedAt ? "Reactivar acceso" : "Revocar acceso"}</button></form></article>)}
      </div>
    </div>
  );
}