import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function count(table: string, configure?: (query: any) => any) {
  let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count: total, error } = await query;
  return { total: total ?? 0, error: error?.message ?? null };
}

export default async function ObservabilityPage() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [published, events, failedPreflight, failedPayments, successfulPayments] = await Promise.all([
    count("books", (query) => query.eq("status", "published")),
    count("marketplace_events", (query) => query.gte("occurred_at", since24h)),
    count("epub_preflight_reports", (query) => query.eq("status", "fail").gte("created_at", since24h)),
    count("paypal_orders", (query) => query.in("status", ["failed", "error", "cancelled"]).gte("created_at", since24h)),
    count("paypal_orders", (query) => query.in("status", ["completed", "captured", "approved"]).gte("created_at", since24h)),
  ]);

  const paymentTotal = failedPayments.total + successfulPayments.total;
  const paymentSuccessRate = paymentTotal > 0 ? (successfulPayments.total / paymentTotal) * 100 : 100;
  const marketplaceReady = !events.error;
  const preflightReady = !failedPreflight.error;

  const targets = [
    { label: "Disponibilidad objetivo", target: "≥ 99.9%", state: "Medir desde Vercel + /api/health" },
    { label: "Captura de pagos", target: "≥ 99%", state: `${paymentSuccessRate.toFixed(2)}% últimas 24 h` },
    { label: "Carga EPUB válida", target: "≥ 99.5%", state: preflightReady ? `${failedPreflight.total} fallos Preflight/24 h` : "Migración pendiente" },
    { label: "Telemetría first-party", target: "100% no bloqueante", state: marketplaceReady ? `${events.total} eventos/24 h` : "Migración pendiente" },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">SRE / Observabilidad</p>
        <h2 className="mt-1 text-3xl font-black text-slate-950">Estado operativo LibroSeller</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">Panel de señales críticas para lector, publicación, marketplace y pagos. El endpoint público de salud es <code>/api/health</code>.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Libros publicados", published.total],
          ["Eventos 24 h", events.error ? "N/D" : events.total],
          ["Preflight fallidos 24 h", failedPreflight.error ? "N/D" : failedPreflight.total],
          ["Éxito PayPal 24 h", `${paymentSuccessRate.toFixed(2)}%`],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{String(value)}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Objetivos de servicio</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {targets.map((item) => (
            <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">{item.label}</p>
              <p className="mt-1 text-xs font-bold text-[#155eef]">Objetivo {item.target}</p>
              <p className="mt-2 text-sm text-slate-600">{item.state}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-slate-950">Quality gates</h3>
        <div className="mt-4 space-y-3 text-sm">
          <p className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">✓ Base de datos principal: {published.error ? `error: ${published.error}` : "operativa"}</p>
          <p className={`rounded-2xl p-4 font-bold ${marketplaceReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{marketplaceReady ? "✓" : "!"} Marketplace 9.x: {marketplaceReady ? "telemetría disponible" : events.error}</p>
          <p className={`rounded-2xl p-4 font-bold ${preflightReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{preflightReady ? "✓" : "!"} EPUB Preflight: {preflightReady ? "reportes disponibles" : failedPreflight.error}</p>
        </div>
      </section>
    </div>
  );
}
