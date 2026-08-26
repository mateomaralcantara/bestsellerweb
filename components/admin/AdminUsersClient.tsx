"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AdminUserRow } from "@/lib/admin/admin-data";
import { postAdminAction } from "./admin-client";

export default function AdminUsersClient({
  rows,
}: {
  rows: AdminUserRow[];
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) =>
      [row.id, row.email, row.fullName, row.roles.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  async function run(
    key: string,
    action: string,
    payload: Record<string, unknown>
  ) {
    setBusy(key);
    setMessage(null);

    try {
      await postAdminAction(action, payload);
      setMessage("Cambio aplicado correctamente.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error administrativo.");
    } finally {
      setBusy(null);
    }
  }

  async function updateIdentity(
    event: FormEvent<HTMLFormElement>,
    row: AdminUserRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await run(`identity:${row.id}`, "user.update", {
      userId: row.id,
      email: String(fd.get("email") || ""),
      fullName: String(fd.get("fullName") || ""),
      reason: String(fd.get("reason") || ""),
    });
  }

  async function updateControls(
    event: FormEvent<HTMLFormElement>,
    row: AdminUserRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await run(`controls:${row.id}`, "user.controls", {
      userId: row.id,
      purchaseBlocked: fd.get("purchaseBlocked") === "on",
      payoutBlocked: fd.get("payoutBlocked") === "on",
      notes: String(fd.get("notes") || ""),
      reason: String(fd.get("reason") || ""),
    });
  }

  async function roleChange(
    event: FormEvent<HTMLFormElement>,
    row: AdminUserRow
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const role = String(fd.get("role") || "").trim();
    const operation = String(fd.get("operation") || "add");

    await run(`role:${row.id}`, operation === "remove" ? "role.remove" : "role.add", {
      userId: row.id,
      role,
      reason: String(fd.get("reason") || ""),
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por correo, nombre, UUID o rol..."
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
        />
        {message ? (
          <p className="mt-3 text-sm font-bold text-slate-700">{message}</p>
        ) : null}
      </div>

      <div className="space-y-4">
        {filtered.map((row) => (
          <article
            key={row.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  {row.fullName || row.email || "Usuario"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{row.email || "Sin correo"}</p>
                <p className="mt-1 break-all text-xs text-slate-400">{row.id}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                    >
                      {role}
                    </span>
                  ))}
                  {row.banned ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">
                      SUSPENDIDO
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                disabled={busy !== null}
                onClick={() =>
                  run(
                    `ban:${row.id}`,
                    row.banned ? "user.unban" : "user.ban",
                    {
                      userId: row.id,
                      reason: row.banned
                        ? "Reactivación administrativa"
                        : "Suspensión administrativa",
                    }
                  )
                }
                className={[
                  "rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50",
                  row.banned ? "bg-emerald-700" : "bg-rose-700",
                ].join(" ")}
              >
                {row.banned ? "Reactivar" : "Suspender"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <form
                onSubmit={(event) => updateIdentity(event, row)}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-black text-slate-900">Identidad</p>
                <input
                  name="fullName"
                  defaultValue={row.fullName ?? ""}
                  placeholder="Nombre completo"
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  name="email"
                  type="email"
                  defaultValue={row.email ?? ""}
                  placeholder="Correo"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  name="reason"
                  required
                  placeholder="Motivo del cambio"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <button
                  disabled={busy !== null}
                  className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Guardar identidad
                </button>
              </form>

              <form
                onSubmit={(event) => updateControls(event, row)}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-black text-slate-900">Bloqueos operativos</p>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    name="purchaseBlocked"
                    type="checkbox"
                    defaultChecked={row.purchaseBlocked}
                  />
                  Bloquear compras
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    name="payoutBlocked"
                    type="checkbox"
                    defaultChecked={row.payoutBlocked}
                  />
                  Bloquear retiros
                </label>
                <input
                  name="notes"
                  defaultValue={row.notes ?? ""}
                  placeholder="Nota interna"
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  name="reason"
                  required
                  placeholder="Motivo"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <button
                  disabled={busy !== null}
                  className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Aplicar bloqueos
                </button>
              </form>

              <form
                onSubmit={(event) => roleChange(event, row)}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-black text-slate-900">Roles</p>
                <input
                  name="role"
                  required
                  placeholder="Ej. admin o affiliate"
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <select
                  name="operation"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="add">Agregar rol</option>
                  <option value="remove">Quitar rol</option>
                </select>
                <input
                  name="reason"
                  required
                  placeholder="Motivo"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <button
                  disabled={busy !== null}
                  className="mt-3 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Aplicar rol
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
