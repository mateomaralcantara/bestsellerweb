"use client";

import { useState } from "react";

type BookItem = { id: string; slug: string; title: string; status: string | null };
type Finding = { code: string; severity: "info" | "warning" | "error"; message: string; detail?: string };
type Report = {
  score: number;
  status: "pass" | "warning" | "fail";
  epubVersion: string;
  layout: string;
  findings: Finding[];
  summary: Record<string, unknown>;
};

export default function EpubQualityClient({ books }: { books: BookItem[] }) {
  const [running, setRunning] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function analyze(book: BookItem) {
    setRunning(book.id);
    setErrors((state) => ({ ...state, [book.id]: "" }));

    try {
      const response = await fetch(`/api/books/${encodeURIComponent(book.slug)}/preflight`, { method: "POST" });
      const data = (await response.json()) as { report?: Report; error?: string };
      if (!response.ok || !data.report) {
        setErrors((state) => ({ ...state, [book.id]: data.error || "No se pudo analizar." }));
        return;
      }
      setReports((state) => ({ ...state, [book.id]: data.report! }));
    } catch {
      setErrors((state) => ({ ...state, [book.id]: "Error de conexión ejecutando Preflight." }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-5">
      {books.map((book) => {
        const report = reports[book.id];
        return (
          <article key={book.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{book.status || "sin estado"}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{book.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => analyze(book)}
                disabled={running === book.id}
                className="rounded-full bg-[#155eef] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {running === book.id ? "Analizando EPUB…" : "Ejecutar Preflight"}
              </button>
            </div>

            {errors[book.id] ? (
              <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{errors[book.id]}</p>
            ) : null}

            {report ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-950 p-4 text-white">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Calidad</p>
                    <p className="mt-1 text-3xl font-black">{report.score}/100</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Estado</p><p className="mt-1 font-black">{report.status}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">EPUB</p><p className="mt-1 font-black">{report.epubVersion}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Layout</p><p className="mt-1 font-black">{report.layout}</p></div>
                </div>

                <div className="space-y-2">
                  {report.findings.map((finding, index) => (
                    <div key={`${finding.code}-${index}`} className="rounded-2xl border border-slate-200 p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${finding.severity === "error" ? "bg-red-100 text-red-700" : finding.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>{finding.severity}</span>
                        <strong className="text-slate-900">{finding.code}</strong>
                      </div>
                      <p className="mt-2 text-slate-700">{finding.message}</p>
                      {finding.detail ? <p className="mt-1 text-xs text-slate-500">{finding.detail}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
      {!books.length ? <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">No hay libros del autor para auditar.</div> : null}
    </div>
  );
}
