"use client";

import { useState } from "react";

type Item = { bookId: string; status: "normalized" | "skipped" | "error" };
type ResponseData = { ok?: boolean; nextOffset?: number | null; results?: Item[]; error?: string };

export default function EpubNormalizationAdminClient() {
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ processed: 0, normalized: 0, skipped: 0, errors: 0 });
  const [message, setMessage] = useState("");

  async function runAll() {
    if (running) return;
    setRunning(true);
    setStats({ processed: 0, normalized: 0, skipped: 0, errors: 0 });
    setMessage("Procesando catálogo…");
    let offset = 0;

    try {
      for (;;) {
        const response = await fetch("/api/admin/epub-normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 5, offset }),
        });
        const data = (await response.json()) as ResponseData;
        if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo procesar el lote.");

        const rows = data.results ?? [];
        setStats((current) => ({
          processed: current.processed + rows.length,
          normalized: current.normalized + rows.filter((item) => item.status === "normalized").length,
          skipped: current.skipped + rows.filter((item) => item.status === "skipped").length,
          errors: current.errors + rows.filter((item) => item.status === "error").length,
        }));

        if (typeof data.nextOffset !== "number") break;
        offset = data.nextOffset;
      }
      setMessage("Normalización global completada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error procesando el catálogo.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">Catálogo completo</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Procesa cinco EPUB por lote. El original nunca se reemplaza y los formatos no elegibles se conservan intactos.</p>
        </div>
        <button type="button" onClick={runAll} disabled={running} className="rounded-full bg-[#155eef] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
          {running ? "Procesando…" : "Normalizar todos los EPUB"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {Object.entries(stats).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      {message ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">{message}</p> : null}
    </section>
  );
}
