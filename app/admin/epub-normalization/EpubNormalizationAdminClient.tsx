"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Item = { bookId: string; status: "normalized" | "skipped" | "error" | "already-current" };
type Fleet = {
  ready: boolean;
  epubBooks: number;
  normalized: number;
  skipped: number;
  errors: number;
  pending: number;
  error?: string | null;
};
type ResponseData = {
  ok?: boolean;
  nextOffset?: number | null;
  results?: Item[];
  error?: string;
  fleet?: Fleet;
  counts?: { normalized: number; skipped: number; errors: number; alreadyCurrent: number };
};

export default function EpubNormalizationAdminClient() {
  const [running, setRunning] = useState(false);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [stats, setStats] = useState({ processed: 0, normalized: 0, skipped: 0, errors: 0, current: 0 });
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/epub-normalize", { cache: "no-store" });
    const data = (await response.json()) as ResponseData;
    if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo cargar la flota EPUB.");
    setFleet(data.fleet || null);
  }, []);

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Error cargando la flota."));
  }, [refresh]);

  const coverage = useMemo(() => {
    if (!fleet?.epubBooks) return 100;
    return Math.round(((fleet.epubBooks - fleet.pending) / fleet.epubBooks) * 100);
  }, [fleet]);

  async function runAll(force = false) {
    if (running) return;
    setRunning(true);
    setStats({ processed: 0, normalized: 0, skipped: 0, errors: 0, current: 0 });
    setMessage(force ? "Reprocesando catálogo…" : "Procesando catálogo…");
    let offset = 0;

    try {
      for (let guard = 0; guard < 500; guard += 1) {
        const response = await fetch("/api/admin/epub-normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: 8,
            offset,
            force,
            reason: force ? "Re-normalización completa del catálogo EPUB" : "Backfill completo del catálogo EPUB",
          }),
        });
        const data = (await response.json()) as ResponseData;
        if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo procesar el lote.");

        const rows = data.results ?? [];
        setStats((current) => ({
          processed: current.processed + rows.length,
          normalized: current.normalized + rows.filter((item) => item.status === "normalized").length,
          skipped: current.skipped + rows.filter((item) => item.status === "skipped").length,
          errors: current.errors + rows.filter((item) => item.status === "error").length,
          current: current.current + rows.filter((item) => item.status === "already-current").length,
        }));
        if (data.fleet) setFleet(data.fleet);

        if (typeof data.nextOffset !== "number") break;
        offset = data.nextOffset;
      }
      setMessage(force ? "Re-normalización global completada." : "Normalización global completada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error procesando el catálogo.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["EPUB", fleet?.epubBooks ?? "—"],
          ["Optimizados", fleet?.normalized ?? "—"],
          ["Conservados", fleet?.skipped ?? "—"],
          ["Pendientes", fleet?.pending ?? "—"],
          ["Errores", fleet?.errors ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-black">{String(value)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Catálogo completo · cobertura {coverage}%</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Procesa ocho EPUB por lote. El original nunca se reemplaza. Reflowable y fixed-layout complejos se conservan intactos; fixed-layout seguro de una imagen por página usa el perfil canónico LibroSeller.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => runAll(false)} disabled={running} className="rounded-full bg-[#155eef] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
              {running ? "Procesando…" : "Normalizar todo el catálogo"}
            </button>
            <button type="button" onClick={() => runAll(true)} disabled={running} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-700 disabled:opacity-50">
              Reprocesar todo
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {Object.entries(stats).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        {!fleet?.ready && fleet?.error ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Migración del normalizador pendiente: {fleet.error}</p>
        ) : null}
        {message ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
