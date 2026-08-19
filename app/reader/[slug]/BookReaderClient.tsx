"use client";

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeft,
  RotateCcw,
  Square,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

type BookReaderClientProps = {
  title: string;
  coverUrl: string | null;
  pdfUrl: string;
  progressUrl: string;
};

type ViewMode = "single" | "spread";
type FitMode = "page" | "width";
type ReaderTheme = "paper" | "sepia" | "night";
type ProgressSaveStatus =
  | "loading"
  | "ready"
  | "restored"
  | "saving"
  | "saved"
  | "local";

type ProgressSnapshot = {
  currentPage: number;
  totalPages: number;
  updatedAt: string;
};

type ProgressRestoreResult = {
  snapshot: ProgressSnapshot | null;
  source: "server" | "local" | null;
};

type StageSize = {
  width: number;
  height: number;
};

type DragState = {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const TOOLBAR_HEIGHT_ALLOWANCE = 24;
const PROGRESS_SAVE_DELAY = 750;
const CHROME_HIDE_DELAY = 2800;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;

  return (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  );
}

function parseProgressSnapshot(value: unknown): ProgressSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const progress = value as Record<string, unknown>;
  const currentPage = Math.round(Number(progress.currentPage));
  const totalPages = Math.round(Number(progress.totalPages));
  const updatedAt =
    typeof progress.updatedAt === "string" && progress.updatedAt
      ? progress.updatedAt
      : new Date(0).toISOString();

  if (
    !Number.isFinite(currentPage) ||
    !Number.isFinite(totalPages) ||
    currentPage < 1 ||
    totalPages < 1
  ) {
    return null;
  }

  return {
    currentPage,
    totalPages,
    updatedAt,
  };
}

function getSnapshotTime(snapshot: ProgressSnapshot | null) {
  if (!snapshot) return 0;

  const time = new Date(snapshot.updatedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function readLocalProgress(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? parseProgressSnapshot(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function writeLocalProgress(key: string, snapshot: ProgressSnapshot) {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // El servidor seguirá guardando el avance si localStorage está bloqueado.
  }
}

function getPageScale(params: {
  page: PDFPageProxy;
  fitMode: FitMode;
  zoom: number;
  rotation: number;
  availableWidth: number;
  availableHeight: number;
}) {
  const {
    page,
    fitMode,
    zoom,
    rotation,
    availableWidth,
    availableHeight,
  } = params;

  const baseViewport = page.getViewport({ scale: 1, rotation });

  const widthScale = Math.max(0.1, availableWidth / baseViewport.width);
  const heightScale = Math.max(0.1, availableHeight / baseViewport.height);
  const fittedScale =
    fitMode === "width" ? widthScale : Math.min(widthScale, heightScale);

  return Math.max(0.1, fittedScale * zoom);
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  fitMode,
  zoom,
  rotation,
  availableWidth,
  availableHeight,
  theme,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  fitMode: FitMode;
  zoom: number;
  rotation: number;
  availableWidth: number;
  availableHeight: number;
  theme: ReaderTheme;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const dark = theme === "night";

  useEffect(() => {
    let cancelled = false;
    let page: PDFPageProxy | null = null;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;

    async function renderPage() {
      try {
        setRendering(true);
        setRenderError(false);

        page = await pdf.getPage(pageNumber);

        if (cancelled || !canvasRef.current) return;

        const scale = getPageScale({
          page,
          fitMode,
          zoom,
          rotation,
          availableWidth,
          availableHeight,
        });

        const cssViewport = page.getViewport({ scale, rotation });
        const outputScale = clamp(window.devicePixelRatio || 1, 1, 2);
        const renderViewport = page.getViewport({
          scale: scale * outputScale,
          rotation,
        });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error("No fue posible preparar el lienzo del PDF.");
        }

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${Math.ceil(cssViewport.width)}px`;
        canvas.style.height = `${Math.ceil(cssViewport.height)}px`;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
        });

        await renderTask.promise;

        if (!cancelled) {
          setRendering(false);
        }
      } catch (error) {
        const name =
          error && typeof error === "object" && "name" in error
            ? String(error.name)
            : "";

        if (!cancelled && name !== "RenderingCancelledException") {
          setRendering(false);
          setRenderError(true);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [
    availableHeight,
    availableWidth,
    fitMode,
    pageNumber,
    pdf,
    rotation,
    zoom,
  ]);

  return (
    <article className="relative shrink-0">
      <div
        className={[
          "relative overflow-hidden rounded-md bg-white",
          dark
            ? "shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
            : "shadow-[0_24px_70px_rgba(15,23,42,0.18)]",
        ].join(" ")}
      >
        <canvas
          ref={canvasRef}
          aria-label={`Página ${pageNumber}`}
          className={[
            "block max-w-none bg-white transition-[filter] duration-200",
            theme === "sepia"
              ? "sepia-[0.18] brightness-[0.98]"
              : theme === "night"
                ? "brightness-[0.78] contrast-[0.94]"
                : "",
          ].join(" ")}
        />

        {rendering ? (
          <div className="absolute inset-0 flex min-h-80 min-w-56 items-center justify-center bg-white/95">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        ) : null}

        {renderError ? (
          <div className="absolute inset-0 flex min-h-80 min-w-56 items-center justify-center bg-red-50 px-6 text-center text-sm font-medium text-red-700">
            No se pudo mostrar esta página.
          </div>
        ) : null}
      </div>

      <span className="sr-only">Página {pageNumber}</span>
    </article>
  );
}

function PdfThumbnail({
  pdf,
  pageNumber,
  active,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  active: boolean;
  onSelect: () => void;
}) {
  const wrapperRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
    }
  }, [active]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let page: PDFPageProxy | null = null;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;

    async function renderThumbnail() {
      page = await pdf.getPage(pageNumber);

      if (cancelled || !canvasRef.current) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 118 / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) return;

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });

      try {
        await renderTask.promise;
      } catch {
        // Una miniatura no debe bloquear el lector completo.
      }
    }

    void renderThumbnail();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [pageNumber, pdf, visible]);

  return (
    <button
      ref={wrapperRef}
      type="button"
      data-page={pageNumber}
      onClick={onSelect}
      className={[
        "group mx-auto block w-[142px] rounded-xl border p-2 text-left transition",
        active
          ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
          : "border-slate-700 bg-slate-900 hover:border-slate-500",
      ].join(" ")}
      aria-label={`Ir a la página ${pageNumber}`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-md bg-white shadow">
        {visible ? (
          <canvas ref={canvasRef} className="block bg-white" />
        ) : (
          <div className="h-36 w-28 animate-pulse bg-slate-200" />
        )}
      </div>

      <span
        className={[
          "mt-2 block text-center text-xs font-bold",
          active ? "text-blue-300" : "text-slate-400",
        ].join(" ")}
      >
        {pageNumber}
      </span>
    </button>
  );
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border px-2.5 text-sm font-bold transition",
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
        "disabled:cursor-not-allowed disabled:opacity-35",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function BookReaderClient({
  title,
  coverUrl,
  pdfUrl,
  progressUrl,
}: BookReaderClientProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const progressInitializedRef = useRef(false);
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(0);
  const lastServerSavedPageRef = useRef<number | null>(null);
  const chromeTimerRef = useRef<number | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageSize, setStageSize] = useState<StageSize>({
    width: 1100,
    height: 720,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [progressSaveStatus, setProgressSaveStatus] =
    useState<ProgressSaveStatus>("loading");
  const [restoredPage, setRestoredPage] = useState<number | null>(null);

  const totalPages = pdf?.numPages ?? 0;
  const isCompact = stageSize.width < 820;
  const effectiveViewMode: ViewMode = isCompact ? "single" : viewMode;
  const pageStep = effectiveViewMode === "spread" ? 2 : 1;
  const dark = theme === "night";
  const localProgressKey = useMemo(
    () => `bestseller-reader-progress:${progressUrl}`,
    [progressUrl]
  );

  const loadSavedProgress = useCallback(async (): Promise<ProgressRestoreResult> => {
    const localSnapshot = readLocalProgress(localProgressKey);
    let serverSnapshot: ProgressSnapshot | null = null;

    try {
      const response = await fetch(progressUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.ok) {
        const body = (await response.json()) as { progress?: unknown };
        serverSnapshot = parseProgressSnapshot(body.progress);
      }
    } catch {
      // La copia local permite continuar incluso sin conexión momentánea.
    }

    if (
      localSnapshot &&
      (!serverSnapshot ||
        getSnapshotTime(localSnapshot) > getSnapshotTime(serverSnapshot))
    ) {
      return {
        snapshot: localSnapshot,
        source: "local",
      };
    }

    if (serverSnapshot) {
      return {
        snapshot: serverSnapshot,
        source: "server",
      };
    }

    return {
      snapshot: localSnapshot,
      source: localSnapshot ? "local" : null,
    };
  }, [localProgressKey, progressUrl]);

  const saveProgressToServer = useCallback(
    async (snapshot: ProgressSnapshot) => {
      writeLocalProgress(localProgressKey, snapshot);
      setProgressSaveStatus("saving");

      try {
        const response = await fetch(progressUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            currentPage: snapshot.currentPage,
            totalPages: snapshot.totalPages,
          }),
        });

        if (!response.ok) {
          setProgressSaveStatus("local");
          return;
        }

        lastServerSavedPageRef.current = snapshot.currentPage;
        setProgressSaveStatus("saved");
      } catch {
        setProgressSaveStatus("local");
      }
    },
    [localProgressKey, progressUrl]
  );

  const setSafePage = useCallback(
    (page: number) => {
      const safePage = clamp(Math.round(page || 1), 1, Math.max(1, totalPages));
      setCurrentPage(safePage);
      setPageInput(String(safePage));
    },
    [totalPages]
  );

  const goPrevious = useCallback(() => {
    setSafePage(currentPage - pageStep);
  }, [currentPage, pageStep, setSafePage]);

  const goNext = useCallback(() => {
    setSafePage(currentPage + pageStep);
  }, [currentPage, pageStep, setSafePage]);

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) =>
      clamp(Number((current + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM)
    );
  }, []);

  const resetView = useCallback(() => {
    setFitMode("page");
    setZoom(1);
    setRotation(0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Algunos navegadores móviles no exponen la API de pantalla completa.
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    if (chromeTimerRef.current !== null) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }

    if (loading || error || sidebarOpen) {
      setChromeVisible(true);
      return;
    }

    chromeTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
      chromeTimerRef.current = null;
    }, CHROME_HIDE_DELAY);
  }, [error, loading, sidebarOpen]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const toggleChrome = useCallback(() => {
    if (chromeVisible) {
      if (chromeTimerRef.current !== null) {
        window.clearTimeout(chromeTimerRef.current);
        chromeTimerRef.current = null;
      }

      setChromeVisible(false);
      return;
    }

    setChromeVisible(true);
    window.setTimeout(scheduleChromeHide, 0);
  }, [chromeVisible, scheduleChromeHide]);

  useEffect(() => {
    scheduleChromeHide();

    return () => {
      if (chromeTimerRef.current !== null) {
        window.clearTimeout(chromeTimerRef.current);
        chromeTimerRef.current = null;
      }
    };
  }, [scheduleChromeHide]);

  useEffect(() => {
    let cancelled = false;
    let localPdf: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        progressInitializedRef.current = false;
        lastServerSavedPageRef.current = null;
        setProgressSaveStatus("loading");
        setRestoredPage(null);
        setLoading(true);
        setError(null);

        const savedProgressPromise = loadSavedProgress();

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        const [document, savedProgress] = await Promise.all([
          loadingTask.promise,
          savedProgressPromise,
        ]);

        if (cancelled) {
          await document.destroy();
          return;
        }

        localPdf = document;
        const initialPage = clamp(
          savedProgress.snapshot?.currentPage ?? 1,
          1,
          Math.max(1, document.numPages)
        );

        setPdf(document);
        setCurrentPage(initialPage);
        setPageInput(String(initialPage));
        currentPageRef.current = initialPage;
        totalPagesRef.current = document.numPages;
        lastServerSavedPageRef.current =
          savedProgress.source === "server" ? initialPage : null;
        progressInitializedRef.current = true;

        if (initialPage > 1) {
          setRestoredPage(initialPage);
          setProgressSaveStatus("restored");
        } else {
          setProgressSaveStatus("ready");
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          progressInitializedRef.current = false;
          setLoading(false);
          setError(
            "No se pudo abrir el libro. Actualiza la página o inicia sesión nuevamente."
          );
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      progressInitializedRef.current = false;
      void localPdf?.destroy();
    };
  }, [loadSavedProgress, pdfUrl]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  useEffect(() => {
    if (
      !progressInitializedRef.current ||
      loading ||
      totalPages < 1
    ) {
      return;
    }

    const snapshot: ProgressSnapshot = {
      currentPage,
      totalPages,
      updatedAt: new Date().toISOString(),
    };

    writeLocalProgress(localProgressKey, snapshot);

    if (lastServerSavedPageRef.current === currentPage) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveProgressToServer(snapshot);
    }, PROGRESS_SAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [
    currentPage,
    loading,
    localProgressKey,
    saveProgressToServer,
    totalPages,
  ]);

  useEffect(() => {
    const flushProgress = () => {
      if (!progressInitializedRef.current) return;

      const currentPageValue = currentPageRef.current;
      const totalPagesValue = totalPagesRef.current;

      if (
        currentPageValue < 1 ||
        totalPagesValue < 1 ||
        lastServerSavedPageRef.current === currentPageValue
      ) {
        return;
      }

      const snapshot: ProgressSnapshot = {
        currentPage: currentPageValue,
        totalPages: totalPagesValue,
        updatedAt: new Date().toISOString(),
      };
      const body = JSON.stringify({
        currentPage: currentPageValue,
        totalPages: totalPagesValue,
      });

      writeLocalProgress(localProgressKey, snapshot);

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          progressUrl,
          new Blob([body], { type: "application/json" })
        );
        return;
      }

      void fetch(progressUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        keepalive: true,
        body,
      }).catch(() => undefined);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushProgress();
    };

    window.addEventListener("pagehide", flushProgress);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushProgress);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [localProgressKey, progressUrl]);

  useEffect(() => {
    if (!restoredPage) return;

    const timer = window.setTimeout(() => {
      setRestoredPage(null);
      setProgressSaveStatus((current) =>
        current === "restored" ? "saved" : current
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [restoredPage]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [sidebarOpen, isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [changeZoom]);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });

    if (sidebarOpen) {
      const activeThumbnail = sidebarRef.current?.querySelector<HTMLElement>(
        `[data-page="${currentPage}"]`
      );
      activeThumbnail?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentPage, sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "Home") {
        event.preventDefault();
        setSafePage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        setSafePage(totalPages);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeZoom(ZOOM_STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        changeZoom(-ZOOM_STEP);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === "0") {
        event.preventDefault();
        resetView();
      } else if (event.key === "Escape") {
        setSidebarOpen(false);
        setChromeVisible(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    changeZoom,
    goNext,
    goPrevious,
    resetView,
    setSafePage,
    toggleFullscreen,
    totalPages,
  ]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("bestseller-reader-settings");
      if (!stored) return;

      const settings = JSON.parse(stored) as {
        dark?: boolean;
        theme?: ReaderTheme;
        viewMode?: ViewMode;
        fitMode?: FitMode;
      };

      if (
        settings.theme === "paper" ||
        settings.theme === "sepia" ||
        settings.theme === "night"
      ) {
        setTheme(settings.theme);
      } else if (typeof settings.dark === "boolean") {
        setTheme(settings.dark ? "night" : "paper");
      }

      if (settings.viewMode === "single" || settings.viewMode === "spread") {
        setViewMode(settings.viewMode);
      }

      if (settings.fitMode === "page" || settings.fitMode === "width") {
        setFitMode(settings.fitMode);
      }
    } catch {
      // La preferencia local es opcional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "bestseller-reader-settings",
        JSON.stringify({ theme, viewMode, fitMode })
      );
    } catch {
      // El lector sigue funcionando aunque localStorage esté bloqueado.
    }
  }, [fitMode, theme, viewMode]);

  const visiblePages = useMemo(() => {
    if (!pdf || totalPages === 0) return [];

    if (effectiveViewMode === "single") {
      return [currentPage];
    }

    return [currentPage, currentPage + 1].filter(
      (pageNumber) => pageNumber <= totalPages
    );
  }, [currentPage, effectiveViewMode, pdf, totalPages]);

  const pageWidth = useMemo(() => {
    const horizontalPadding = stageSize.width < 640 ? 24 : 72;
    const spreadGap = effectiveViewMode === "spread" ? 28 : 0;
    const usableWidth = Math.max(
      260,
      stageSize.width - horizontalPadding - spreadGap
    );

    return effectiveViewMode === "spread"
      ? Math.max(240, usableWidth / 2)
      : Math.max(280, usableWidth);
  }, [effectiveViewMode, stageSize.width]);

  const pageHeight = Math.max(
    320,
    stageSize.height - TOOLBAR_HEIGHT_ALLOWANCE
  );

  const progress = totalPages
    ? Math.min(100, (currentPage / totalPages) * 100)
    : 0;

  const progressStatusText =
    progressSaveStatus === "loading"
      ? "Buscando la última página"
      : progressSaveStatus === "restored" && restoredPage
        ? `Lectura restaurada en la página ${restoredPage}`
        : progressSaveStatus === "saving"
          ? "Guardando avance"
          : progressSaveStatus === "local"
            ? "Avance guardado localmente"
            : "Avance guardado";

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSafePage(Number(pageInput));
  }

  return (
    <section
      ref={shellRef}
      onPointerMove={revealChrome}
      onFocusCapture={revealChrome}
      className={[
        "relative isolate mx-auto flex h-[100dvh] w-full flex-col overflow-hidden border-0",
        dark
          ? "bg-[#101317] text-white"
          : theme === "sepia"
            ? "bg-[#d8cdb8] text-slate-950"
            : "bg-[#ececea] text-slate-950",
      ].join(" ")}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {progressStatusText}
      </span>

      <header
        className={[
          "absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl transition duration-300",
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0",
        ].join(" ")}
      >
        <div className="flex min-h-16 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <a
            href="/dashboard"
            aria-label="Salir del lector"
            title="Volver a mi biblioteca"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>

          <ToolbarButton
            label={sidebarOpen ? "Ocultar miniaturas" : "Mostrar miniaturas"}
            active={sidebarOpen}
            onClick={() => setSidebarOpen((value) => !value)}
          >
            <PanelLeft className="h-5 w-5" />
          </ToolbarButton>

          <div className="min-w-0 flex-1 px-1 sm:px-2">
            <p className="truncate text-sm font-black">
              {title}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ToolbarButton
              label={
                theme === "paper"
                  ? "Usar fondo sepia"
                  : theme === "sepia"
                    ? "Usar modo nocturno"
                    : "Usar fondo claro"
              }
              onClick={() =>
                setTheme((current) =>
                  current === "paper"
                    ? "sepia"
                    : current === "sepia"
                      ? "night"
                      : "paper"
                )
              }
            >
              {theme === "night" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </ToolbarButton>

            <ToolbarButton
              label={
                isFullscreen
                  ? "Salir de pantalla completa"
                  : "Pantalla completa"
              }
              active={isFullscreen}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </ToolbarButton>
          </div>
        </div>

        <div
          className="overflow-x-auto border-t border-slate-800 bg-slate-950/95 [scrollbar-width:thin]"
          aria-label="Controles de visualización"
        >
          <div className="mx-auto flex min-w-max items-center gap-2 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
            <ToolbarButton
              label="Página anterior"
              disabled={currentPage <= 1 || loading}
              onClick={goPrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </ToolbarButton>

            <form
              onSubmit={submitPage}
              className="flex h-10 items-center rounded-xl border border-slate-700 bg-slate-900 px-2"
            >
              <input
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={() => setPageInput(String(currentPage))}
                inputMode="numeric"
                aria-label="Número de página"
                className="w-10 bg-transparent text-center text-sm font-black text-white outline-none"
              />
              <span className="text-xs font-bold text-slate-500">
                / {totalPages || "–"}
              </span>
            </form>

            <ToolbarButton
              label="Página siguiente"
              disabled={currentPage >= totalPages || loading}
              onClick={goNext}
            >
              <ChevronRight className="h-5 w-5" />
            </ToolbarButton>
          </div>

            <div className="h-7 w-px bg-slate-700" />

            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
            <ToolbarButton
              label="Alejar"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => changeZoom(-ZOOM_STEP)}
            >
              <ZoomOut className="h-5 w-5" />
            </ToolbarButton>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
              }}
              className="h-10 min-w-[72px] rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-black text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              title="Restablecer zoom al 100 %"
              aria-label="Restablecer zoom al 100 por ciento"
            >
              {Math.round(zoom * 100)}%
            </button>

            <ToolbarButton
              label="Acercar"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => changeZoom(ZOOM_STEP)}
            >
              <ZoomIn className="h-5 w-5" />
            </ToolbarButton>
          </div>

            <div className="h-7 w-px bg-slate-700" />

            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => {
                setFitMode("page");
                setZoom(1);
              }}
              className={[
                "h-10 rounded-xl border px-3 text-xs font-black transition",
                fitMode === "page"
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              Ajustar página
            </button>

            <button
              type="button"
              onClick={() => {
                setFitMode("width");
                setZoom(1);
              }}
              className={[
                "h-10 rounded-xl border px-3 text-xs font-black transition",
                fitMode === "width"
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
              ].join(" ")}
            >
              Ajustar ancho
            </button>
          </div>

            <div className="h-7 w-px bg-slate-700" />

            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
            <ToolbarButton
              label="Una página"
              active={effectiveViewMode === "single"}
              onClick={() => setViewMode("single")}
            >
              <Square className="h-5 w-5" />
            </ToolbarButton>

            <ToolbarButton
              label={
                isCompact
                  ? "Dos páginas requiere una pantalla más ancha"
                  : "Dos páginas"
              }
              active={effectiveViewMode === "spread"}
              disabled={isCompact}
              onClick={() => setViewMode("spread")}
            >
              <Columns2 className="h-5 w-5" />
            </ToolbarButton>
          </div>

            <div className="h-7 w-px bg-slate-700" />

            <ToolbarButton label="Restablecer vista" onClick={resetView}>
              <RotateCcw className="h-5 w-5" />
              <span className="hidden sm:inline">Restablecer</span>
            </ToolbarButton>
          </div>
        </div>

        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          ref={sidebarRef}
          className={[
            "absolute inset-y-0 left-0 z-50 w-52 overflow-y-auto border-r border-slate-800 bg-slate-950 px-3 pb-5 pt-20 shadow-2xl transition-transform duration-300",
            sidebarOpen
              ? "translate-x-0"
              : "pointer-events-none -translate-x-full",
          ].join(" ")}
        >
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`Portada de ${title}`}
                className="mx-auto max-h-40 rounded-md object-contain shadow-lg"
              />
            ) : (
              <BookOpen className="mx-auto h-14 w-14 text-slate-600" />
            )}
            <p className="mt-3 line-clamp-2 text-xs font-bold text-slate-300">
              {title}
            </p>
          </div>

          <div className="space-y-3">
            {pdf
              ? Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <PdfThumbnail
                      key={pageNumber}
                      pdf={pdf}
                      pageNumber={pageNumber}
                      active={
                        pageNumber === currentPage ||
                        (effectiveViewMode === "spread" &&
                          pageNumber === currentPage + 1)
                      }
                      onSelect={() => {
                        setSafePage(pageNumber);
                        if (window.innerWidth < 768) setSidebarOpen(false);
                      }}
                    />
                  )
                )
              : null}
          </div>
        </aside>

        <div
          ref={stageRef}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("button, input, a")) return;
            if (!pdf || loading || error || zoom > 1) return;

            const bounds = event.currentTarget.getBoundingClientRect();
            const position = (event.clientX - bounds.left) / bounds.width;

            if (position < 0.28) {
              goPrevious();
            } else if (position > 0.72) {
              goNext();
            } else {
              toggleChrome();
            }
          }}
          onPointerDown={(event) => {
            const stage = stageRef.current;
            const target = event.target as HTMLElement;

            if (
              !stage ||
              zoom <= 1 ||
              target.closest("button, input, a")
            ) {
              return;
            }

            dragRef.current = {
              active: true,
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              scrollLeft: stage.scrollLeft,
              scrollTop: stage.scrollTop,
            };

            stage.setPointerCapture(event.pointerId);
            setIsDragging(true);
          }}
          onPointerMove={(event) => {
            revealChrome();

            const stage = stageRef.current;
            const drag = dragRef.current;

            if (!stage || !drag?.active || drag.pointerId !== event.pointerId) {
              return;
            }

            stage.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
            stage.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) {
              dragRef.current = null;
              setIsDragging(false);
            }
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setIsDragging(false);
          }}
          className={[
            "relative min-w-0 flex-1 overflow-auto overscroll-contain",
            theme === "night"
              ? "bg-[#101317]"
              : theme === "sepia"
                ? "bg-[#d8cdb8]"
                : "bg-[#ececea]",
            zoom > 1
              ? isDragging
                ? "cursor-grabbing select-none"
                : "cursor-grab"
              : "cursor-default",
          ].join(" ")}
          style={{ touchAction: "pan-x pan-y" }}
        >
          {sidebarOpen ? (
            <button
              type="button"
              className="absolute inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar miniaturas"
            />
          ) : null}

          {loading ? (
            <div className="flex h-full min-h-[520px] items-center justify-center p-6">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/90 px-8 py-6 text-center text-white shadow-2xl">
                <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                <p className="mt-4 font-black">Abriendo tu libro...</p>
                <p className="mt-1 text-sm text-slate-400">
                  Preparando el lector de alta resolución
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[520px] items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-red-400/30 bg-red-950/80 p-6 text-center text-red-100 shadow-2xl">
                <p className="text-lg font-black">No pudimos abrir el libro</p>
                <p className="mt-2 text-sm leading-6 text-red-200">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-900"
                >
                  Intentar nuevamente
                </button>
              </div>
            </div>
          ) : pdf ? (
            <div
              className={[
                "flex min-h-full min-w-full items-start justify-center gap-7 px-3 py-5 sm:px-8 sm:py-7",
                effectiveViewMode === "spread"
                  ? "flex-row"
                  : "flex-col items-center",
              ].join(" ")}
            >
              {visiblePages.map((pageNumber) => (
                <PdfPageCanvas
                  key={`${pageNumber}-${fitMode}-${zoom}-${rotation}-${stageSize.width}-${stageSize.height}`}
                  pdf={pdf}
                  pageNumber={pageNumber}
                  fitMode={fitMode}
                  zoom={zoom}
                  rotation={rotation}
                  availableWidth={pageWidth}
                  availableHeight={pageHeight}
                  theme={theme}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <footer
        className={[
          "absolute inset-x-0 bottom-0 z-40 flex min-h-14 items-center justify-between gap-3 border-t border-white/10 bg-slate-950/95 px-3 text-white shadow-[0_-18px_45px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 sm:px-4",
          chromeVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={goPrevious}
          disabled={currentPage <= 1 || loading}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-black disabled:opacity-35"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="text-center">
          <p className="text-sm font-black">
            Página {currentPage} de {totalPages || "–"}
          </p>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={currentPage >= totalPages || loading}
          className="inline-flex h-10 items-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-black hover:bg-blue-500 disabled:opacity-35"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </footer>
    </section>
  );
}
