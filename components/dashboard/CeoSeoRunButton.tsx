"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, RefreshCw } from "lucide-react";

export function CeoSeoRunButton({ hasReport }: { hasReport: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function runAgent() {
    setRunning(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/admin/ceo-seo/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const body = (await response.json()) as {
        error?: string;
        sourceMode?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "No se pudo ejecutar el agente.");
      }

      setMessage(
        body.sourceMode?.startsWith("demo")
          ? "Reporte de demostración actualizado. Configura OpenAI para activar el análisis editorial."
          : "Reporte CEO/SEO actualizado correctamente."
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo ejecutar el agente."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-w-[240px]">
      <button
        type="button"
        onClick={runAgent}
        disabled={running}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-70"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasReport ? (
          <RefreshCw className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
        {running
          ? "Analizando contenido y métricas…"
          : hasReport
            ? "Actualizar análisis ahora"
            : "Generar primer análisis"}
      </button>

      {message ? (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
            isError
              ? "bg-red-500/20 text-red-100"
              : "bg-emerald-400/20 text-emerald-100"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
