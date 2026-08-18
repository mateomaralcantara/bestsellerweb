import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  Search,
  ShieldCheck,
  Tags,
  Target,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import { SectionHeading } from "@/components/section-heading";

const publishFeatures = [
  {
    icon: Tags,
    title: "Metadata tipo marketplace",
    text: "Nicho, categoría, subcategoría, keywords, idioma y formato para posicionar mejor el libro.",
  },
  {
    icon: Target,
    title: "Audiencia clara",
    text: "Defines para quién es el libro y qué promesa concreta recibe el lector.",
  },
  {
    icon: Search,
    title: "Descubribilidad",
    text: "La metadata alimenta filtros, búsqueda interna, catálogo, SEO y campañas.",
  },
  {
    icon: TrendingUp,
    title: "Lanzamiento comercial",
    text: "Precio, gancho de venta, comparables, afiliados y estrategia desde el inicio.",
  },
];

const tutorialSteps = [
  {
    icon: FileText,
    title: "1. Completa la ficha editorial",
    text: "Agrega título, subtítulo, descripción, nicho, categoría, palabras clave, precio y promesa del libro.",
  },
  {
    icon: UploadCloud,
    title: "2. Sube portada y archivo",
    text: "Carga la portada y el PDF/EPUB completo. El archivo del libro queda protegido.",
  },
  {
    icon: ShieldCheck,
    title: "3. Envíalo a evaluación",
    text: "El libro queda como borrador o en revisión. No sale publicado directo al catálogo.",
  },
  {
    icon: CheckCircle2,
    title: "4. Aprobación y publicación",
    text: "Cuando el libro esté aprobado, se publica en catálogo y se activa compra/lectura.",
  },
];

const checklist = [
  "Título, subtítulo y autor.",
  "Nicho, categoría y subcategoría.",
  "Palabras clave estilo Amazon/KDP.",
  "Descripción corta y descripción larga.",
  "Audiencia objetivo y promesa al lector.",
  "Precio, moneda y formato.",
  "Portada y archivo PDF/EPUB.",
  "Estado editorial: borrador, evaluación o publicado.",
];

function StatusCard({
  allowed,
  message,
}: {
  allowed: boolean;
  message: string;
}) {
  if (allowed) {
    return (
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-bold">Tu sección de autor está aprobada.</p>
            <p>{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
      <div className="flex gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-bold">Todavía no puedes publicar.</p>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

function MainAction({
  allowed,
}: {
  allowed: boolean;
}) {
  if (allowed) {
    return (
      <Link
        href="/dashboard/books/new"
        className="premium-button bg-[#155eef] text-white"
      >
        Crear nuevo libro
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="premium-button bg-[#155eef] text-white"
    >
      Ir al dashboard
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default async function PublishPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/auth?next=${encodeURIComponent("/publish")}`);
  }

  const access = await getAuthorPublishingAccess(user.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-8">
          <SectionHeading
            eyebrow="Publicar"
            title="Convierte tu manuscrito en una vitrina profesional."
            description="Prepara la ficha editorial, los archivos y la estrategia comercial de tu libro dentro de un flujo guiado y sujeto a revisión."
          />

          <StatusCard allowed={access.allowed} message={access.message} />

          <div className="grid gap-4 sm:grid-cols-2">
            {publishFeatures.map(({ icon: Icon, title, text }, index) => {
              const cardClassName =
                index === 0
                  ? "editorial-special rounded-[28px] p-5"
                  : "commercial-card rounded-[28px] p-5";

              return (
                <div key={title} className={cardClassName}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-brand-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-brand-800">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {text}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="commercial-card rounded-[28px] p-6">
            <h2 className="text-lg font-bold text-brand-800">
              Antes de empezar, ten listo
            </h2>

            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="commercial-dark commercial-shine overflow-hidden rounded-[34px] border border-white/10 p-6 shadow-[0_32px_80px_rgba(7,17,31,0.22)] sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
              Ruta de publicación
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Cómo funciona el flujo editorial
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-300">
              Creas una sola ficha, envías el libro a evaluación y recibes el
              estado editorial antes de que aparezca en el catálogo público.
            </p>

            <div className="mt-6 space-y-4">
              {tutorialSteps.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-200 ring-1 ring-white/15">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-bold text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <MainAction allowed={access.allowed} />

              <Link
                href="/dashboard/books/published"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/15"
              >
                Ver mis libros
              </Link>
            </div>
          </div>

          <div className="commercial-card rounded-[28px] p-5 text-sm leading-7 text-slate-700">
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
              <div>
                <p className="font-bold text-slate-950">
                  Regla editorial activa
                </p>
                <p>
                  Para publicar, el autor debe tener una sección creada y
                  aprobada. El libro debe guardarse como{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    draft
                  </code>{" "}
                  o{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    under_review
                  </code>
                  , nunca como publicado directo sin revisión.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
