"use client";

import { useEffect } from "react";

async function emit(bookSlug: string, eventType: string, metadata: Record<string, unknown> = {}) {
  try {
    await fetch("/api/marketplace/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        bookSlug,
        eventType,
        surface: "preview",
        metadata,
      }),
    });
  } catch {
    // La analítica nunca debe bloquear el preview.
  }
}

export default function PreviewTelemetry({
  bookSlug,
  progressKey,
}: {
  bookSlug: string;
  progressKey: string;
}) {
  useEffect(() => {
    void emit(bookSlug, "preview_started");

    const milestoneKey = `libroseller:preview-milestones:${progressKey}`;
    const interval = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(`libroseller:epub:${progressKey}`);
        if (!raw) return;

        const percent = Number((JSON.parse(raw) as { percent?: unknown }).percent);
        if (!Number.isFinite(percent)) return;

        const seen = new Set<number>(
          JSON.parse(localStorage.getItem(milestoneKey) || "[]")
        );

        for (const milestone of [25, 50, 75, 90]) {
          if (percent >= milestone && !seen.has(milestone)) {
            seen.add(milestone);
            localStorage.setItem(milestoneKey, JSON.stringify(Array.from(seen)));
            void emit(bookSlug, "preview_progress", { percent: milestone });
          }
        }

        if (percent >= 90 && !seen.has(100)) {
          seen.add(100);
          localStorage.setItem(milestoneKey, JSON.stringify(Array.from(seen)));
          void emit(bookSlug, "preview_completed", { percent });
        }
      } catch {
        // Ignorar almacenamiento bloqueado.
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [bookSlug, progressKey]);

  return null;
}
