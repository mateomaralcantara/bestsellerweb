"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Fleet = {
  ready: boolean;
  epubBooks: number;
  normalized: number;
  skipped: number;
  errors: number;
  pending: number;
  error?: string | null;
};

type BatchResponse = {
  ok: boolean;
  error?: string;
  fleet?: Fleet;
  batch?: {
    offset: number;
    limit: number;
    processed: number;
    nextOffset: number;
    counts: { normalized: number; skipped: number; errors: number; alreadyCurrent: number };
  };
};

export default function NormalizationConsole() {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [offset, setOffset] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/epub-normalization", { cache: "no-store" });
    const data = (await response.json()) as BatchResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el estado.");
    setFleet(data.fleet || null);
  }, []);

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Error cargando estado."));
  }, [refresh]);

  const coverage = useMemo(() => {
    if (!fleet?.epubBooks) return 100;
    return Math.round(((fleet.epubBooks - fleet.pending) / fleet.epubBooks) * 100);
  }, [fleet]);

  async function runBatch(force = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/epub-normalization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 8, offset, force, reason: force ? "Re-normalización editorial forzada" : "Backfill editorial LibroSeller" }),
      });
      const data = (await response.json()) as BatchResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Falló el lote.");
      setFleet(data.fleet || null);
      const counts = data.batch?.counts;
      setMessage(
        counts
          ? `Lote completado: ${counts.normalized} normalizados, ${counts.skipped} conservados, ${counts.alreadyCurrent} ya vigentes, ${counts.errors} errores.`
          : "Lote completado."
      );
      setOffset(data.batch?.nextOffset ?? offset + 8);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falló la normalización.");
    } finally {
      setBusy(false);
    }
  }

  async function runAll() {
    setBusy(true);
    setMessage("Procesando catálogo por lotes seguros…");
    let cursor = 0;
    let totalNormalized = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalCurrent = 0;
    try {
      for (let guard = 0; guard < 500; guard += 1) {
        const response = await fetch("/api/admin/epub-normalization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 8, offset: cursor, reason: "Backfill completo de catálogo EPUB" }),
        });
        const data = (await response.json()) as BatchResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || "Falló un lote del catálogo.");
        const batch = data.batch;
        if (!batch) break;
        totalNormalized += batch.counts.normalized;
        totalSkipped += batch.counts.skipped;
        totalErrors += batch.counts.errors;
        totalCurrent += batch.counts.alreadyCurrent;
        setFleet(data.fleet || null);
        if (batch.processed === 0 || batch.processed < batch.limit) break;
        cursor = batch.nextOffset;
        setOffset(cursor);
      }
      setMessage(`Catálogo procesado: ${totalNormalized} normalizados, ${totalSkipped} conservados, ${totalCurrent} ya vigentes, ${totalErrors} errores.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falló el backfill completo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["EPUB en catálogo", fleet?.epubBooks ?? "—"],
          ["Optimizados", fleet?.normalized ?? "—"],
          ["Conservados", fleet?.skipped ?? "—"],
          ["Pendientes", fleet?.pending ?? "—"],
          ["Errores", fleet?.errors ?? "—"],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{String(value)}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Cobertura del normalizador: {coverage}%</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Los EPUB reflowable y los fixed-layout complejos se conservan intactos. Solo se optimizan automáticamente fixed-layout seguros de una imagen por página.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => runBatch(false)} className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              Procesar 8
            </button>
            <button disabled={busy} onClick={runAll} className="rounded-full bg-[#155eef] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              Normalizar catálogo completo
            </button>
            <button disabled={busy} onClick={() => runBatch(true)} className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 disabled:opacity-50">
              Reprocesar lote
            </button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
