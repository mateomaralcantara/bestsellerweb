import {
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  Link2,
  Megaphone,
  Sparkles,
  Trophy,
} from "lucide-react";
import { AffiliateForm } from "@/components/forms/affiliate-form";
import { SectionHeading } from "@/components/section-heading";

const perks = [
  {
    icon: BadgeDollarSign,
    title: "Comisiones claras",
    text: "Consulta el porcentaje definido para cada libro o campaña disponible.",
  },
  {
    icon: Link2,
    title: "Enlaces identificables",
    text: "Promociona con enlaces y códigos asociados a tu cuenta de afiliado.",
  },
  {
    icon: Megaphone,
    title: "Material comercial",
    text: "Usa recursos preparados para redes sociales, comunidades y campañas.",
  },
  {
    icon: BarChart3,
    title: "Seguimiento de resultados",
    text: "Visualiza la actividad y construye una estrategia basada en conversiones.",
  },
];

export default function AffiliatesPage() {
  return (
    <main>
      <section className="commercial-dark commercial-grid commercial-shine relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Programa de afiliados
            </p>
            <h1 className="mt-6 max-w-4xl text-balance text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              Recomienda buenas historias. Crece con cada venta.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Conecta libros con nuevos lectores mediante un sistema comercial
              pensado para creadores de contenido, comunidades y aliados.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-slate-300">
              {["Registro sencillo", "Enlaces por afiliado", "Comisiones visibles"].map(
                (item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md rounded-[34px] border border-white/15 bg-white/10 p-7 shadow-[0_35px_90px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ffbf3f] text-[#07111f] shadow-lg">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-2xl font-black text-white">
              Una comunidad que convierte recomendación en oportunidad.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Presenta títulos alineados con tu audiencia y construye una vía
              adicional de ingresos alrededor de la lectura.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Ventajas"
          title="Herramientas para promocionar con criterio"
          description="Una experiencia clara para saber qué compartir, cómo identificar las ventas y qué resultados estás generando."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }, index) => (
            <article
              key={title}
              className={
                index === 0
                  ? "editorial-special rounded-[28px] p-6"
                  : "commercial-card rounded-[28px] p-6"
              }
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#155eef]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-xl font-black text-[#07111f]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-32">
            <SectionHeading
              eyebrow="Solicitud"
              title="Cuéntanos cómo llegas a tus lectores"
              description="Completa tus datos y describe brevemente los canales donde deseas promocionar los libros."
            />
          </div>
          <AffiliateForm />
        </div>
      </section>
    </main>
  );
}
