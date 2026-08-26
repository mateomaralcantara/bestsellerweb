"use client";

import { FormEvent, useState } from "react";

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

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
    >
      <h3 className="font-black text-slate-950">Solicitar retiro</h3>
      <p className="mt-1 text-sm text-slate-600">
        Solo puedes retirar ganancias disponibles del origen seleccionado.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {allowRoleSelection ? (
          <select
            value={selectedRole}
            onChange={(event) =>
              setSelectedRole(event.target.value as PayoutRole)
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
            aria-label="Origen del saldo"
          >
            <option value="author">Regalías de autor</option>
            <option value="affiliate">Comisiones de afiliado</option>
          </select>
        ) : (
          <div className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            {roleLabels[effectiveRole]}
          </div>
        )}

        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          min="0.01"
          step="0.01"
          required
          placeholder="Monto"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2"
        />

        <select
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          aria-label="Moneda"
        >
          <option value="USD">USD</option>
          <option value="DOP">DOP</option>
        </select>

        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          aria-label="Método de retiro"
        >
          <option value="paypal">PayPal</option>
          <option value="bank">Transferencia bancaria</option>
        </select>
      </div>

      <button
        disabled={busy}
        className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Procesando..." : "Solicitar retiro"}
      </button>

      {message ? (
        <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
      ) : null}
    </form>
  );
}