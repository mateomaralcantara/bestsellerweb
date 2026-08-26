"use client";

import { FormEvent, useState } from "react";
import { postAdminAction } from "./admin-client";

type BookRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  owner_user_id: string;
  cover_url: string | null;
  paypal_price: number | string | null;
  paypal_currency: string | null;
  financeRule: {
    author_rate: number | string | null;
    affiliate_rate: number | string | null;
    hold_days: number | null;
  } | null;
};

export default function AdminBooksClient({ rows }: { rows: BookRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function updateBook(event: FormEvent<HTMLFormElement>, row: BookRow) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(`book:${row.id}`);

    try {
      await postAdminAction("book.update", {
        bookId: row.id,
        title: String(fd.get("title") || ""),
        slug: String(fd.get("slug") || ""),
        status: String(fd.get("status") || ""),
        paypalPrice: Number(fd.get("paypalPrice")),
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Libro actualizado.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error actualizando libro.");
    } finally {
      setBusy(null);
    }
  }

  async function updateFinance(event: FormEvent<HTMLFormElement>, row: BookRow) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(`finance:${row.id}`);

    const authorRaw = String(fd.get("authorRate") || "").trim();
    const affiliateRaw = String(fd.get("affiliateRate") || "").trim();
    const holdRaw = String(fd.get("holdDays") || "").trim();

    try {
      await postAdminAction("book.finance.update", {
        bookId: row.id,
        authorRatePct: authorRaw ? Number(authorRaw) : null,
        affiliateRatePct: affiliateRaw ? Number(affiliateRaw) : null,
        holdDays: holdRaw ? Number(holdRaw) : null,
        reason: String(fd.get("reason") || ""),
      });
      setMessage("Regla financiera del libro actualizada.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error financiero del libro.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold">{message}</div> : null}

      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-5 xl:grid-cols-2">
            <form
              onSubmit={(event) => updateBook(event, row)}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <p className="font-black text-slate-950">Ficha comercial</p>
              <input
                name="title"
                defaultValue={row.title}
                required
                className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                name="slug"
                defaultValue={row.slug}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  name="status"
                  defaultValue={row.status}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="draft">Borrador</option>
                  <option value="under_review">En revisión</option>
                  <option value="published">Publicado</option>
                </select>
                <input
                  name="paypalPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={Number(row.paypal_price ?? 0) || ""}
                  placeholder="Precio PayPal USD"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <input
                name="reason"
                required
                placeholder="Motivo"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <button
                disabled={busy !== null}
                className="mt-3 rounded-xl bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Guardar libro
              </button>
            </form>

            <form
              onSubmit={(event) => updateFinance(event, row)}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
            >
              <p className="font-black text-emerald-950">Reglas financieras del libro</p>
              <p className="mt-1 text-xs text-emerald-800">
                Vacío = usar configuración global.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input
                  name="authorRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={
                    row.financeRule?.author_rate == null
                      ? ""
                      : (Number(row.financeRule.author_rate) * 100).toFixed(2)
                  }
                  placeholder="Autor %"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2"
                />
                <input
                  name="affiliateRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={
                    row.financeRule?.affiliate_rate == null
                      ? ""
                      : (Number(row.financeRule.affiliate_rate) * 100).toFixed(2)
                  }
                  placeholder="Afiliado %"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2"
                />
                <input
                  name="holdDays"
                  type="number"
                  min="0"
                  max="180"
                  defaultValue={row.financeRule?.hold_days ?? ""}
                  placeholder="Hold días"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2"
                />
              </div>
              <input
                name="reason"
                required
                placeholder="Motivo"
                className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
              />
              <button
                disabled={busy !== null}
                className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Guardar reglas
              </button>
            </form>
          </div>

          <p className="mt-3 break-all text-xs text-slate-400">
            Libro {row.id} · propietario {row.owner_user_id}
          </p>
        </article>
      ))}
    </div>
  );
}
