import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  LockKeyhole,
  MessageSquareText,
  MousePointerClick,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { getAdminAccess } from "@/lib/admin-access";
import {
  getCeoSeoAgentConfiguration,
  getCeoSeoDailyReports,
  isCeoSeoSetupError,
  type GrowthSnapshot,
  type SocialPostSuggestion,
} from "@/lib/ceo-seo-agent";
import { CeoSeoRunButton } from "@/components/dashboard/CeoSeoRunButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "long",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Santo_Domingo",
  }).format(date);
}

function platformLabel(platform: SocialPostSuggestion["platform"]) {
  const labels: Record<SocialPostSuggestion["platform"], string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    instagram_story: "Instagram Story",
    instagram_reel: "Instagram Reel",
  };

  return labels[platform];
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function GrowthCards({ growth }: { growth: GrowthSnapshot }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<Eye className="h-5 w-5" />}
        label="Vistas hoy"
        value={growth.catalogViewsToday}
        detail={`${growth.viewGrowthPercent >= 0 ? "+" : ""}${growth.viewGrowthPercent}% frente a ayer`}
      />
      <StatCard
        icon={<ShoppingBag className="h-5 w-5" />}
        label="Compras hoy"
        value={growth.purchasesToday}
        detail={`${growth.purchasesLast7Days} compras durante los últimos 7 días`}
      />
      <StatCard
        icon={<BookOpenCheck className="h-5 w-5" />}
        label="Lectores activos"
        value={growth.activeReadersToday}
        detail={`${growth.activeReadersLast7Days} lectores activos en 7 días`}
      />
      <StatCard
        icon={<MousePointerClick className="h-5 w-5" />}
        label="Conversión diaria"
        value={`${growth.conversionPercentToday}%`}
        detail={`${growth.addToCartToday} carrito · ${growth.checkoutStartsToday} checkout`}
      />
    </div>
  );
}

function SetupPending() {
  return (
    <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-7 text-amber-950">
      <AlertTriangle className="h-9 w-9" />
      <h2 className="mt-4 text-2xl font-black">Falta instalar las tablas del agente</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7">
        El código ya reconoce el panel, pero Supabase todavía necesita la migración
        <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-bold">
          20260818_ceo_seo_daily_agent.sql
        </code>
        para guardar intereses y reportes diarios.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex rounded-xl bg-amber-950 px-4 py-2 text-sm font-bold text-white"
      >
        Volver al dashboard
      </Link>
    </section>
  );
}

export default async function AiGrowthPage() {
  const access = await getAdminAccess();

  if (!access.user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/ai-growth")}`);
  }

  if (!access.isAdmin) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950">
        <ShieldCheck className="h-10 w-10" />
        <h1 className="mt-5 text-2xl font-black">Acceso administrativo requerido</h1>
        <p className="mt-3 text-sm">
          El Agente CEO/SEO contiene métricas internas y solo está disponible para
          administradores.
        </p>
      </section>
    );
  }

  const configuration = getCeoSeoAgentConfiguration();
  let reports: Awaited<ReturnType<typeof getCeoSeoDailyReports>> = [];
  let setupPending = false;
  let loadError: string | null = null;

  try {
    reports = await getCeoSeoDailyReports(14);
  } catch (error) {
    setupPending = isCeoSeoSetupError(error);
    loadError = error instanceof Error ? error.message : "No se pudo cargar el panel.";
  }

  if (setupPending) return <SetupPending />;

  const latest = reports[0] ?? null;

  return (
    <section className="space-y-8">
      <header className="commercial-dark commercial-shine overflow-hidden rounded-[32px] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                <BrainCircuit className="h-3.5 w-3.5" />
                Inteligencia editorial
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200">
                Aprobación humana obligatoria
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Agente CEO/SEO diario
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Analiza libros, compras, lectura y comportamiento agregado para crear
              prioridades ejecutivas, borradores sociales y un registro diario de
              crecimiento. Nunca publica ni envía nada automáticamente.
            </p>
          </div>

          <CeoSeoRunButton hasReport={Boolean(latest)} />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              ok: configuration.aiConfigured,
              label: configuration.aiConfigured
                ? `IA activa · ${configuration.model}`
                : "Falta OPENAI_API_KEY",
            },
            {
              ok: configuration.cronConfigured,
              label: configuration.cronConfigured
                ? "Cron protegido"
                : "Falta CRON_SECRET",
            },
            {
              ok: configuration.fullPdfEnabled,
              label: configuration.fullPdfEnabled
                ? "Lectura de PDF habilitada"
                : "Solo metadatos y extractos",
            },
            {
              ok: true,
              label: "Ejecución diaria · 9:00 a. m.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-slate-200"
            >
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              )}
              {item.label}
            </div>
          ))}
        </div>
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <strong>Error cargando reportes:</strong> {loadError}
        </div>
      ) : null}

      {!latest ? (
        <section className="rounded-[30px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Bot className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Aún no existe un reporte
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Pulsa “Generar primer análisis”. Si OpenAI todavía no está configurado,
            verás una demostración claramente identificada para validar el flujo.
          </p>
        </section>
      ) : (
        <>
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                  Crecimiento documentado
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Pulso del {formatDate(`${latest.reportDate}T12:00:00-04:00`)}
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                  latest.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {latest.status === "completed" ? "Análisis IA" : "Modo demostración"}
              </span>
            </div>
            <GrowthCards growth={latest.growthSnapshot} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                    Resumen CEO
                  </p>
                  <h2 className="text-xl font-black text-slate-950">Decisión del día</h2>
                </div>
              </div>
              <p className="mt-5 text-base leading-8 text-slate-700">
                {latest.analysis.executiveSummary}
              </p>

              <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  Libro analizado
                </p>
                <h3 className="mt-2 text-xl font-black">
                  {latest.analysis.focusBook.title}
                </h3>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Modo: {latest.analysis.focusBook.analysisMode === "pdf_complete"
                    ? "PDF completo"
                    : "metadatos y extractos"}
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
                  {latest.analysis.focusBook.contentTakeaways.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-emerald-700" />
                <h2 className="text-xl font-black text-slate-950">Prioridades de hoy</h2>
              </div>
              <ol className="mt-5 space-y-4">
                {latest.analysis.dailyPriorities.map((priority, index) => (
                  <li key={priority} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-sm leading-6 text-slate-700">{priority}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  <LockKeyhole className="h-4 w-4" />
                  Control humano
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  El agente redacta y recomienda. Un administrador decide qué se
                  aprueba, modifica o descarta.
                </p>
              </div>
            </article>
          </section>

          <section>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-blue-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Evidencia agregada
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Mejores intereses de los lectores
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {latest.analysis.interestInsights.map((insight) => (
                <article
                  key={`${insight.label}-${insight.evidence}`}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black text-slate-950">{insight.label}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                      Confianza {insight.confidence === "high" ? "alta" : insight.confidence === "medium" ? "media" : "baja"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{insight.evidence}</p>
                  <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-900">
                    {insight.recommendedAction}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3">
              <Send className="h-6 w-6 text-fuchsia-700" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">
                  Borradores sujetos a aprobación
                </p>
                <h2 className="text-2xl font-black text-slate-950">Plan social de hoy</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {latest.analysis.socialPlan.map((post) => (
                <article
                  key={`${post.platform}-${post.publishTime}`}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <span className="font-black text-slate-950">{platformLabel(post.platform)}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">
                      {post.publishTime}
                    </span>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Objetivo</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{post.objective}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950 p-4 text-sm leading-7 text-white">
                      {post.caption}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Dirección visual</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{post.visualBrief}</p>
                    </div>
                    <p className="text-sm font-bold text-blue-700">{post.callToAction}</p>
                    <div className="flex flex-wrap gap-2">
                      {post.hashtags.map((tag) => (
                        <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border-2 border-amber-300 bg-amber-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-1 h-7 w-7 text-amber-800" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">
                    Simulación interna · No publicar
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-amber-950">
                    Grupo de enfoque sintético
                  </h2>
                </div>
              </div>
              <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-black uppercase text-white">
                No son clientes reales
              </span>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-amber-900">
              Estas personas, correos y opiniones son ficticios y sirven únicamente
              para probar mensajes. No se guardan como reseñas, no se muestran en el
              catálogo y no deben usarse como testimonios.
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {latest.analysis.syntheticFocusGroup.map((item) => (
                <article key={item.email} className="rounded-2xl border border-amber-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-slate-950">{item.persona}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{item.email}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">
                      {item.rating.toFixed(1)}/5 · sintético
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{item.comment}</p>
                </article>
              ))}
            </div>
          </section>

          {latest.growthSnapshot.topBooks.length > 0 ? (
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-cyan-700" />
                <h2 className="text-xl font-black text-slate-950">Libros con mayor señal en 7 días</h2>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Libro</th>
                      <th className="px-3 py-3">Vistas</th>
                      <th className="px-3 py-3">Muestras</th>
                      <th className="px-3 py-3">Carrito</th>
                      <th className="px-3 py-3">Compras</th>
                      <th className="px-3 py-3">Lectores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.growthSnapshot.topBooks.map((book) => (
                      <tr key={book.bookId} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-4 font-bold text-slate-900">{book.title}</td>
                        <td className="px-3 py-4 text-slate-600">{book.views7Days}</td>
                        <td className="px-3 py-4 text-slate-600">{book.previewOpens7Days}</td>
                        <td className="px-3 py-4 text-slate-600">{book.addToCart7Days}</td>
                        <td className="px-3 py-4 text-slate-600">{book.purchases7Days}</td>
                        <td className="px-3 py-4 text-slate-600">{book.activeReaders7Days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {latest.errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <strong>El respaldo local fue utilizado:</strong> {latest.errorMessage}
            </div>
          ) : null}
        </>
      )}

      {reports.length > 0 ? (
        <section className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-slate-700" />
            <h2 className="text-xl font-black text-slate-950">Historial de crecimiento</h2>
          </div>
          <div className="mt-5 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-900">
                    {formatDate(`${report.reportDate}T12:00:00-04:00`)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-bold text-slate-500">
                  <span>{report.growthSnapshot.catalogViewsToday} vistas</span>
                  <span>{report.growthSnapshot.purchasesToday} compras</span>
                  <span>{report.sourceMode}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <p>
          Retención actual: un reporte por día en Supabase. La automatización corre
          por Vercel Cron y la ejecución manual reemplaza únicamente el reporte del
          día en curso.
        </p>
      </footer>
    </section>
  );
}
