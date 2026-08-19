"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  Menu,
  ShieldCheck,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart-provider";
import { isImmersiveReaderRoute } from "@/lib/immersive-reader-route";

const nav = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/categories", label: "Categorías" },
  { href: "/publish", label: "Publicar" },
  { href: "/affiliates", label: "Afiliados" },
  { href: "/dashboard", label: "Mi biblioteca" },
];

function isActivePath(pathname: string | null, href: string) {
  const safePathname = pathname || "/";
  return safePathname === href || safePathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { itemCount } = useCart();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isImmersiveReaderRoute(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/95 text-white shadow-[0_12px_45px_rgba(2,8,23,0.18)] backdrop-blur-xl">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#155eef] via-[#0b70d8] to-[#13a8d8]">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-center text-[11px] font-bold tracking-wide text-white sm:text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          Compra protegida con PayPal · Acceso digital después del pago
        </div>
      </div>

      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="BestSeller, inicio">
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[15px] bg-gradient-to-br from-[#2b78ff] via-[#155eef] to-[#13b8e8] shadow-[0_12px_28px_rgba(21,94,239,0.38)] ring-1 ring-white/20">
            <BookOpenText className="h-5 w-5 text-white" />
            <span className="absolute inset-x-2 bottom-1 h-px bg-white/45" />
          </span>

          <span>
            <span className="block text-lg font-black leading-none tracking-tight text-white">
              Best<span className="text-[#4bd3ff]">Seller</span>
            </span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Publica · vende · crece
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {nav.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-semibold",
                  active
                    ? "bg-white text-[#07111f] shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/auth"
            className="rounded-full px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10 hover:text-white"
          >
            Entrar
          </Link>

          <Link
            href="/publish"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#07111f] shadow-lg hover:-translate-y-0.5"
          >
            Publicar libro
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/checkout"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:border-[#4bd3ff]/60 hover:bg-white/15"
            aria-label={`Carrito con ${itemCount} artículos`}
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffbf3f] px-1 text-[10px] font-black text-[#07111f] ring-2 ring-[#07111f]">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/10 bg-[#07111f] md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <nav className="mx-auto grid max-w-7xl gap-2 px-4 py-4" aria-label="Navegación móvil">
          {nav.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm font-bold",
                  active
                    ? "border-[#4bd3ff]/40 bg-[#155eef] text-white"
                    : "border-white/10 bg-white/5 text-slate-200"
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="mt-1 grid grid-cols-2 gap-2">
            <Link
              href="/auth"
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white"
            >
              Entrar
            </Link>
            <Link
              href="/checkout"
              className="rounded-2xl bg-[#ffbf3f] px-4 py-3 text-center text-sm font-black text-[#07111f]"
            >
              Carrito ({itemCount})
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
