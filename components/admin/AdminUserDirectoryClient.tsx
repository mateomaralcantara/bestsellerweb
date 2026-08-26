"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { AdminUserRow } from "@/lib/admin/admin-data";

type CreateResponse = {
  ok?: boolean;
  error?: string;
  userId?: string;
};

async function postCreate(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/users/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as CreateResponse | null;

  if (!response.ok || !data?.ok || !data.userId) {
    throw new Error(data?.error || "No se pudo crear el usuario.");
  }

  return data.userId;
}

async function postInitialFinance(
  userId: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(
    `/api/admin/users/${encodeURIComponent(userId)}/control`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finance.summary.set",
        ...payload,
      }),
    }
  );

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
        "El usuario fue creado, pero no se pudieron asignar los montos iniciales."
    );
  }
}

function numeric(fd: FormData, name: string) {
  const value = Number(fd.get(name) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function AdminUserDirectoryClient({
  rows,
}: {
  rows: AdminUserRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
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

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    setCreating(true);
    setMessage(null);

    try {
      const roles = ["author", "affiliate", "admin"].filter(
        (role) => fd.get(`role_${role}`) === "on"
      );

      const reason = String(fd.get("reason") || "");
      const currency = String(fd.get("currency") || "USD");

      const userId = await postCreate({
        fullName: String(fd.get("fullName") || ""),
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        emailConfirm: fd.get("emailConfirm") === "on",
        roles,
        purchaseBlocked: fd.get("purchaseBlocked") === "on",
        payoutBlocked: fd.get("payoutBlocked") === "on",
        reason,
      });

      const finance = {
        currency,
        benefitsTotal: numeric(fd, "benefitsTotal"),
        availableToWithdraw: numeric(fd, "availableToWithdraw"),
        pendingEarnings: numeric(fd, "pendingEarnings"),
        authorEarningsTotal: numeric(fd, "authorEarningsTotal"),
        affiliateEarningsTotal: numeric(fd, "affiliateEarningsTotal"),
        paidOutTotal: numeric(fd, "paidOutTotal"),
        reason: `Montos iniciales al crear usuario: ${reason}`,
      };

      const hasFinance = [
        finance.benefitsTotal,
        finance.availableToWithdraw,
        finance.pendingEarnings,
        finance.authorEarningsTotal,
        finance.affiliateEarningsTotal,
        finance.paidOutTotal,
      ].some((value) => value > 0);

      if (hasFinance) {
        try {
          await postInitialFinance(userId, finance);
        } catch (error) {
          setMessage(
            `${
              error instanceof Error
                ? error.message
                : "No se pudieron asignar montos iniciales."
            } Abriendo CONTROL 360 para completar la cuenta.`
          );

          window.setTimeout(() => {
            router.push(`/admin/users/${userId}`);
          }, 1800);

          return;
        }
      }

      router.push(`/admin/users/${userId}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Error creando usuario."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={createUser}
        className="rounded-[32px] border-2 border-indigo-200 bg-indigo-50 p-5 sm:p-6"
      >
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-700">
          SUPERADMIN · ALTA COMPLETA
        </p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">
          Crear usuario nuevo
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Crea la cuenta, asigna roles, bloqueos y montos iniciales. Al terminar
          se abre automáticamente la ficha exclusiva CONTROL 360 de ese usuario.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold text-slate-700">
            Nombre completo
            <input
              name="fullName"
              required
              className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
              placeholder="Nombre del usuario"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Correo
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
              placeholder="usuario@correo.com"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Contraseña temporal
            <input
              name="password"
              type="password"
              minLength={10}
              required
              className="mt-2 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
              placeholder="Mínimo 10 caracteres"
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4">
          <p className="font-black text-slate-950">Roles y estado inicial</p>
          <p className="mt-1 text-xs text-slate-500">
            Toda cuenta funciona como comprador. Agrega roles especiales cuando
            corresponda; los perfiles de autor/afiliado se completan dentro de
            su CONTROL 360.
          </p>

          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input name="role_author" type="checkbox" />
              Autor
            </label>
            <label className="flex items-center gap-2">
              <input name="role_affiliate" type="checkbox" />
              Afiliado
            </label>
            <label className="flex items-center gap-2">
              <input name="role_admin" type="checkbox" />
              Administrador
            </label>
            <label className="flex items-center gap-2">
              <input name="emailConfirm" type="checkbox" defaultChecked />
              Correo confirmado
            </label>
            <label className="flex items-center gap-2">
              <input name="purchaseBlocked" type="checkbox" />
              Bloquear compras
            </label>
            <label className="flex items-center gap-2">
              <input name="payoutBlocked" type="checkbox" />
              Bloquear retiros
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-emerald-950">
                Montos financieros iniciales
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Déjalos en 0.00 si la cuenta debe comenzar sin movimientos.
              </p>
            </div>

            <select
              name="currency"
              defaultValue="USD"
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold"
            >
              <option value="USD">USD</option>
              <option value="DOP">DOP</option>
            </select>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["benefitsTotal", "Beneficios acumulados"],
              ["availableToWithdraw", "Disponible para retirar"],
              ["pendingEarnings", "Ganancias pendientes"],
              ["authorEarningsTotal", "Regalías de autor"],
              ["affiliateEarningsTotal", "Comisiones de afiliado"],
              ["paidOutTotal", "Total retirado"],
            ].map(([name, label]) => (
              <label key={name} className="text-sm font-bold text-slate-700">
                {label}
                <input
                  name={name}
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  defaultValue="0.00"
                  required
                  className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
                />
              </label>
            ))}
          </div>
        </div>

        <input
          name="reason"
          required
          minLength={5}
          placeholder="Motivo administrativo de creación"
          className="mt-4 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2"
        />

        <button
          disabled={creating}
          className="mt-4 rounded-xl bg-indigo-700 px-6 py-3 font-black text-white disabled:opacity-50"
        >
          {creating ? "Creando usuario..." : "CREAR USUARIO Y ABRIR CONTROL 360"}
        </button>
      </form>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          {message}
        </div>
      ) : null}

      <section>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar usuario por nombre, correo, UUID o rol..."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
          />
        </div>

        <div className="mt-4 grid gap-3">
          {filtered.map((row) => (
            <Link
              key={row.id}
              href={`/admin/users/${row.id}`}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-950 group-hover:text-violet-800">
                    {row.fullName || row.email || "Usuario"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.email || "Sin correo"}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    {row.id}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-700">
                      comprador
                    </span>

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
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
                        ACTIVO
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-black text-white">
                  ABRIR TODO DEL USUARIO →
                </div>
              </div>
            </Link>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No hay usuarios que coincidan con la búsqueda.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
