"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type AuthorRow = {
  id: string;
  user_id: string | null;
  slug: string | null;
  display_name: string | null;
  pen_name: string | null;
  approval_status: string | null;
  rejection_reason: string | null;
};

export default function AdminAuthorsClient({ rows }: { rows: AuthorRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, row: AuthorRow) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(row.id);

    try {
      await postAdminAction("author.update", {
        authorProfileId: row.id,
        status: String(fd.get("status") || ""),
        rejectionReason: String(fd.get("rejectionReason") || ""),
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Autor actualizado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error actualizando autor.");
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
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_2fr]">
            <div>
              <p className="font-black text-slate-950">
                {row.display_name || row.pen_name || "Autor"}
              </p>
              <p className="mt-1 text-xs text-slate-500">/{row.slug || "sin-slug"}</p>
              <p className="mt-1 break-all text-xs text-slate-400">{row.user_id || row.id}</p>
            </div>

            <label className="text-sm font-bold">
              Estado
              <select
                name="status"
                defaultValue={row.approval_status || "pending"}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
                <option value="suspended">Suspendido</option>
              </select>
            </label>

            <label className="text-sm font-bold">
              Razón de rechazo/suspensión
              <input
                name="rejectionReason"
                defaultValue={row.rejection_reason ?? ""}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              name="reason"
              required
              placeholder="Motivo administrativo"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              disabled={busy !== null}
              className="rounded-xl bg-indigo-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
            >
              Guardar autor
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
