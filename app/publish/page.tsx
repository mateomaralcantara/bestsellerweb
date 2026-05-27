import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Tags,
  Target,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
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
    text: "Agrega título, subtítulo, autor, descripción, nicho, categoría y palabras clave.",
  },
  {
    icon: UploadCloud,
    title: "2. Sube portada y archivo",
    text: "Carga la portada y el PDF/EPUB completo. El archivo del libro debe quedar protegido.",
  },
  {
    icon: ShieldCheck,
    title: "3. Envíalo a evaluación",
    text: "El libro no debe publicarse directo. Debe pasar por estado de revisión antes de salir al catálogo.",
  },
  {
    icon: CheckCircle2,
    title: "4. Aprobación y publicación",
    text: "Cuando el libro esté aprobado, se publica en catálogo y se activa la compra/lectura.",
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

export default function PublishPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-8">
          <SectionHeading
            eyebrow="Publicar"
            title="Publicar un libro no es subir un PDF y rezar."
            description="Este módulo funciona como guía. El formulario real está en Nuevo libro, donde crearás la ficha completa y enviarás el libro a evaluación."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {publishFeatures.map(({ icon: Icon, title, text }, index) => {
              const cardClassName =
                index === 0
                  ? "editorial-special rounded-[28px] p-5 shadow-panel"
                  : "glass rounded-[28px] p-5 shadow-panel";

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

          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-panel">
            <h2 className="text-lg font-bold text-brand-800">
              Antes de empezar, ten listo
            </h2>

            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-700" />
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent-700">
              Modo tutorial
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight text-brand-800">
              Cómo funciona el flujo editorial
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-700">
              Ahora usaremos un solo formulario real. Primero creas el libro,
              luego queda en evaluación, y después se aprueba o se rechaza. Más
              limpio, menos duplicación, más tipo Amazon.
            </p>

            <div className="mt-6 space-y-4">
              {tutorialSteps.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-950">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/dashboard/books/new"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Crear nuevo libro
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/dashboard/books/published"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver mis libros
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <strong>Nota importante:</strong> el botón “Crear nuevo libro” debe
            llevar al único formulario real. Ahí el libro debería guardarse como{" "}
            <code className="rounded bg-white px-1 py-0.5">draft</code> o{" "}
            <code className="rounded bg-white px-1 py-0.5">under_review</code>,
            no como publicado directo.
          </div>
        </section>
      </div>
    </main>
  );
}