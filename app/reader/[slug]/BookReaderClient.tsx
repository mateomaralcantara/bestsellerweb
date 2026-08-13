"use client";

import {
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
};

type ViewMode = "single" | "spread";
type FitMode = "page" | "width" | "custom";

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
const CUSTOM_BASE_SCALE = 1.25;
const TOOLBAR_HEIGHT_ALLOWANCE = 64;

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

  if (fitMode === "custom") {
    return CUSTOM_BASE_SCALE * zoom;
  }

  const widthScale = Math.max(0.1, availableWidth / baseViewport.width);

  if (fitMode === "width") {
    return widthScale;
  }

  const heightScale = Math.max(0.1, availableHeight / baseViewport.height);
  return Math.min(widthScale, heightScale);
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  fitMode,
  zoom,
  rotation,
  availableWidth,
  availableHeight,
  dark,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  fitMode: FitMode;
  zoom: number;
  rotation: number;
  availableWidth: number;
  availableHeight: number;
  dark: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState(false);

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
          className="block max-w-none bg-white"
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

      <div
        className={[
          "mx-auto mt-3 w-fit rounded-full px-3 py-1 text-xs font-bold",
          dark
            ? "bg-slate-800 text-slate-300"
            : "bg-white text-slate-500 shadow-sm",
        ].join(" ")}
      >
        Página {pageNumber}
      </div>
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
}: BookReaderClientProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

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
  const [dark, setDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageSize, setStageSize] = useState<StageSize>({
    width: 1100,
    height: 720,
  });
  const [isDragging, setIsDragging] = useState(false);

  const totalPages = pdf?.numPages ?? 0;
  const pageStep = viewMode === "spread" ? 2 : 1;

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
    setFitMode("custom");
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

  useEffect(() => {
    let cancelled = false;
    let localPdf: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        const document = await loadingTask.promise;

        if (cancelled) {
          await document.destroy();
          return;
        }

        localPdf = document;
        setPdf(document);
        setCurrentPage(1);
        setPageInput("1");
        setLoading(false);
      } catch {
        if (!cancelled) {
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
      void localPdf?.destroy();
    };
  }, [pdfUrl]);

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
        viewMode?: ViewMode;
      };

      if (typeof settings.dark === "boolean") setDark(settings.dark);
      if (settings.viewMode === "single" || settings.viewMode === "spread") {
        setViewMode(settings.viewMode);
      }
    } catch {
      // La preferencia local es opcional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "bestseller-reader-settings",
        JSON.stringify({ dark, viewMode })
      );
    } catch {
      // El lector sigue funcionando aunque localStorage esté bloqueado.
    }
  }, [dark, viewMode]);

  const visiblePages = useMemo(() => {
    if (!pdf || totalPages === 0) return [];

    if (viewMode === "single") {
      return [currentPage];
    }

    return [currentPage, currentPage + 1].filter(
      (pageNumber) => pageNumber <= totalPages
    );
  }, [currentPage, pdf, totalPages, viewMode]);

  const pageWidth = useMemo(() => {
    const horizontalPadding = stageSize.width < 640 ? 24 : 72;
    const spreadGap = viewMode === "spread" ? 28 : 0;
    const usableWidth = Math.max(
      260,
      stageSize.width - horizontalPadding - spreadGap
    );

    return viewMode === "spread"
      ? Math.max(240, usableWidth / 2)
      : Math.max(280, usableWidth);
  }, [stageSize.width, viewMode]);

  const pageHeight = Math.max(
    320,
    stageSize.height - TOOLBAR_HEIGHT_ALLOWANCE
  );

  const progress = totalPages
    ? Math.min(100, (currentPage / totalPages) * 100)
    : 0;

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSafePage(Number(pageInput));
  }

  return (
    <section
      ref={shellRef}
      className={[
        "relative mx-auto flex w-full max-w-[1800px] flex-col overflow-hidden border",
        isFullscreen
          ? "h-screen rounded-none border-0"
          : "h-[calc(100vh-9rem)] min-h-[680px] rounded-3xl",
        dark
          ? "border-slate-800 bg-slate-950 text-white"
          : "border-slate-200 bg-slate-100 text-slate-950",
      ].join(" ")}
    >
      <header className="relative z-40 border-b border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="flex min-h-16 flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <ToolbarButton
            label={sidebarOpen ? "Ocultar miniaturas" : "Mostrar miniaturas"}
            active={sidebarOpen}
            onClick={() => setSidebarOpen((value) => !value)}
          >
            <PanelLeft className="h-5 w-5" />
          </ToolbarButton>

          <div className="mr-auto min-w-0 px-1 sm:px-2">
            <p className="max-w-48 truncate text-sm font-black sm:max-w-sm lg:max-w-xl">
              {title}
            </p>
            <p className="text-xs text-slate-400">
              {totalPages ? `${totalPages} páginas` : "Preparando libro"}
            </p>
          </div>

          <div className="order-3 flex w-full items-center justify-center gap-1.5 sm:order-none sm:w-auto">
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

          <div className="flex items-center gap-1.5">
            <ToolbarButton
              label="Alejar"
              disabled={fitMode === "custom" && zoom <= MIN_ZOOM}
              onClick={() => changeZoom(-ZOOM_STEP)}
            >
              <ZoomOut className="h-5 w-5" />
            </ToolbarButton>

            <button
              type="button"
              onClick={() => {
                setFitMode("custom");
                setZoom(1);
              }}
              className="hidden h-10 min-w-[72px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs font-black text-slate-200 hover:bg-slate-800 md:block"
              title="Restablecer zoom al 100 %"
            >
              {fitMode === "custom"
                ? `${Math.round(zoom * 100)}%`
                : fitMode === "width"
                  ? "Ancho"
                  : "Página"}
            </button>

            <ToolbarButton
              label="Acercar"
              disabled={fitMode === "custom" && zoom >= MAX_ZOOM}
              onClick={() => changeZoom(ZOOM_STEP)}
            >
              <ZoomIn className="h-5 w-5" />
            </ToolbarButton>
          </div>

          <div className="hidden items-center gap-1.5 lg:flex">
            <button
              type="button"
              onClick={() => setFitMode("page")}
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
              onClick={() => setFitMode("width")}
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

          <div className="hidden items-center gap-1.5 xl:flex">
            <ToolbarButton
              label="Una página"
              active={viewMode === "single"}
              onClick={() => setViewMode("single")}
            >
              <Square className="h-5 w-5" />
            </ToolbarButton>

            <ToolbarButton
              label="Dos páginas"
              active={viewMode === "spread"}
              onClick={() => setViewMode("spread")}
            >
              <Columns2 className="h-5 w-5" />
            </ToolbarButton>
          </div>

          <ToolbarButton label="Restablecer vista" onClick={resetView}>
            <RotateCcw className="h-5 w-5" />
          </ToolbarButton>

          <ToolbarButton
            label={dark ? "Fondo claro" : "Fondo oscuro"}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </ToolbarButton>

          <ToolbarButton
            label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
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
            "absolute inset-y-0 left-0 z-30 mt-[69px] w-48 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 px-3 py-4 transition-transform duration-200 md:relative md:inset-auto md:mt-0",
            sidebarOpen
              ? "translate-x-0 md:block"
              : "-translate-x-full md:hidden",
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
                        (viewMode === "spread" &&
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
          onDoubleClick={() =>
            setFitMode((current) => (current === "width" ? "page" : "width"))
          }
          onPointerDown={(event) => {
            const stage = stageRef.current;
            const target = event.target as HTMLElement;

            if (
              !stage ||
              fitMode !== "custom" ||
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
            dark
              ? "bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_62%)]"
              : "bg-[radial-gradient(circle_at_top,#ffffff_0%,#e2e8f0_70%)]",
            fitMode === "custom"
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
              className="absolute inset-0 z-20 bg-black/45 md:hidden"
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
                "flex min-h-full min-w-full items-start justify-center gap-7 p-3 sm:p-8",
                viewMode === "spread" ? "flex-row" : "flex-col items-center",
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
                  dark={dark}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="relative z-40 flex min-h-14 items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-3 text-white sm:px-4">
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
          <p className="hidden text-[11px] text-slate-500 sm:block">
            Flechas: navegar · +/-: zoom · F: pantalla completa
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
