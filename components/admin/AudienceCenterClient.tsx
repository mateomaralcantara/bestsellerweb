"use client";

import {
  BarChart3,
  BookOpen,
  Download,
  Mail,
  MessageCircle,
  Search,
  Tags,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { filterAudienceLeads } from "@/lib/admin/audience-analytics";
import type {
  AudienceBookPerformance,
  AudienceCenterData,
  AudienceFilters,
  AudienceLead,
  AudienceSegment,
} from "@/lib/admin/audience-types";

type Tab = "resumen" | "contactos" | "segmentos" | "intereses" | "rendimiento";
const PAGE_SIZE = 50;

const EMPTY_FILTERS: Required<
  Pick<AudienceFilters, "q" | "status" | "channel" | "category" | "niche" | "bookId" | "from" | "to">
> = {
  q: "",
  status: "all",
  channel: "all",
  category: "",
  niche: "",
  bookId: "",
  from: "",
  to: "",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">{children}</span>;
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: number; note: string; icon: typeof UsersRound }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <span className="rounded-2xl bg-slate-100 p-2 text-slate-700"><Icon size={18} /></span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value.toLocaleString("es-DO")}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </article>
  );
}

function LeadDrawer({ lead, onClose }: { lead: AudienceLead; onClose: () => void }) {
  const qualified = lead.bookInterests.reduce((sum, item) => sum + item.qualifiedPreviewCount, 0);
  return (
    <div className="fixed inset-0 z-[140] flex justify-end bg-slate-950/45 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Ficha de audiencia</p><h3 className="mt-1 break-all text-xl font-black text-slate-950">{lead.email}</h3></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-600" aria-label="Cerrar ficha"><X size={20} /></button>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Correo</p><p className="mt-1 break-all font-black text-slate-950">{lead.email}</p><p className="mt-2 text-xs text-slate-500">{lead.emailOptIn ? "Autorizado" : "Sin autorización"}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">WhatsApp</p><p className="mt-1 font-black text-slate-950">{lead.whatsapp || "No proporcionado"}</p><p className="mt-2 text-xs text-slate-500">{lead.whatsappOptIn ? "Autorizado" : "No habilitado"}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Captado</p><p className="mt-1 font-black text-slate-950">{formatDate(lead.createdAt)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Última actividad</p><p className="mt-1 font-black text-slate-950">{formatDate(lead.lastSeenAt)}</p></div>
          </div>
          <section>
            <div className="flex items-center justify-between"><h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Perfil de interés</h4><Pill>{lead.status}</Pill></div>
            <div className="mt-3 flex flex-wrap gap-2">{[lead.primaryNiche, lead.primaryCategory, lead.secondaryCategory, ...lead.preferences.slice(0, 16)].filter((item): item is string => Boolean(item)).map((item) => <Pill key={item}>{item}</Pill>)}</div>
          </section>
          <section className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Actividad editorial</p><p className="mt-2 text-2xl font-black text-slate-950">{qualified.toLocaleString("es-DO")} previews cualificados</p><p className="mt-1 text-sm font-bold text-slate-600">{lead.bookInterests.length.toLocaleString("es-DO")} libros</p></section>
          <section><h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Historial de libros</h4><div className="mt-3 space-y-3">{lead.bookInterests.map((item) => <article key={item.bookId} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-black text-slate-950">{item.title}</p><p className="mt-1 text-xs text-slate-500">Última interacción: {formatDate(item.lastSeenAt)}</p></div><Pill>{item.qualifiedPreviewCount} previews</Pill></div></article>)}{lead.bookInterests.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No hay historial adicional.</p> : null}</div></section>
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500"><span className="font-black text-slate-700">Origen:</span> {lead.source}</p>
        </div>
      </aside>
    </div>
  );
}

function SegmentSection({ title, items, onChoose }: { title: string; items: AudienceSegment[]; onChoose: (value: string) => void }) {
  const max = Math.max(1, ...items.map((item) => item.leads));
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Segmentación editorial</p><h3 className="mt-1 text-xl font-black text-slate-950">{title}</h3></div><Tags className="text-indigo-600" /></div>
      <div className="mt-6 space-y-4">{items.map((item) => <button key={item.key} type="button" onClick={() => onChoose(item.label)} className="block w-full text-left"><div className="flex justify-between gap-3 text-sm"><span className="font-black text-slate-800">{item.label}</span><span className="font-bold text-slate-500">{item.leads.toLocaleString("es-DO")} · {item.percentage}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(2, (item.leads / max) * 100)}%` }} /></div></button>)}{items.length === 0 ? <p className="text-sm text-slate-500">Aún no hay segmentos suficientes.</p> : null}</div>
    </section>
  );
}

function BookCards({ books, onChoose }: { books: AudienceBookPerformance[]; onChoose: (bookId: string) => void }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{books.map((book, index) => <article key={book.bookId} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><span className="text-3xl font-black text-slate-200">#{index + 1}</span><Pill>{book.qualifiedLeads} leads</Pill></div><h4 className="mt-3 font-black leading-6 text-slate-950">{book.title}</h4><p className="mt-2 text-sm text-slate-500">{book.qualifiedPreviews.toLocaleString("es-DO")} previews cualificados · {book.previewStarts.toLocaleString("es-DO")} aperturas.</p><p className="mt-2 text-2xl font-black text-emerald-700">{book.captureRate.toLocaleString("es-DO")}%</p><p className="text-xs font-bold text-slate-400">tasa Preview → Lead</p><button type="button" onClick={() => onChoose(book.bookId)} className="mt-4 text-sm font-black text-indigo-700 hover:underline">Ver audiencia de este libro →</button></article>)}</div>;
}

export default function AudienceCenterClient({ data }: { data: AudienceCenterData }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedLead, setSelectedLead] = useState<AudienceLead | null>(null);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterAudienceLeads(data.leads, filters), [data.leads, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => setPage(1), [filters]);

  const categories = useMemo(() => [...new Set(data.leads.map((lead) => lead.primaryCategory).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "es")), [data.leads]);
  const niches = useMemo(() => [...new Set(data.leads.map((lead) => lead.primaryNiche).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "es")), [data.leads]);
  const books = useMemo(() => { const map = new Map<string, string>(); for (const lead of data.leads) { for (const item of lead.bookInterests) map.set(item.bookId, item.title); if (lead.firstBookId && lead.firstBookTitle) map.set(lead.firstBookId, lead.firstBookTitle); } return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, "es")); }, [data.leads]);
  const exportHref = useMemo(() => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); }); return `/api/admin/captacion/export${params.size ? `?${params.toString()}` : ""}`; }, [filters]);
  const maxDaily = Math.max(1, ...data.daily.map((point) => point.leads));

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  function selectBook(bookId: string) { updateFilter("bookId", bookId); setTab("contactos"); }
  function selectSegment(type: "category" | "niche", value: string) { setFilters((current) => ({ ...current, category: type === "category" ? value : "", niche: type === "niche" ? value : "" })); setTab("contactos"); }

  const tabs: Array<[Tab, string]> = [["resumen", "Resumen"], ["contactos", "Contactos"], ["segmentos", "Segmentos"], ["intereses", "Intereses"], ["rendimiento", "Rendimiento"]];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">LibroSeller · Audience Center</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Centro de Captación</h2><p className="mt-3 text-sm leading-6 text-slate-300">Audiencia captada desde previews, intereses editoriales, segmentación y rendimiento por libro. Este módulo organiza la audiencia; no envía campañas.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><p className="font-black">Fuente de datos</p><p className={`mt-1 font-bold ${data.storageMode === "dedicated" ? "text-emerald-300" : "text-amber-300"}`}>{data.storageMode === "dedicated" ? "Tablas de suscriptores" : data.storageMode === "hybrid" ? "Tablas + respaldo histórico" : "Respaldo marketplace_events"}</p><p className="mt-1 text-xs text-slate-400">Actualizado {formatDate(data.generatedAt)}</p></div></div></section>
      {data.storageMode !== "dedicated" ? <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950"><span className="font-black">{data.storageMode === "hybrid" ? "Histórico unificado." : "Modo respaldo activo."}</span> {data.storageMode === "hybrid" ? "El Centro combina las tablas especializadas con marketplace_events y deduplica por correo." : "Los correos se leen desde marketplace_events hasta que las tablas especializadas estén disponibles."}</section> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Suscriptores" value={data.stats.total} note="Captados en previews" icon={UsersRound} /><Metric label="Nuevos hoy" value={data.stats.newToday} note="Día actual RD" icon={UserRound} /><Metric label="Últimos 7 días" value={data.stats.newLast7Days} note="Crecimiento reciente" icon={BarChart3} /><Metric label="Con WhatsApp" value={data.stats.withWhatsapp} note="Canal autorizado" icon={MessageCircle} /><Metric label="Solo correo" value={data.stats.emailOnly} note="Email disponible" icon={Mail} /><Metric label="Activos" value={data.stats.active} note="Elegibles actualmente" icon={Tags} /></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-2xl px-4 py-2.5 text-sm font-black ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</div></section>

      {tab === "resumen" ? <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Crecimiento</p><h3 className="mt-1 text-xl font-black text-slate-950">Captaciones de los últimos 14 días</h3><div className="mt-7 grid h-56 items-end gap-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>{data.daily.map((point) => <div key={point.date} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center"><span className="text-[10px] font-black text-slate-500">{point.leads}</span><div className="min-h-1 rounded-t-xl bg-indigo-600" style={{ height: `${Math.max(3, (point.leads / maxDaily) * 100)}%` }} /><span className="truncate text-[9px] font-bold text-slate-400">{shortDate(point.date)}</span></div>)}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Estado de audiencia</p><h3 className="mt-1 text-xl font-black text-slate-950">Salud de la base</h3><div className="mt-6 space-y-4">{[["Activos", data.stats.active], ["Dados de baja", data.stats.unsubscribed], ["Suprimidos", data.stats.suppressed]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span className="font-bold text-slate-700">{label}</span><span className="text-xl font-black text-slate-950">{Number(value).toLocaleString("es-DO")}</span></div>)}</div></section></div> : null}

      {tab === "contactos" ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Base de audiencia</p><h3 className="mt-1 text-2xl font-black text-slate-950">Contactos</h3><p className="mt-1 text-sm text-slate-500">{filtered.length.toLocaleString("es-DO")} de {data.leads.length.toLocaleString("es-DO")}</p></div><a href={exportHref} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white"><Download size={17} /> Exportar CSV</a></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4"><label className="relative lg:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} /><input value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Buscar correo, WhatsApp, categoría o libro" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm" /></label><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="unsubscribed">Dados de baja</option><option value="suppressed">Suprimidos</option></select><select value={filters.channel} onChange={(event) => updateFilter("channel", event.target.value as typeof filters.channel)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="all">Todos los canales</option><option value="email_only">Solo correo</option><option value="whatsapp">Con WhatsApp</option><option value="both">Correo + WhatsApp</option></select><select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.niche} onChange={(event) => updateFilter("niche", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="">Todos los nichos</option>{niches.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.bookId} onChange={(event) => updateFilter("bookId", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold"><option value="">Todos los libros</option>{books.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /><input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" /><button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-600">Limpiar filtros</button></div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Interés</th><th className="px-4 py-3">Libro origen</th><th className="px-4 py-3">Canales</th><th className="px-4 py-3">Captado</th><th className="px-4 py-3">Actividad</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((lead) => <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="cursor-pointer hover:bg-indigo-50/50"><td className="px-4 py-4"><p className="font-black text-slate-950">{lead.email}</p><p className="text-xs text-slate-500">{lead.whatsapp || "Sin WhatsApp"}</p></td><td className="px-4 py-4 font-bold">{lead.primaryCategory || lead.primaryNiche || "Sin clasificar"}</td><td className="px-4 py-4">{lead.firstBookTitle || "—"}</td><td className="px-4 py-4"><div className="flex gap-1">{lead.emailOptIn ? <Pill>Email</Pill> : null}{lead.whatsapp && lead.whatsappOptIn ? <Pill>WhatsApp</Pill> : null}</div></td><td className="px-4 py-4">{formatDate(lead.createdAt)}</td><td className="px-4 py-4">{formatDate(lead.lastSeenAt)}</td></tr>)}</tbody></table>{filtered.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No hay contactos que coincidan.</div> : null}</div>
        {filtered.length > 0 ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="font-bold text-slate-500">Página {safePage} de {pageCount} · {filtered.length.toLocaleString("es-DO")} contactos</p><div className="flex gap-2"><button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border px-3 py-2 font-black disabled:opacity-40">← Anterior</button><button type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-xl border px-3 py-2 font-black disabled:opacity-40">Siguiente →</button></div></div> : null}
      </section> : null}

      {tab === "segmentos" ? <div className="grid gap-5 xl:grid-cols-2"><SegmentSection title="Categorías" items={data.categories} onChoose={(value) => selectSegment("category", value)} /><SegmentSection title="Nichos" items={data.niches} onChoose={(value) => selectSegment("niche", value)} /></div> : null}
      {tab === "intereses" ? <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Comportamiento</p><h3 className="mt-1 text-2xl font-black text-slate-950">Libros que califican mejor la audiencia</h3></div><BookOpen className="text-indigo-600" /></div><BookCards books={data.topBooks} onChoose={selectBook} /></section> : null}
      {tab === "rendimiento" ? <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Rendimiento de captación</p><h3 className="mt-1 text-2xl font-black text-slate-950">Preview → Lead → Compra</h3><p className="mt-2 text-sm text-slate-500">Las aperturas son eventos registrados, no visitantes únicos.</p><div className="mt-6 overflow-x-auto rounded-2xl border"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Libro</th><th className="px-4 py-3 text-right">Aperturas</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">Preview → Lead</th><th className="px-4 py-3 text-right">Cualificados</th><th className="px-4 py-3 text-right">Ventas</th><th className="px-4 py-3 text-right">Preview → Compra</th></tr></thead><tbody className="divide-y">{data.topBooks.map((book) => <tr key={book.bookId}><td className="px-4 py-4 font-black">{book.title}</td><td className="px-4 py-4 text-right">{book.previewStarts.toLocaleString("es-DO")}</td><td className="px-4 py-4 text-right font-black text-indigo-700">{book.qualifiedLeads.toLocaleString("es-DO")}</td><td className="px-4 py-4 text-right font-black text-emerald-700">{book.captureRate}%</td><td className="px-4 py-4 text-right">{book.qualifiedPreviews.toLocaleString("es-DO")}</td><td className="px-4 py-4 text-right">{book.verifiedSales.toLocaleString("es-DO")}</td><td className="px-4 py-4 text-right">{book.previewToPurchaseRate}%</td></tr>)}</tbody></table></div></section> : null}
      {selectedLead ? <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} /> : null}
    </div>
  );
}
