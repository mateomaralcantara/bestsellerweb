"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReaderTheme = "paper" | "night";

type EpubLocation = {
  atEnd?: boolean;
  atStart?: boolean;
  start?: {
    cfi?: unknown;
    href?: unknown;
    percentage?: unknown;
    displayed?: {
      page?: unknown;
      total?: unknown;
    };
  };
};

type SpineItem = {
  href?: unknown;
  idref?: unknown;
  linear?: unknown;
};

type EpubBook = {
  ready?: Promise<unknown>;
  package?: {
    metadata?: {
      layout?: unknown;
      rendition?: {
        layout?: unknown;
      };
    };
  };
  packaging?: {
    metadata?: {
      layout?: unknown;
      rendition?: {
        layout?: unknown;
      };
    };
  };
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

type FixedFitSize = {
  width: number;
  height: number;
};

const MIN_FONT = 85;
const MAX_FONT = 150;
const FONT_STEP = 10;
const MIN_PAGE_ZOOM = 60;
const MAX_PAGE_ZOOM = 180;
const PAGE_ZOOM_STEP = 10;
const SAVE_DELAY_MS = 600;
const LOCATION_CHARS = 900;
const VIEWPORT_WIDTH_RESERVE = 4;
const VIEWPORT_HEIGHT_RESERVE = 10;
const FIXED_LAYOUT_DEFAULT_RATIO = 2 / 3;
const FIXED_STAGE_MARGIN = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";

  try {
    return String(value).trim();
  } catch {
    return "";
  }
}

function normalizeHref(value: unknown) {
  return asText(value)
    .split("#")[0]
    .replace(/^\.\//, "")
    .replace(/^\//, "")
    .toLowerCase();
}

function isSkippableSection(href: unknown) {
  const normalized = normalizeHref(href);

  return (
    normalized.endsWith("nav.xhtml") ||
    normalized.endsWith("nav.html") ||
    normalized.endsWith("toc.xhtml") ||
    normalized.endsWith("toc.html")
  );
}

function isNonLinear(value: unknown) {
  if (value === false || value === 0) return true;
  if (value === true || value === 1 || value === null || value === undefined) {
    return false;
  }

  const normalized = asText(value).toLowerCase();
  return normalized === "no" || normalized === "false" || normalized === "0";
}

function isReadableSpineItem(item: SpineItem) {
  return !isNonLinear(item.linear) && !isSkippableSection(item.href);
}

function isFixedLayout(book: EpubBook) {
  const metadata = book.package?.metadata ?? book.packaging?.metadata;
  const layout = asText(
    metadata?.layout ?? metadata?.rendition?.layout
  ).toLowerCase();

  return layout.includes("pre-paginated") || layout.includes("fixed");
}

function localKey(progressKey: string) {
  return `libroseller:epub:${progressKey}`;
}

function getViewportSize(viewer: HTMLElement) {
  const rect = viewer.getBoundingClientRect();

  return {
    width: Math.max(1, Math.floor(rect.width) - VIEWPORT_WIDTH_RESERVE),
    height: Math.max(1, Math.floor(rect.height) - VIEWPORT_HEIGHT_RESERVE),
  };
}

function fitFixedPage(
  containerWidth: number,
  containerHeight: number,
  ratio: number
): FixedFitSize {
  const safeRatio =
    Number.isFinite(ratio) && ratio > 0 ? ratio : FIXED_LAYOUT_DEFAULT_RATIO;
  const maxWidth = Math.max(1, containerWidth - FIXED_STAGE_MARGIN * 2);
  const maxHeight = Math.max(1, containerHeight - FIXED_STAGE_MARGIN * 2);

  let height = maxHeight;
  let width = height * safeRatio;

  if (width > maxWidth) {
    width = maxWidth;
    height = width / safeRatio;
  }

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

function readFixedLayoutRatio(viewer: HTMLElement) {
  try {
    const iframe = viewer.querySelector<HTMLIFrameElement>("iframe");
    const viewportMeta = iframe?.contentDocument
      ?.querySelector('meta[name="viewport"]')
      ?.getAttribute("content");

    if (!viewportMeta) return null;

    const width = Number(
      viewportMeta.match(/(?:^|[,;]\s*)width\s*=\s*([0-9.]+)/i)?.[1]
    );
    const height = Number(
      viewportMeta.match(/(?:^|[,;]\s*)height\s*=\s*([0-9.]+)/i)?.[1]
    );

    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
      return null;
    }

    const ratio = width / height;
    return ratio >= 0.25 && ratio <= 4 ? ratio : null;
  } catch {
    return null;
  }
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
      cfi: asText(parsed.cfi) || null,
      percent:
        typeof parsed.percent === "number" && Number.isFinite(parsed.percent)
          ? clamp(parsed.percent, 0, 100)
          : 0,
    };
  } catch {
    return { cfi: null, percent: 0 };
  }
}

function clearLocalProgress(progressKey: string) {
  try {
    localStorage.removeItem(localKey(progressKey));
  } catch {
    // El progreso remoto puede corregirse en la próxima reubicación.
  }
}

function findSpineIndex(readableSpine: SpineItem[], href: unknown) {
  const target = normalizeHref(href);
  if (!target) return -1;

  const exact = readableSpine.findIndex(
    (item) => normalizeHref(item.href) === target
  );
  if (exact >= 0) return exact;

  const targetName = target.split("/").pop() || target;

  return readableSpine.findIndex((item) => {
    const candidate = normalizeHref(item.href);
    return candidate === targetName || candidate.endsWith(`/${targetName}`);
  });
}

function progressFromLocation(params: {
  book: EpubBook;
  location: EpubLocation;
  readableSpine: SpineItem[];
  locationsReady: boolean;
  previous: number;
}) {
  const { book, location, readableSpine, locationsReady, previous } = params;
  const cfi = asText(location.start?.cfi);

  if (location.atEnd) return 100;
  if (location.atStart) return 0;

  if (locationsReady && cfi) {
    try {
      const ratio = book.locations.percentageFromCfi(cfi);
      if (Number.isFinite(ratio)) {
        return clamp(ratio * 100, 0, 100);
      }
    } catch {
      // Se continúa con el cálculo estructural.
    }
  }

  const sectionIndex = findSpineIndex(readableSpine, location.start?.href);

  if (sectionIndex >= 0 && readableSpine.length > 0) {
    const page = Number(location.start?.displayed?.page);
    const total = Number(location.start?.displayed?.total);
    const pageFraction =
      Number.isFinite(page) && Number.isFinite(total) && total > 0
        ? clamp((page - 1) / total, 0, 0.999)
        : 0;

    return clamp(
      ((sectionIndex + pageFraction) / readableSpine.length) * 100,
      0,
      99.9
    );
  }

  const reported = Number(location.start?.percentage);
  if (Number.isFinite(reported)) {
    const normalized = reported <= 1 ? reported * 100 : reported;
    if (normalized >= 0 && normalized <= 100) {
      return normalized;
    }
  }

  return clamp(previous, 0, 100);
}

function paperRules(
  fixedLayout: boolean
): Record<string, Record<string, string>> {
  if (fixedLayout) {
    return {
      body: {
        color: "#172033 !important",
        background: "#fffdf8 !important",
      },
    };
  }

  return {
    body: {
      color: "#172033 !important",
      background: "#fffdf8 !important",
      "text-align": "center !important",
      "text-rendering": "optimizeLegibility !important",
      "-webkit-font-smoothing": "antialiased !important",
    },
    "h1, h2, h3, h4, h5, h6": {
      "text-align": "center !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
    },
    "p, li, blockquote": {
      "text-align": "center !important",
      orphans: "2 !important",
      widows: "2 !important",
    },
    "ul, ol": {
      "list-style-position": "inside !important",
      "padding-left": "0 !important",
      "text-align": "center !important",
    },
    "figure, figcaption": {
      "text-align": "center !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
    },
    "img, svg, video, canvas": {
      "max-width": "100% !important",
      height: "auto !important",
      "object-fit": "contain !important",
      display: "block !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
    },
    table: {
      "max-width": "100% !important",
      "border-collapse": "collapse !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
      "text-align": "center !important",
    },
    "th, td": {
      "text-align": "center !important",
    },
    "pre, code": {
      "white-space": "pre-wrap !important",
      "overflow-wrap": "anywhere !important",
      "text-align": "center !important",
    },
  };
}

function nightRules(
  fixedLayout: boolean
): Record<string, Record<string, string>> {
  const base = paperRules(fixedLayout);

  return {
    ...base,
    body: {
      ...base.body,
      color: "#e5e7eb !important",
      background: "#111827 !important",
    },
    a: {
      color: "#93c5fd !important",
    },
  };
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const currentHrefRef = useRef<string | null>(null);
  const currentCfiRef = useRef<string | null>(null);
  const readableSpineRef = useRef<SpineItem[]>([]);
  const progressRef = useRef(0);
  const readyRef = useRef(false);
  const locationsReadyRef = useRef(false);
  const fixedLayoutRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(100);
  const [pageZoom, setPageZoom] = useState(100);
  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [progress, setProgress] = useState(0);
  const [locationLabel, setLocationLabel] = useState("Inicio");
  const [moving, setMoving] = useState(false);
  const [fixedLayout, setFixedLayout] = useState(false);
  const [fixedPageRatio, setFixedPageRatio] = useState(
    FIXED_LAYOUT_DEFAULT_RATIO
  );
  const [fixedFitSize, setFixedFitSize] = useState<FixedFitSize>({
    width: 400,
    height: 600,
  });

  const progressText = useMemo(
    () => `${Math.round(clamp(progress, 0, 100))}%`,
    [progress]
  );

  const readerScale = fixedLayout ? pageZoom : fontSize;
  const readerScaleMin = fixedLayout ? MIN_PAGE_ZOOM : MIN_FONT;
  const readerScaleMax = fixedLayout ? MAX_PAGE_ZOOM : MAX_FONT;
  const readerScaleStep = fixedLayout ? PAGE_ZOOM_STEP : FONT_STEP;

  const fixedRenderedWidth = Math.max(
    1,
    Math.round(fixedFitSize.width * (pageZoom / 100))
  );
  const fixedRenderedHeight = Math.max(
    1,
    Math.round(fixedFitSize.height * (pageZoom / 100))
  );
  const fixedCanvasWidth = fixedRenderedWidth + FIXED_STAGE_MARGIN * 2;
  const fixedCanvasHeight = fixedRenderedHeight + FIXED_STAGE_MARGIN * 2;

  const applyProgress = useCallback((percent: number) => {
    const normalized = clamp(percent, 0, 100);
    progressRef.current = normalized;
    setProgress(normalized);
  }, []);

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
        void (async () => {
          try {
            const response = await fetch(progressUrl, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                currentLocation: cfi,
                progressPercent: normalized,
                locationType: "epub_cfi",
              }),
            });

            if (!response.ok) {
              console.warn(
                "No se pudo guardar progreso EPUB:",
                response.status
              );
            }
          } catch (saveError) {
            console.warn("No se pudo guardar progreso EPUB:", saveError);
          }
        })();
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
      const remoteCfi = asText(remote?.currentLocation);
      const remotePercent = Number(remote?.progressPercent);

      return {
        cfi: remoteCfi.startsWith("epubcfi(") ? remoteCfi : local.cfi,
        percent: Number.isFinite(remotePercent)
          ? clamp(remotePercent, 0, 100)
          : local.percent,
      };
    } catch {
      return local;
    }
  }, [mode, progressKey, progressUrl]);

  const changeReaderScale = useCallback(
    (direction: -1 | 1) => {
      if (fixedLayout) {
        setPageZoom((value) =>
          clamp(
            value + direction * PAGE_ZOOM_STEP,
            MIN_PAGE_ZOOM,
            MAX_PAGE_ZOOM
          )
        );
        return;
      }

      setFontSize((value) =>
        clamp(value + direction * FONT_STEP, MIN_FONT, MAX_FONT)
      );
    },
    [fixedLayout]
  );

  const setReaderScale = useCallback(
    (value: number) => {
      if (fixedLayout) {
        setPageZoom(clamp(value, MIN_PAGE_ZOOM, MAX_PAGE_ZOOM));
      } else {
        setFontSize(clamp(value, MIN_FONT, MAX_FONT));
      }
    },
    [fixedLayout]
  );

  const resetReaderScale = useCallback(() => {
    if (fixedLayout) {
      setPageZoom(100);
    } else {
      setFontSize(100);
    }
  }, [fixedLayout]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function boot() {
      const startedAt = performance.now();
      setLoading(true);
      setError("");
      readyRef.current = false;
      locationsReadyRef.current = false;
      currentCfiRef.current = null;
      currentHrefRef.current = null;
      setFixedLayout(false);
      setFixedPageRatio(FIXED_LAYOUT_DEFAULT_RATIO);
      setPageZoom(100);

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

        const detectedFixedLayout = isFixedLayout(book);
        fixedLayoutRef.current = detectedFixedLayout;
        setFixedLayout(detectedFixedLayout);

        if (detectedFixedLayout) {
          const stage = stageRef.current;
          if (stage) {
            const rect = stage.getBoundingClientRect();
            setFixedFitSize(
              fitFixedPage(
                rect.width,
                rect.height,
                FIXED_LAYOUT_DEFAULT_RATIO
              )
            );
          }

          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() =>
              window.requestAnimationFrame(() => resolve())
            );
          });
        }

        if (cancelled) return;

        const viewer = viewerRef.current;
        if (!viewer) {
          throw new Error("No se encontró el canvas del lector EPUB.");
        }

        const spineItems = Array.isArray(book.spine?.spineItems)
          ? book.spine?.spineItems ?? []
          : [];
        const readableSpine = spineItems.filter(isReadableSpineItem);
        readableSpineRef.current = readableSpine;

        const firstReadable = readableSpine[0] ?? book.spine?.first?.();
        const firstHref = asText(firstReadable?.href) || undefined;

        console.info("EPUB first readable section:", {
          href: firstHref ?? null,
          idref: asText(firstReadable?.idref) || null,
          fixedLayout: fixedLayoutRef.current,
          readableSections: readableSpine.length,
          skippedNavigationItems: spineItems.filter((item) =>
            isSkippableSection(item.href)
          ).length,
        });

        const viewport = getViewportSize(viewer);
        const rendition = book.renderTo(viewer, {
          width: viewport.width,
          height: viewport.height,
          spread: "none",
          flow: "paginated",
          manager: "default",
        });
        renditionRef.current = rendition;

        rendition.themes.register?.(
          "paper",
          paperRules(fixedLayoutRef.current)
        );
        rendition.themes.register?.(
          "night",
          nightRules(fixedLayoutRef.current)
        );
        rendition.themes.select("paper");

        if (!fixedLayoutRef.current) {
          rendition.themes.fontSize("100%");
        }

        rendition.on("rendered", () => {
          if (!fixedLayoutRef.current) return;

          window.requestAnimationFrame(() => {
            const currentViewer = viewerRef.current;
            if (!currentViewer) return;

            const ratio = readFixedLayoutRatio(currentViewer);
            if (!ratio) return;

            setFixedPageRatio((previous) =>
              Math.abs(previous - ratio) > 0.001 ? ratio : previous
            );
          });
        });

        rendition.on("relocated", (location) => {
          const cfi = asText(location.start?.cfi) || null;
          const href = asText(location.start?.href) || null;
          currentCfiRef.current = cfi;
          currentHrefRef.current = href;

          const nextPercent = progressFromLocation({
            book,
            location,
            readableSpine: readableSpineRef.current,
            locationsReady: locationsReadyRef.current,
            previous: progressRef.current,
          });

          applyProgress(nextPercent);
          setLocationLabel(
            href
              ? href.split("/").pop()?.replace(/\.(xhtml|html)$/i, "") ||
                  "Página"
              : "Página"
          );

          if (readyRef.current && cfi && !isSkippableSection(href)) {
            persistProgress(cfi, nextPercent);
          }
        });

        const saved = await savedPromise;
        if (cancelled) return;

        if (saved.percent > 0) {
          applyProgress(saved.percent);
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
            clearLocalProgress(progressKey);
            await rendition.display(firstHref);
          }
        } else {
          await rendition.display(firstHref);
        }

        setLoading(false);
        console.info(
          "EPUB first page ready:",
          `${Math.round(performance.now() - startedAt)}ms`
        );

        void book.locations
          .generate(LOCATION_CHARS)
          .then(() => {
            if (cancelled) return;

            locationsReadyRef.current = true;
            console.info("EPUB locations listas en segundo plano.");

            const cfi = currentCfiRef.current;
            if (!cfi) return;

            try {
              const ratio = book.locations.percentageFromCfi(cfi);
              if (!Number.isFinite(ratio)) return;

              const exactPercent = clamp(ratio * 100, 0, 100);
              applyProgress(exactPercent);

              if (readyRef.current) {
                persistProgress(cfi, exactPercent);
              }
            } catch (locationsError) {
              console.warn(
                "No se pudo recalcular progreso EPUB:",
                locationsError
              );
            }
          })
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
      locationsReadyRef.current = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [
    applyProgress,
    epubUrl,
    loadSavedProgress,
    mode,
    persistProgress,
    progressKey,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !fixedLayout) return;

    const updateFit = () => {
      const rect = stage.getBoundingClientRect();
      const next = fitFixedPage(rect.width, rect.height, fixedPageRatio);

      setFixedFitSize((previous) =>
        previous.width === next.width && previous.height === next.height
          ? previous
          : next
      );
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [fixedLayout, fixedPageRatio]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const observer = new ResizeObserver(() => {
      const rendition = renditionRef.current;
      if (!rendition || !readyRef.current) return;

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        const currentViewer = viewerRef.current;
        const currentRendition = renditionRef.current;
        if (!currentViewer || !currentRendition || !readyRef.current) return;

        const viewport = getViewportSize(currentViewer);

        try {
          currentRendition.resize(viewport.width, viewport.height);
        } catch (resizeError) {
          console.warn("EPUB resize pospuesto:", resizeError);
        }
      });
    });

    observer.observe(viewer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fixedLayout) return;

    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;

      scroller.scrollLeft = Math.max(
        0,
        (scroller.scrollWidth - scroller.clientWidth) / 2
      );
      scroller.scrollTop = Math.max(
        0,
        (scroller.scrollHeight - scroller.clientHeight) / 2
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fixedLayout, fixedFitSize, pageZoom]);

  useEffect(() => {
    if (fixedLayoutRef.current) return;
    renditionRef.current?.themes.fontSize(`${fontSize}%`);
  }, [fontSize]);

  useEffect(() => {
    renditionRef.current?.themes.select(theme);
  }, [theme]);

  const move = useCallback(
    async (direction: "prev" | "next") => {
      const rendition = renditionRef.current;
      if (!rendition || moving) return;

      setMoving(true);

      try {
        const advance =
          direction === "next"
            ? rendition.next.bind(rendition)
            : rendition.prev.bind(rendition);

        await advance();

        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (!isSkippableSection(currentHrefRef.current)) break;
          await advance();
        }
      } catch (moveError) {
        console.warn("No se pudo cambiar de página EPUB:", moveError);
      } finally {
        window.setTimeout(() => setMoving(false), 100);
      }
    },
    [moving]
  );

  return (
    <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#071018] text-white">
      <header className="z-30 flex h-16 shrink-0 items-center gap-2 border-b border-white/10 bg-[#09131d] px-2 shadow-lg sm:gap-3 sm:px-5">
        <a
          href={exitUrl}
          title={exitLabel}
          aria-label={exitLabel}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xl text-white/85 hover:bg-white/[0.12]"
        >
          ‹
        </a>

        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
            <span>{mode === "preview" ? "Muestra EPUB" : "EPUB"}</span>
            <span className="text-white/30">·</span>
            <span className="truncate text-white/40">{locationLabel}</span>
          </div>
          <h1 className="mt-0.5 truncate text-center text-xs font-semibold text-white/95 sm:text-[15px]">
            {title}
          </h1>
        </div>

        {mode === "preview" && purchaseUrl ? (
          <a
            href={purchaseUrl}
            className="hidden rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 lg:inline-flex"
          >
            Comprar
          </a>
        ) : null}

        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1 shadow-inner">
          <span className="hidden px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35 xl:inline">
            {fixedLayout ? "Zoom" : "Texto"}
          </span>

          <button
            type="button"
            onClick={() => changeReaderScale(-1)}
            disabled={readerScale <= readerScaleMin}
            className="h-8 min-w-8 rounded-lg px-2 text-sm font-bold text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={fixedLayout ? "Reducir página" : "Reducir texto"}
            title={fixedLayout ? "Reducir página" : "Reducir texto"}
          >
            {fixedLayout ? "−" : "A−"}
          </button>

          <input
            type="range"
            min={readerScaleMin}
            max={readerScaleMax}
            step={readerScaleStep}
            value={readerScale}
            onChange={(event) => setReaderScale(Number(event.target.value))}
            className="hidden w-24 cursor-pointer accent-emerald-400 xl:block"
            aria-label={fixedLayout ? "Zoom de página" : "Tamaño del texto"}
          />

          <button
            type="button"
            onClick={resetReaderScale}
            className="min-w-12 rounded-lg px-1.5 py-1.5 text-center text-[11px] font-semibold text-emerald-300 hover:bg-white/10 sm:min-w-14"
            title="Restablecer a 100%"
            aria-label="Restablecer a 100%"
          >
            {readerScale}%
          </button>

          <button
            type="button"
            onClick={() => changeReaderScale(1)}
            disabled={readerScale >= readerScaleMax}
            className="h-8 min-w-8 rounded-lg px-2 text-sm font-bold text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={fixedLayout ? "Agrandar página" : "Aumentar texto"}
            title={fixedLayout ? "Agrandar página" : "Aumentar texto"}
          >
            {fixedLayout ? "+" : "A+"}
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            setTheme((value) => (value === "paper" ? "night" : "paper"))
          }
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"
          aria-label="Cambiar tema"
        >
          {theme === "paper" ? "◐" : "☀"}
        </button>
      </header>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.10),transparent_36%),#071018]"
      >
        <div
          ref={scrollRef}
          className={
            fixedLayout
              ? "absolute inset-0 overflow-auto overscroll-contain"
              : "absolute inset-0 overflow-hidden"
          }
        >
          <div
            className={
              fixedLayout
                ? "grid place-items-center"
                : "h-full w-full px-1.5 py-2 sm:px-3 sm:py-3 lg:px-5"
            }
            style={
              fixedLayout
                ? {
                    width: `max(100%, ${fixedCanvasWidth}px)`,
                    height: `max(100%, ${fixedCanvasHeight}px)`,
                  }
                : undefined
            }
          >
            <div
              className={
                fixedLayout
                  ? "relative flex-none overflow-hidden rounded-[18px] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
                  : "relative mx-auto h-full min-h-0 w-full max-w-[1060px] overflow-hidden rounded-[18px] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
              }
              style={{
                background: theme === "night" ? "#111827" : "#fffdf8",
                ...(fixedLayout
                  ? {
                      width: `${fixedRenderedWidth}px`,
                      height: `${fixedRenderedHeight}px`,
                      aspectRatio: String(fixedPageRatio),
                    }
                  : {}),
              }}
            >
              <div
                className="absolute"
                style={
                  fixedLayout
                    ? { inset: "0" }
                    : {
                        top: "clamp(16px, 2.5vh, 30px)",
                        right: "clamp(20px, 4vw, 54px)",
                        bottom: "clamp(28px, 4vh, 48px)",
                        left: "clamp(20px, 4vw, 54px)",
                      }
                }
              >
                <div
                  ref={viewerRef}
                  className="h-full min-h-0 w-full overflow-hidden"
                />
              </div>
            </div>
          </div>
        </div>

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
          <div className="absolute inset-0 z-30 grid place-items-center">
            <div className="rounded-2xl border border-white/10 bg-[#08111a]/95 px-6 py-5 text-center shadow-2xl">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
              <p className="mt-3 text-sm font-medium text-white/80">
                Preparando tu libro…
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-30 grid place-items-center p-6">
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
