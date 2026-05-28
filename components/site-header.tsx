"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart-provider";

const nav = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/categories", label: "Categorías" },
  { href: "/publish", label: "Publica" },
  { href: "/affiliates", label: "Afiliados" },
  { href: "/dashboard", label: "Dashboard" },
];

function isActivePath(pathname: string | null, href: string) {
  const safePathname = pathname || "/";

  if (href === "/") {
    return safePathname === "/";
  }

  return safePathname === href || safePathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 to-accent-600 text-lg font-black text-white shadow-glow">
            B
          </div>

          <div>
            <p className="font-display text-lg font-bold text-brand-800">
              BestSeller
            </p>
            <p className="text-xs text-slate-500">
              Publica · vende · escala
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 text-sm text-slate-700 md:flex">
          {nav.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-100 hover:text-brand-700"
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/auth"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
          >
            Entrar
          </Link>

          <Link
            href="/checkout"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 transition hover:border-brand-200 hover:text-brand-700"
            aria-label="Checkout"
          >
            <ShoppingBag className="h-4 w-4" />

            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-slate-200 md:hidden",
          open ? "block" : "hidden"
        )}
      >
        <div className="space-y-2 px-4 py-4">
          {nav.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-2xl border px-4 py-3 text-sm font-medium",
                  active
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-800"
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/auth"
            onClick={() => setOpen(false)}
            className="block rounded-2xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Entrar
          </Link>

          <Link
            href="/checkout"
            onClick={() => setOpen(false)}
            className="block rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700"
          >
            Checkout ({itemCount})
          </Link>
        </div>
      </div>
    </header>
  );
}