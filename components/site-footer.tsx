import Link from "next/link";

const productLinks = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/categories", label: "Categorías" },
  { href: "/publish", label: "Publica" },
  { href: "/affiliates", label: "Afiliados" },
  { href: "/dashboard", label: "Dashboard" },
];

const legalLinks = [
  { href: "/auth", label: "Acceso" },
  { href: "#", label: "Privacidad" },
  { href: "#", label: "Términos" },
  { href: "#", label: "Licencias digitales" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4 lg:col-span-2">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 to-accent-600 font-black text-white shadow-glow">
              B
            </div>

            <div>
              <p className="font-display text-lg font-bold text-brand-800">
                BestSeller
              </p>
              <p className="text-sm text-slate-500">
                El ecosistema editorial para publicar, vender y escalar libros.
              </p>
            </div>
          </Link>

          <p className="max-w-xl text-sm leading-7 text-slate-700">
            Plataforma lista para autores, lectores y afiliados. Diseñada para
            libro impreso, eBook, lectura en nube, catálogo categorizado y
            distribución externa.
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-accent-700">
            Producto
          </h4>

          <ul className="space-y-3 text-sm text-slate-700">
            {productLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-accent-700">
            Legal
          </h4>

          <ul className="space-y-3 text-sm text-slate-700">
            {legalLinks.map((item) => (
              <li key={item.label}>
                {item.href === "#" ? (
                  <span className="text-slate-500">{item.label}</span>
                ) : (
                  <Link
                    href={item.href}
                    className="transition hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500">
        © 2026 BestSeller. Diseño limpio, contraste duro y foco en vender.
      </div>
    </footer>
  );
}