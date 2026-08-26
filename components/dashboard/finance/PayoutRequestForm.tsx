"use client";

import { FormEvent, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

type PayoutRole = "author" | "affiliate";

type PayoutRequestFormProps = {
  roleContext?: PayoutRole;
  allowRoleSelection?: boolean;
};

const roleLabels: Record<PayoutRole, string> = {
  author: "Regalías de autor",
  affiliate: "Comisiones de afiliado",
};

export default function PayoutRequestForm({
  roleContext,
  allowRoleSelection = false,
}: PayoutRequestFormProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("paypal");
  const [selectedRole, setSelectedRole] = useState<PayoutRole>(
    roleContext ?? "author"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveRole = roleContext ?? selectedRole;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/finance/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          currency,
          method,
          roleContext: effectiveRole,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            payoutId?: string;
            roleContext?: PayoutRole;
          }
        | null;

      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "No se pudo solicitar el retiro.");
      }

      setAmount("");
      setMessage(
        `Retiro solicitado desde ${roleLabels[effectiveRole]}: ${body.payoutId}`
      );
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Error solicitando retiro."
      );
    } finally {
      setBusy(false);
    }
  }

  const controlClass =
    "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/50 focus:bg-white/[0.11] focus:ring-4 focus:ring-emerald-400/10";

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(135deg,#020617_0%,#0f172a_52%,#0c2d39_100%)] p-5 text-white shadow-[0_28px_80px_-45px_rgba(2,6,23,0.85)] sm:p-6"
    >
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 shadow-lg shadow-emerald-500/20">
              <WalletCards className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Wallet
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight">
                Solicitar retiro
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Retira únicamente ganancias disponibles del origen
                seleccionado.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            Solicitud segura
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">
              Origen del saldo
            </span>

            {allowRoleSelection ? (
              <select
                value={selectedRole}
                onChange={(event) =>
                  setSelectedRole(event.target.value as PayoutRole)
                }
                className={controlClass}
                aria-label="Origen del saldo"
              >
                <option className="text-slate-950" value="author">
                  Regalías de autor
                </option>
                <option className="text-slate-950" value="affiliate">
                  Comisiones de afiliado
                </option>
              </select>
            ) : (
              <div className={`${controlClass} flex items-center`}>
                {roleLabels[effectiveRole]}
              </div>
            )}
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">
              Monto
            </span>
            <div className="relative">
              <BadgeDollarSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" />
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className={`${controlClass} pl-11`}
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">
              Moneda
            </span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={controlClass}
              aria-label="Moneda"
            >
              <option className="text-slate-950" value="USD">
                USD · Dólar
              </option>
              <option className="text-slate-950" value="DOP">
                DOP · Peso dominicano
              </option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-400">
              Método
            </span>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className={`${controlClass} pl-11`}
                aria-label="Método de retiro"
              >
                <option className="text-slate-950" value="paypal">
                  PayPal
                </option>
                <option className="text-slate-950" value="bank">
                  Transferencia bancaria
                </option>
              </select>
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <button
            disabled={busy}
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Procesando..." : "Solicitar retiro"}
            {!busy ? (
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            ) : null}
          </button>

          <p className="text-xs text-slate-500">
            El saldo debe estar disponible en el rol seleccionado.
          </p>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm font-semibold text-slate-200">
            {message}
          </div>
        ) : null}
      </div>
    </form>
  );
}
