"use client";

import { FormEvent, useState } from "react";

type AuthorProfile = {
  id: string;
  user_id: string | null;
  slug: string | null;
  display_name: string | null;
  pen_name: string | null;
  approval_status: string | null;
  rejection_reason: string | null;
} | null;

type AffiliateProfile = {
  id: string;
  display_name: string | null;
  handle: string | null;
  referral_code: string | null;
  code: string | null;
  commission_rate: number | string | null;
  status: string | null;
} | null;

async function post360(
  userId: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(
    `/api/admin/users/${encodeURIComponent(userId)}/control`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "No se pudo aplicar el cambio.");
  }
}

export default function AdminUserProfilesClient({
  userId,
  author,
  affiliate,
  fallbackName,
}: {
  userId: string;
  author: AuthorProfile;
  affiliate: AffiliateProfile;
  fallbackName: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    key: string,
    payload: Record<string, unknown>
  ) {
    setBusy(key);
    setMessage(null);

    try {
      await post360(userId, payload);
      setMessage("Perfil actualizado y auditado.");
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Error administrativo."
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveAuthor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await run("author", {
      action: "author.profile.upsert",
      displayName: String(fd.get("displayName") || ""),
      penName: String(fd.get("penName") || ""),
      slug: String(fd.get("slug") || ""),
      status: String(fd.get("status") || "pending"),
      rejectionReason: String(fd.get("rejectionReason") || ""),
      reason: String(fd.get("reason") || ""),
    });
  }

  async function saveAffiliate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    await run("affiliate", {
      action: "affiliate.profile.upsert",
      displayName: String(fd.get("displayName") || ""),
      handle: String(fd.get("handle") || ""),
      referralCode: String(fd.get("referralCode") || ""),
      commissionRatePct: Number(fd.get("commissionRatePct")),
      status: String(fd.get("status") || "pending"),
      reason: String(fd.get("reason") || ""),
    });
  }

  const defaultSlug = fallbackName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <form
          onSubmit={saveAuthor}
          className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5"
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
            AUTOR · SOLO ESTE USUARIO
          </p>
          <h3 className="mt-2 text-xl font-black text-indigo-950">
            {author ? "Modificar perfil de autor" : "Crear perfil de autor"}
          </h3>

          <input
            name="displayName"
            required
            defaultValue={author?.display_name || fallbackName}
            placeholder="Nombre público"
            className="mt-4 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          />

          <input
            name="penName"
            defaultValue={author?.pen_name || ""}
            placeholder="Seudónimo"
            className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          />

          <input
            name="slug"
            required
            defaultValue={author?.slug || defaultSlug}
            placeholder="slug-del-autor"
            className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          />

          <select
            name="status"
            defaultValue={author?.approval_status || "approved"}
            className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          >
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
            <option value="suspended">Suspendido</option>
          </select>

          <input
            name="rejectionReason"
            defaultValue={author?.rejection_reason || ""}
            placeholder="Razón de rechazo/suspensión"
            className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          />

          <input
            name="reason"
            required
            minLength={3}
            placeholder="Motivo administrativo"
            className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
          />

          <button
            disabled={busy !== null}
            className="mt-3 rounded-xl bg-indigo-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            GUARDAR AUTOR
          </button>
        </form>

        <form
          onSubmit={saveAffiliate}
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            AFILIADO · SOLO ESTE USUARIO
          </p>
          <h3 className="mt-2 text-xl font-black text-emerald-950">
            {affiliate
              ? "Modificar perfil de afiliado"
              : "Crear perfil de afiliado"}
          </h3>

          <input
            name="displayName"
            defaultValue={affiliate?.display_name || fallbackName}
            placeholder="Nombre visible"
            className="mt-4 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          />

          <input
            name="handle"
            defaultValue={affiliate?.handle || ""}
            placeholder="Handle"
            className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          />

          <input
            name="referralCode"
            required
            defaultValue={
              affiliate?.referral_code ||
              affiliate?.code ||
              `AFF-${userId.slice(0, 8).toUpperCase()}`
            }
            placeholder="Código de afiliado"
            className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          />

          <input
            name="commissionRatePct"
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            defaultValue={Number(affiliate?.commission_rate ?? 10)}
            placeholder="Comisión %"
            className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          />

          <select
            name="status"
            defaultValue={affiliate?.status || "approved"}
            className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          >
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
          </select>

          <input
            name="reason"
            required
            minLength={3}
            placeholder="Motivo administrativo"
            className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
          />

          <button
            disabled={busy !== null}
            className="mt-3 rounded-xl bg-emerald-700 px-5 py-2.5 font-black text-white disabled:opacity-50"
          >
            GUARDAR AFILIADO
          </button>
        </form>
      </div>
    </div>
  );
}
