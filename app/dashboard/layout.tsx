import Link from "next/link";
import React from "react";
import { getAdminAccess } from "@/lib/admin-access";

const dashboardLinks = [
  {
    href: "/dashboard",
    label: "Resumen",
    description: "Vista general",
  },
  {
    href: "/dashboard/books/new",
    label: "Nuevo libro",
    description: "Crear ficha editorial",
  },
  {
    href: "/dashboard/books/published",
    label: "Libros publicados",
    description: "Inventario activo",
  },
  {
    href: "/dashboard/books/purchased",
    label: "Libros comprados",
    description: "Tu biblioteca de lectura",
  },
  {
    href: "/categories",
    label: "Categorías",
    description: "Vista pública",
  },
  {
    href: "/catalog",
    label: "Catálogo",
    description: "Tienda pública",
  },
  {
    href: "/publish",
    label: "Publica",
    description: "Tutorial editorial",
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAdminAccess();
  const visibleLinks = access.isAdmin
    ? dashboardLinks.flatMap((item) =>
        item.href === "/dashboard/books/purchased"
          ? [
              item,
              {
                href: "/dashboard/purchases",
                label: "Registro de compras",
                description: "Compras activas por usuario",
              },
              {
                href: "/dashboard/ai-growth",
                label: "Agente CEO/SEO",
                description: "Crecimiento y contenido diario",
              },
            ]
          : [item]
      )
    : dashboardLinks;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Panel editorial
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Administra libros, categorías, catálogo público, publicaciones y
          métricas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            Navegación
          </p>

          <nav className="space-y-2">
            {visibleLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group block rounded-2xl px-3 py-3 transition hover:bg-slate-100"
              >
                <span className="block text-sm font-semibold text-slate-800 group-hover:text-slate-950">
                  {item.label}
                </span>

                <span className="mt-0.5 block text-xs text-slate-500">
                  {item.description}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {children}
        </main>
      </div>
    </section>
  );
}
