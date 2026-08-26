"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type AdminSecurityRow = {
  userId: string;
  email: string | null;
  permissions: string[];
};

const COMMON = [
  "*",
  "admin.dashboard",
  "users.read",
  "users.manage",
  "roles.manage",
  "finance.read",
  "finance.configure",
  "finance.adjust",
  "affiliates.read",
  "affiliates.manage",
  "authors.read",
  "authors.manage",
  "payouts.read",
  "payouts.manage",
  "ledger.read",
  "books.read",
  "books.manage",
  "purchases.read",
  "refunds.manage",
  "audit.read",
  "security.read",
  "security.manage",
];

export default function AdminSecurityClient({
  rows,
}: {
  rows: AdminSecurityRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(
    event: FormEvent<HTMLFormElement>,
    row: AdminSecurityRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const permissions = fd
      .getAll("permission")
      .map(String)
      .filter(Boolean);

    setBusy(row.userId);

    try {
      await postAdminAction("admin.permissions.set", {
        adminUserId: row.userId,
        permissions,
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Permisos administrativos actualizados.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error de permisos.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold">{message}</div> : null}

      {rows.map((row) => (
        <form
          key={row.userId}
          onSubmit={(event) => save(event, row)}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="font-black text-slate-950">{row.email || row.userId}</p>
          <p className="mt-1 break-all text-xs text-slate-400">{row.userId}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COMMON.map((permission) => (
              <label
                key={permission}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="permission"
                  value={permission}
                  defaultChecked={row.permissions.includes(permission)}
                />
                <span className="break-all">{permission}</span>
              </label>
            ))}
          </div>

          <input
            name="reason"
            required
            placeholder="Motivo obligatorio"
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2"
          />

          <button
            disabled={busy !== null}
            className="mt-3 rounded-xl bg-violet-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            Guardar permisos
          </button>
        </form>
      ))}
    </div>
  );
}
