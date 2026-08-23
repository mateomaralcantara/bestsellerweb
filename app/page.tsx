import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  CreditCard,
  Library,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getFeaturedBooks } from "@/lib/queries";
import { SectionHeading } from "@/components/section-heading";
import { BookCard } from "@/components/book-card";

const benefits = [
  {
    icon: BookOpenText,
    title: "Experiencia editorial premium",
    description:
      "Fichas comerciales, vista previa de 25 páginas y lector privado con progreso automático.",
  },
  {
    icon: CreditCard,
    title: "Compra segura con PayPal",
    description:
      "El precio se valida en el servidor y el acceso se activa cuando el pago queda confirmado.",
  },
  {
    icon: BarChart3,
    title: "Sistema preparado para crecer",
    description:
      "Publicación, catálogo, afiliados y biblioteca digital dentro de una sola plataforma.",
  },
];

const steps = [
  ["01", "Descubre", "Explora títulos por categoría y revisa una muestra antes de comprar."],
  ["02", "Compra", "Paga de manera protegida mediante PayPal, sin compartir datos con BestSeller."],
  ["03", "Lee", "Abre el libro en tu biblioteca y continúa siempre desde tu última página."],
];

const trustItems = [
  { icon: ShieldCheck, label: "Compra protegida por PayPal" },
  { icon: Library, label: "Acceso desde tu biblioteca" },
  { icon: Users, label: "Autores y lectores en un mismo lugar" },
];

function formatPrice(price?: number | null, currency?: string | null) {
  if (typeof price !== "number") return null;

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency || "USD"} ${price.toFixed(2)}`;
  }
}

export default async function HomePage() {
  const books = await getFeaturedBooks();
  const heroBook = books[0] ?? null;
  const heroPrice = heroBook
    ? formatPrice(heroBook.price, heroBook.currency)
    : null;

  return (
    <div>
      <section className="commercial-dark commercial-grid commercial-shine relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 top-8 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              El marketplace editorial dominicano
            </div>

            <h1 className="mt-7 max-w-4xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Historias que se ven bien,
              <span className="block bg-gradient-to-r from-[#6be1ff] via-[#60a5fa] to-[#ffcf68] bg-clip-text text-transparent">
                se venden mejor.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Descubre nuevos autores, compra con seguridad y lee desde
              cualquier dispositivo. Si escribes, aquí también tienes la
              vitrina para publicar y crecer.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/catalog"
                className="premium-button bg-[#155eef] text-white hover:bg-[#2b78ff]"
              >
                Explorar libros
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/publish"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur hover:-translate-y-0.5 hover:bg-white/15"
              >
                <Rocket className="h-4 w-4" />
                Publicar mi libro
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-300">
              {[
                "Pago protegido",
                "Preview de 25 páginas",
                "Lectura con progreso",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px] lg:ml-auto">
            <div className="absolute -left-4 top-20 h-[390px] w-[245px] rotate-[-9deg] rounded-[26px] border border-white/10 bg-gradient-to-br from-[#153a67] to-[#081526] opacity-80 shadow-2xl" />
            <div className="absolute -right-3 top-12 h-[420px] w-[265px] rotate-[8deg] rounded-[26px] border border-white/10 bg-gradient-to-br from-[#155eef] to-[#07111f] opacity-80 shadow-2xl" />

            <div className="animate-float-book relative z-10 mx-auto overflow-hidden rounded-[30px] border border-white/15 bg-white/10 p-5 shadow-[0_45px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  <BadgeCheck className="h-4 w-4" />
                  Selección destacada
                </span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                  Disponible
                </span>
              </div>

              <div className="mt-6 grid grid-cols-[135px_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[175px_minmax(0,1fr)]">
                {heroBook?.cover_url ? (
                  <Image
                    src={heroBook.cover_url}
                    alt={heroBook.title}
                    className="book-cover-shadow aspect-[2/3] w-full rounded-r-xl rounded-l-sm object-cover"

              width={600}
              height={900}
              sizes="(max-width: 768px) 50vw, 240px"/>
                ) : (
                  <div className="book-cover-shadow flex aspect-[2/3] w-full flex-col justify-between rounded-r-xl rounded-l-sm bg-gradient-to-br from-[#155eef] to-[#07111f] p-5 ring-1 ring-white/20">
                    <BookOpenText className="h-8 w-8 text-cyan-200" />
                    <p className="text-lg font-black leading-tight text-white">
                      Tu próximo gran libro
                    </p>
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                    Lectura digital
                  </p>
                  <h2 className="mt-3 line-clamp-4 text-2xl font-black leading-tight text-white">
                    {heroBook?.title || "Descubre historias que dejan huella"}
                  </h2>
                  {heroBook?.subtitle ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                      {heroBook.subtitle}
                    </p>
                  ) : null}
                  {heroPrice ? (
                    <p className="mt-5 text-2xl font-black text-[#ffcf68]">
                      {heroPrice}
                    </p>
                  ) : null}
                  <Link
                    href={heroBook ? `/catalog/${heroBook.slug}` : "/catalog"}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#07111f] hover:-translate-y-0.5"
                  >
                    Ver libro
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-sm font-bold text-slate-700 sm:grid-cols-3 sm:px-6 lg:px-8">
          {trustItems.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center justify-center gap-3 rounded-2xl px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#155eef]">
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Catálogo destacado"
            title="Libros preparados para llamar la atención"
            description="Descubre títulos con ficha completa, muestra disponible y compra protegida."
          />
          <Link
            href="/catalog"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#07111f] shadow-sm hover:-translate-y-0.5 hover:border-blue-300"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {books.length > 0 ? (
          <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="commercial-card mt-12 rounded-[32px] p-10 text-center">
            <BookOpenText className="mx-auto h-12 w-12 text-blue-500" />
            <h3 className="mt-5 text-2xl font-black text-[#07111f]">
              El próximo libro destacado puede ser el tuyo
            </h3>
            <Link href="/publish" className="premium-button mt-6 bg-[#155eef] text-white">
              Comenzar publicación
            </Link>
          </div>
        )}
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Todo conectado"
            title="Una experiencia seria para cada lado del libro"
            description="Diseñada para que el lector confíe, el autor destaque y la compra avance sin fricción."
            align="center"
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className={`rounded-[30px] p-7 ${
                  index === 1
                    ? "commercial-dark shadow-[0_28px_70px_rgba(7,17,31,0.2)]"
                    : "commercial-card"
                }`}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    index === 1
                      ? "bg-white/10 text-cyan-200 ring-1 ring-white/15"
                      : "bg-blue-50 text-[#155eef]"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className={`mt-6 text-2xl font-black ${index === 1 ? "text-white" : "text-[#07111f]"}`}>
                  {title}
                </h3>
                <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-slate-300" : "text-slate-600"}`}>
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeading
            eyebrow="Simple y seguro"
            title="De descubrir a leer, sin vueltas raras"
            description="Cada paso está pensado para transmitir claridad, confianza y control."
          />

          <div className="grid gap-4">
            {steps.map(([number, title, description]) => (
              <article key={number} className="commercial-card grid gap-4 rounded-[26px] p-5 sm:grid-cols-[70px_1fr] sm:items-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07111f] text-sm font-black text-cyan-300">
                  {number}
                </span>
                <div>
                  <h3 className="text-xl font-black text-[#07111f]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="commercial-dark commercial-shine overflow-hidden rounded-[38px] px-6 py-12 shadow-[0_35px_90px_rgba(7,17,31,0.24)] sm:px-10 lg:px-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                Tu historia merece vitrina
              </p>
              <h2 className="mt-4 max-w-3xl text-balance text-3xl font-black tracking-tight text-white sm:text-4xl">
                Publica con presencia profesional desde el primer día.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                Crea tu ficha, configura el precio, presenta una muestra y
                empieza a construir audiencia.
              </p>
            </div>
            <Link href="/publish" className="premium-button bg-[#ffbf3f] text-[#07111f] hover:bg-[#ffcf68]">
              Publicar ahora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
