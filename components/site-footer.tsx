import Link from "next/link";
import {
  BookOpenText,
  CreditCard,
  Library,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

const exploreLinks = [
  { href: "/catalog", label: "Explorar catálogo" },
  { href: "/categories", label: "Categorías" },
  { href: "/dashboard", label: "Mi biblioteca" },
  { href: "/auth", label: "Iniciar sesión" },
];

const creatorLinks = [
  { href: "/publish", label: "Publicar un libro" },
  { href: "/affiliates", label: "Programa de afiliados" },
  { href: "/dashboard/books/published", label: "Libros publicados" },
];

const trustItems = [
  { icon: CreditCard, label: "Pago protegido" },
  { icon: LockKeyhole, label: "Archivos privados" },
  { icon: Library, label: "Biblioteca digital" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 overflow-hidden bg-[#07111f] text-white">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0d2f56] via-[#155eef] to-[#0b79a7]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8">
          {trustItems.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-3 text-sm font-bold">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.7fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="BestSeller, inicio">
            <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-[#2b78ff] to-[#13b8e8] shadow-[0_16px_35px_rgba(21,94,239,0.28)]">
              <BookOpenText className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">
                Best<span className="text-[#4bd3ff]">Seller</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                Plataforma editorial
              </span>
            </span>
          </Link>

          <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400">
            Un ecosistema comercial para descubrir, publicar, comprar y leer
            libros digitales con una experiencia moderna y segura.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Compra segura y acceso protegido
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#4bd3ff]">
            Explorar
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            {exploreLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#4bd3ff]">
            Creadores
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            {creatorLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-500">
        © 2026 BestSeller · Historias que encuentran lectores.
      </div>
    </footer>
  );
}
