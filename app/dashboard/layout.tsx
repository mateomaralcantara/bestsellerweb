import Link from "next/link";
import React from "react";
import {
  BadgeDollarSign,
  BookMarked,
  BookOpenCheck,
  BookPlus,
  ChartNoAxesCombined,
  CircleUserRound,
  FolderKanban,
  LayoutDashboard,
  LibraryBig,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  WalletCards,
} from "lucide-react";
import { getAdminAccess } from "@/lib/admin-access";

const dashboardLinks = [
  {
    href: "/dashboard",
    label: "Resumen",
    description: "Vista general",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/finance",
    label: "Finanzas",
    description: "Ganancias, saldo y retiros",
    icon: WalletCards,
  },
  {
    href: "/dashboard/buyer",
    label: "Comprador",
    description: "Compras, créditos y reembolsos",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/author",
    label: "Autor",
    description: "Ventas y regalías",
    icon: BookOpenCheck,
  },
  {
    href: "/dashboard/affiliate",
    label: "Afiliado-vendedor",
    description: "Comisiones y conversiones",
    icon: Megaphone,
  },
  {
    href: "/dashboard/books/new",
    label: "Nuevo libro",
    description: "Crear ficha editorial",
    icon: BookPlus,
  },
  {
    href: "/dashboard/books/published",
    label: "Libros publicados",
    description: "Inventario activo",
    icon: BookMarked,
  },
  {
    href: "/dashboard/books/purchased",
    label: "Libros comprados",
    description: "Tu biblioteca de lectura",
    icon: LibraryBig,
  },
  {
    href: "/categories",
    label: "Categorías",
    description: "Explorar organización",
    icon: Tags,
  },
  {
    href: "/catalog",
    label: "Catálogo",
    description: "Tienda pública",
    icon: Store,
  },
  {
    href: "/publish",
    label: "Publica",
    description: "Centro editorial",
    icon: Sparkles,
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
                icon: FolderKanban,
              },
            ]
          : [item]
      )
    : dashboardLinks;

  const linksForRender = access.isAdmin
    ? [
        {
          href: "/admin",
          label: "SUPERADMIN",
          description: "Control total de LibroSeller",
          icon: ShieldCheck,
        },
        ...visibleLinks,
      ]
    : visibleLinks;

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.08),_transparent_24%),linear-gradient(to_bottom,_#f8fafc,_#f1f5f9)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 overflow-hidden rounded-[32px] border border-white/80 bg-white/80 px-5 py-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                <ChartNoAxesCombined className="h-6 w-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                    LibroSeller Studio
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Live
                  </span>
                </div>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Tu centro de crecimiento
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <CircleUserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Panel personal
                </p>
                <p className="text-sm font-black text-slate-800">
                  Publica · Vende · Gana
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-[30px] border border-slate-800/80 bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#111827_100%)] p-3 shadow-[0_28px_80px_-42px_rgba(2,6,23,0.85)] lg:sticky lg:top-6">
            <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-sky-400/10 blur-2xl" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
                  <BadgeDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Dashboard
                  </p>
                  <p className="text-sm font-black text-white">
                    Money & Publishing
                  </p>
                </div>
              </div>
            </div>

            <nav className="mt-3 space-y-1.5">
              {linksForRender.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300 transition group-hover:border-emerald-400/30 group-hover:bg-emerald-400/10 group-hover:text-emerald-300">
                      <Icon className="h-4.5 w-4.5" />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-100 transition group-hover:text-white">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 transition group-hover:text-slate-400">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.16em]">
                  Growth mode
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Sigue tus ventas, regalías, comisiones y retiros desde un solo
                panel.
              </p>
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden rounded-[32px] border border-white/80 bg-white/85 p-4 shadow-[0_30px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6 lg:p-7">
            {children}
          </main>
        </div>
      </div>
    </section>
  );
}
