"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReaderTheme = "paper" | "night";

type EpubLocation = {
  start?: {
    cfi?: string;
    href?: string;
    percentage?: number;
    displayed?: {
      page?: number;
      total?: number;
    };
  };
};

type SpineItem = {
  href?: string;
  idref?: string;
  linear?: string;
};

type EpubBook = {
  ready?: Promise<unknown>;
  spine?: {
    spineItems?: SpineItem[];
    first?: () => SpineItem | undefined;
  };
  locations: {
    generate: (chars?: number) => Promise<unknown>;
    percentageFromCfi: (cfi: string) => number;
  };
  renderTo: (
    element: HTMLElement,
    options: {
      width: string | number;
      height: string | number;
      spread: "none";
      flow: "paginated";
      manager: "default";
    }
  ) => EpubRendition;
  destroy: () => void;
};

type EpubRendition = {
  display: (target?: string) => Promise<unknown>;
  next: () => Promise<unknown>;
  prev: () => Promise<unknown>;
  resize: (width: number, height: number) => void;
  destroy: () => void;
  on: {
    (event: "relocated", callback: (location: EpubLocation) => void): void;
    (event: "rendered", callback: () => void): void;
  };
  themes: {
    register?: (
      name: string,
      rules: Record<string, Record<string, string>>
    ) => void;
    select: (name: string) => void;
    fontSize: (size: string) => void;
  };
};

type EpubFactory = (input: ArrayBuffer) => EpubBook;

type ReaderProps = {
  title: string;
  epubUrl: string;
  progressUrl?: string;
  progressKey: string;
  exitUrl: string;
  exitLabel: string;
  purchaseUrl?: string;
  mode: "full" | "preview";
};

type SavedProgress = {
  cfi: string | null;
  percent: number;
};

const MIN_FONT = 85;
const MAX_FONT = 150;
const FONT_STEP = 10;
const SAVE_DELAY_MS = 600;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isSkippableSection(href?: string | null) {
  const normalized = String(href || "")
    .split("#")[0]
    .replace(/^\.\//, "")
    .toLowerCase();

  return (
    normalized.endsWith("nav.xhtml") ||
    normalized.endsWith("nav.html") ||
    normalized.endsWith("toc.xhtml") ||
    normalized.endsWith("toc.html")
  );
}

function localKey(progressKey: string) {
  return `libroseller:epub:${progressKey}`;
}

function normalizeIframe(viewer: HTMLElement | null) {
  if (!viewer) return;

  viewer.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.transform = "none";

    try {
      const doc = iframe.contentDocument;
      if (!doc?.head) return;

      const styleId = "libroseller-epub-responsive-v16";
      let style = doc.getElementById(styleId) as HTMLStyleElement | null;

      if (!style) {
        style = doc.createElement("style");
        style.id = styleId;
        doc.head.appendChild(style);
      }

      style.textContent = `
        html, body {
          box-sizing: border-box !important;
          min-width: 0 !important;
          max-width: none !important;
          transform: none !important;
          transform-origin: initial !important;
        }

        body {
          margin: 0 !important;
          padding: clamp(20px, 4.6vw, 58px) !important;
          font-family: Georgia, "Times New Roman", serif !important;
          line-height: 1.62 !important;
          text-align: justify !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
        }

        h1, h2, h3, h4 {
          text-align: left !important;
          line-height: 1.22 !important;
          break-after: avoid !important;
        }

        p, li, blockquote {
          max-width: 100% !important;
        }

        img, svg, video, canvas {
          max-width: 100% !important;
          height: auto !important;
          object-fit: contain !important;
        }

        table {
          max-width: 100% !important;
          width: auto !important;
          border-collapse: collapse !important;
        }

        pre, code {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
        }

        * {
          box-sizing: border-box !important;
        }
      `;
    } catch {
      // El iframe puede seguir funcionando aunque el navegador limite acceso.
    }
  });
}

function readLocalProgress(progressKey: string): SavedProgress {
  try {
    const raw = localStorage.getItem(localKey(progressKey));
    if (!raw) return { cfi: null, percent: 0 };

    const parsed = JSON.parse(raw) as {
      cfi?: unknown;
      percent?: unknown;
    };

    return {
      cfi:
        typeof parsed.cfi === "string" && parsed.cfi.trim()
          ? parsed.cfi.trim()
          : null,
      percent:
        typeof parsed.percent === "number" && Number.isFinite(parsed.percent)
          ? clamp(parsed.percent, 0, 100)
          : 0,
    };
  } catch {
    return { cfi: null, percent: 0 };
  }
}

export default function EpubReaderClient({
  title,
  epubUrl,
  progressUrl,
  progressKey,
  exitUrl,
  exitLabel,
  purchaseUrl,
  mode,
}: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const currentHrefRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const readyRef = useRef(false);
  const skipGuardRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [progress, setProgress] = useState(0);
  const [locationLabel, setLocationLabel] = useState("Inicio");
  const [moving, setMoving] = useState(false);

  const progressText = useMemo(
    () => `${Math.round(clamp(progress, 0, 100))}%`,
    [progress]
  );

  const persistProgress = useCallback(
    (cfi: string, percent: number) => {
      const normalized = clamp(percent, 0, 100);

      try {
        localStorage.setItem(
          localKey(progressKey),
          JSON.stringify({ cfi, percent: normalized })
        );
      } catch {
        // El progreso remoto sigue disponible.
      }

      if (mode !== "full" || !progressUrl) return;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        void fetch(progressUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentLocation: cfi,
            progressPercent: normalized,
            locationType: "epub_cfi",
          }),
        }).catch((saveError) => {
          console.warn("No se pudo guardar progreso EPUB:", saveError);
        });
      }, SAVE_DELAY_MS);
    },
    [mode, progressKey, progressUrl]
  );

  const loadSavedProgress = useCallback(async (): Promise<SavedProgress> => {
    const local = readLocalProgress(progressKey);

    if (mode !== "full" || !progressUrl) return local;

    try {
      const response = await fetch(progressUrl, { cache: "no-store" });
      if (!response.ok) return local;

      const payload = (await response.json()) as {
        progress?: {
          currentLocation?: unknown;
          progressPercent?: unknown;
        } | null;
      };

      const remote = payload.progress;
      const remoteLocation = remote?.currentLocation;
      const remotePercent = remote?.progressPercent;

      return {
        cfi:
          typeof remoteLocation === "string" &&
          remoteLocation.startsWith("epubcfi(")
            ? remoteLocation
            : local.cfi,
        percent:
          typeof remotePercent === "number" && Number.isFinite(remotePercent)
            ? clamp(remotePercent, 0, 100)
            : local.percent,
      };
    } catch {
      return local;
    }
  }, [mode, progressKey, progressUrl]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function boot() {
      const startedAt = performance.now();
      setLoading(true);
      setError("");
      readyRef.current = false;

      try {
        const savedPromise = loadSavedProgress();
        const response = await fetch(epubUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`EPUB HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          throw new Error("El endpoint devolvió JSON en vez del EPUB.");
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 4) {
          throw new Error("El EPUB recibido está vacío.");
        }

        if (cancelled) return;

        const imported = await import("epubjs");
        const factory = imported.default as unknown as EpubFactory;
        const book = factory(buffer);
        bookRef.current = book;

        if (book.ready) await book.ready;
        if (cancelled) return;

        const viewer = viewerRef.current;
        if (!viewer) return;

        const spineItems = book.spine?.spineItems ?? [];
        const firstReadable =
          spineItems.find((item) => !isSkippableSection(item.href)) ??
          book.spine?.first?.();

        const firstHref = firstReadable?.href?.trim() || undefined;

        console.info("EPUB first readable section:", {
          href: firstHref ?? null,
          idref: firstReadable?.idref ?? null,
          skippedNavigationItems: spineItems.filter((item) =>
            isSkippableSection(item.href)
          ).length,
        });

        const rect = viewer.getBoundingClientRect();
        const rendition = book.renderTo(viewer, {
          width: Math.max(320, Math.floor(rect.width)),
          height: Math.max(420, Math.floor(rect.height)),
          spread: "none",
          flow: "paginated",
          manager: "default",
        });

        renditionRef.current = rendition;

        rendition.themes.register?.("paper", {
          body: {
            color: "#172033 !important",
            background: "#fffdf8 !important",
          },
        });

        rendition.themes.register?.("night", {
          body: {
            color: "#e5e7eb !important",
            background: "#111827 !important",
          },
          a: {
            color: "#93c5fd !important",
          },
        });

        rendition.themes.select("paper");
        rendition.themes.fontSize("100%");

        rendition.on("rendered", () => {
          window.requestAnimationFrame(() => normalizeIframe(viewer));
        });

        rendition.on("relocated", (location) => {
          const cfi = location.start?.cfi?.trim() || null;
          const href = location.start?.href?.trim() || null;
          currentHrefRef.current = href;

          if (isSkippableSection(href) && !skipGuardRef.current) {
            skipGuardRef.current = true;
            void rendition.next().finally(() => {
              window.setTimeout(() => {
                skipGuardRef.current = false;
              }, 100);
            });
            return;
          }

          let nextPercent = progressRef.current;

          if (cfi) {
            try {
              const ratio = book.locations.percentageFromCfi(cfi);
              if (Number.isFinite(ratio)) {
                nextPercent = clamp(ratio * 100, 0, 100);
              }
            } catch {
              const current = Number(location.start?.displayed?.page);
              const total = Number(location.start?.displayed?.total);

              if (
                Number.isFinite(current) &&
                Number.isFinite(total) &&
                total > 0
              ) {
                nextPercent = clamp((current / total) * 100, 0, 100);
              }
            }
          }

          progressRef.current = nextPercent;
          setProgress(nextPercent);
          setLocationLabel(
            href
              ? href.split("/").pop()?.replace(/\.(xhtml|html)$/i, "") ||
                  "Página"
              : "Página"
          );

          if (readyRef.current && cfi) {
            persistProgress(cfi, nextPercent);
          }
        });

        const saved = await savedPromise;
        if (cancelled) return;

        if (saved.percent > 0) {
          progressRef.current = saved.percent;
          setProgress(saved.percent);
        }

        readyRef.current = true;

        if (saved.cfi) {
          try {
            await rendition.display(saved.cfi);
          } catch (savedError) {
            console.warn(
              "EPUB saved location inválida; abriendo sección inicial:",
              savedError
            );
            await rendition.display(firstHref);
          }
        } else {
          await rendition.display(firstHref);
        }

        normalizeIframe(viewer);
        setLoading(false);

        console.info(
          "EPUB first page ready:",
          `${Math.round(performance.now() - startedAt)}ms`
        );

        void book.locations
          .generate(1400)
          .then(() => console.info("EPUB locations listas en segundo plano."))
          .catch((locationsError) =>
            console.warn("EPUB locations no disponibles:", locationsError)
          );
      } catch (bootError) {
        if (controller.signal.aborted) return;
        console.error("EPUB reader error:", bootError);
        setLoading(false);
        setError(
          mode === "preview"
            ? "No se pudo abrir la muestra EPUB."
            : "No se pudo abrir el EPUB completo."
        );
      }
    }

    void boot();

    return () => {
      cancelled = true;
      controller.abort();
      readyRef.current = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [epubUrl, loadSavedProgress, mode, persistProgress]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const observer = new ResizeObserver(() => {
      const rendition = renditionRef.current;
      if (!rendition || !readyRef.current) return;

      const rect = viewer.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return;

      try {
        rendition.resize(
          Math.max(320, Math.floor(rect.width)),
          Math.max(420, Math.floor(rect.height))
        );
        window.requestAnimationFrame(() => normalizeIframe(viewer));
      } catch (resizeError) {
        console.warn("EPUB resize pospuesto:", resizeError);
      }
    });

    observer.observe(viewer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}%`);
  }, [fontSize]);

  useEffect(() => {
    renditionRef.current?.themes.select(theme);
  }, [theme]);

  const move = useCallback(async (direction: "prev" | "next") => {
    const rendition = renditionRef.current;
    if (!rendition || moving) return;

    setMoving(true);

    try {
      if (direction === "next") {
        await rendition.next();

        if (isSkippableSection(currentHrefRef.current)) {
          await rendition.next();
        }
      } else {
        await rendition.prev();

        if (isSkippableSection(currentHrefRef.current)) {
          await rendition.prev();
        }
      }

      window.requestAnimationFrame(() => normalizeIframe(viewerRef.current));
    } finally {
      window.setTimeout(() => setMoving(false), 100);
    }
  }, [moving]);

  return (
    <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#071018] text-white">
      <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-[#09131d] px-3 shadow-lg sm:px-5">
        <a
          href={exitUrl}
          title={exitLabel}
          aria-label={exitLabel}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xl text-white/85 hover:bg-white/[0.12]"
        >
          ‹
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
            <span>{mode === "preview" ? "Muestra EPUB" : "EPUB"}</span>
            <span className="text-white/30">·</span>
            <span className="truncate text-white/40">{locationLabel}</span>
          </div>
          <h1 className="mt-0.5 truncate text-sm font-semibold text-white/95 sm:text-[15px]">
            {title}
          </h1>
        </div>

        {mode === "preview" && purchaseUrl ? (
          <a
            href={purchaseUrl}
            className="hidden rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 sm:inline-flex"
          >
            Comprar
          </a>
        ) : null}

        <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1 sm:flex">
          <button
            type="button"
            onClick={() =>
              setFontSize((value) =>
                clamp(value - FONT_STEP, MIN_FONT, MAX_FONT)
              )
            }
            className="h-8 rounded-lg px-2 text-sm font-semibold text-white/70 hover:bg-white/10"
            aria-label="Reducir texto"
          >
            A−
          </button>
          <span className="min-w-12 text-center text-[11px] text-white/45">
            {fontSize}%
          </span>
          <button
            type="button"
            onClick={() =>
              setFontSize((value) =>
                clamp(value + FONT_STEP, MIN_FONT, MAX_FONT)
              )
            }
            className="h-8 rounded-lg px-2 text-sm font-semibold text-white/70 hover:bg-white/10"
            aria-label="Aumentar texto"
          >
            A+
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            setTheme((value) => (value === "paper" ? "night" : "paper"))
          }
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"
          aria-label="Cambiar tema"
        >
          {theme === "paper" ? "◐" : "☀"}
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.10),transparent_36%),#071018] px-1.5 py-2 sm:px-3 sm:py-3 lg:px-5">
        <div
          ref={viewerRef}
          className="relative mx-auto h-full min-h-0 w-full max-w-[1060px] overflow-hidden rounded-[18px] border border-white/10 bg-[#fffdf8] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
        />

        {!loading && !error ? (
          <>
            <button
              type="button"
              onClick={() => void move("prev")}
              disabled={moving}
              className="absolute left-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#08111a]/85 text-3xl text-white shadow-xl backdrop-blur hover:bg-[#0f2030] disabled:opacity-40 sm:left-4"
              aria-label="Página anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => void move("next")}
              disabled={moving}
              className="absolute right-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#08111a]/85 text-3xl text-white shadow-xl backdrop-blur hover:bg-[#0f2030] disabled:opacity-40 sm:right-4"
              aria-label="Página siguiente"
            >
              ›
            </button>
          </>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 z-20 grid place-items-center">
            <div className="rounded-2xl border border-white/10 bg-[#08111a]/95 px-6 py-5 text-center shadow-2xl">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
              <p className="mt-3 text-sm font-medium text-white/80">
                Preparando tu libro…
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-20 grid place-items-center p-6">
            <div className="max-w-md rounded-3xl border border-rose-300/20 bg-[#161016]/95 p-7 text-center shadow-2xl">
              <p className="text-lg font-semibold">No pudimos abrir este EPUB</p>
              <p className="mt-2 text-sm leading-6 text-white/55">{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="z-30 shrink-0 border-t border-white/10 bg-[#09131d] px-3 py-2.5 sm:px-5">
        <div className="mx-auto flex max-w-[1060px] items-center gap-3">
          <button
            type="button"
            onClick={() => void move("prev")}
            disabled={moving || loading || Boolean(error)}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/70 disabled:opacity-30 sm:hidden"
          >
            Anterior
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              <span>{mode === "preview" ? "Vista previa" : "Progreso"}</span>
              <span className="text-emerald-300">{progressText}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-300"
                style={{ width: `${clamp(progress, 0, 100)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void move("next")}
            disabled={moving || loading || Boolean(error)}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/70 disabled:opacity-30 sm:hidden"
          >
            Siguiente
          </button>
        </div>
      </footer>
    </section>
  );
}
