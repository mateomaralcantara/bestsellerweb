import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminRolePage } from "@/lib/admin/superadmin";

const links = [
  ["/admin", "Centro de mando", "Resumen ejecutivo"],
  ["/admin/users", "Usuarios", "Identidad, roles y bloqueos"],
  ["/admin/finance", "Finanzas", "Tasas, beneficios y ajustes"],
  ["/admin/affiliates", "Afiliados", "Aprobación, códigos y comisión"],
  ["/admin/authors", "Autores", "Aprobación y suspensión"],
  ["/admin/books", "Libros", "Precio, estado y reglas"],
  ["/admin/purchases", "Compras", "Ventas y reembolsos"],
  ["/admin/payouts", "Retiros", "Procesar y cerrar pagos"],
  ["/admin/ledger", "Ledger", "Libro mayor financiero"],
  ["/admin/audit", "Auditoría", "Historial inmutable"],
  ["/admin/security", "Seguridad", "Permisos administrativos"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await requireAdminRolePage();

  return (
    <section className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            LibroSeller SUPERADMIN
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Control Center</h1>
              <p className="mt-1 text-sm text-slate-300">
                Gobierno financiero, usuarios, contenido, pagos y seguridad.
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Administrador activo</p>
              <p className="mt-1 font-bold text-white">{actor.email || actor.id}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-3">
            <nav className="space-y-1.5">
              {links.map(([href, label, description]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-2xl px-4 py-3 text-white transition hover:bg-white/10"
                >
                  <span className="block text-sm font-black">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {description}
                  </span>
                </Link>
              ))}
            </nav>
            <Link
              href="/dashboard"
              className="mt-4 block rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
            >
              ← Volver al dashboard
            </Link>
          </aside>

          <main className="min-w-0 rounded-3xl bg-slate-50 p-5 sm:p-7">
            {children}
          </main>
        </div>
      </div>
    </section>
  );
}
