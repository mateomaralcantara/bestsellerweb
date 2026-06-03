// ============================================
// ARCHIVO: components/books/LookInsidePreview.tsx
// ============================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";

export type LookInsidePreviewPage = {
  pageIndex: number;
  sourcePageNumber: number | null;
  kind: "cover" | "pdf_page";
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

type LookInsidePreviewProps = {
  title: string;
  subtitle?: string | null;
  authorName: string;
  coverUrl?: string | null;
  checkoutUrl: string;
  pages: LookInsidePreviewPage[];
  introduction?: string | null;
  chapterOneExcerpt?: string | null;
};

type ViewMode = "single" | "double";

type VisualSpread = {
  id: string;
  left: LookInsidePreviewPage;
  right: LookInsidePreviewPage | null;
  label: string;
};

type TextPreviewPage = {
  label: string;
  title: string;
  content: string;
};

function cleanText(value?: string | null) {
  return value?.trim() || "";
}

function getValidPages(pages: LookInsidePreviewPage[]) {
  return [...pages]
    .filter((page) => Boolean(page.imageUrl))
    .sort((a, b) => a.pageIndex - b.pageIndex);
}

function getFallbackPages(params: {
  introduction?: string | null;
  chapterOneExcerpt?: string | null;
}) {
  const pages: TextPreviewPage[] = [];

  const introduction = cleanText(params.introduction);
  const chapterOneExcerpt = cleanText(params.chapterOneExcerpt);

  if (introduction) {
    pages.push({
      label: "Introducción",
      title: "Introducción",
      content: introduction,
    });
  }

  if (chapterOneExcerpt) {
    pages.push({
      label: "Capítulo 1",
      title: "Primer capítulo",
      content: chapterOneExcerpt,
    });
  }

  return pages;
}

function getPageLabel(page: LookInsidePreviewPage) {
  if (page.kind === "cover") {
    return "Portada";
  }

  return `Página ${page.sourcePageNumber ?? page.pageIndex}`;
}

function buildSpreads(pages: LookInsidePreviewPage[]) {
  const validPages = getValidPages(pages);
  const coverPage = validPages.find((page) => page.kind === "cover") ?? null;
  const contentPages = validPages.filter((page) => page.kind !== "cover");

  const spreads: VisualSpread[] = [];

  if (coverPage) {
    spreads.push({
      id: `cover-${coverPage.pageIndex}`,
      left: coverPage,
      right: null,
      label: "Portada",
    });
  }

  for (let index = 0; index < contentPages.length; index += 2) {
    const left = contentPages[index];
    const right = contentPages[index + 1] ?? null;

    spreads.push({
      id: `spread-${left.pageIndex}-${right?.pageIndex ?? "single"}`,
      left,
      right,
      label: right
        ? `Páginas ${left.sourcePageNumber ?? left.pageIndex}-${
            right.sourcePageNumber ?? right.pageIndex
          }`
        : `Página ${left.sourcePageNumber ?? left.pageIndex}`,
    });
  }

  return spreads;
}

function clampZoom(value: number) {
  return Math.min(3, Math.max(0.75, Number(value.toFixed(2))));
}

function getStageWidth(params: {
  viewMode: ViewMode;
  zoom: number;
  hasRightPage: boolean;
}) {
  if (params.viewMode === "single") {
    if (params.zoom <= 1) {
      return "min(760px, calc(100vw - 48px))";
    }

    return `${760 * params.zoom}px`;
  }

  if (!params.hasRightPage) {
    if (params.zoom <= 1) {
      return "min(520px, calc(100vw - 48px))";
    }

    return `${520 * params.zoom}px`;
  }

  if (params.zoom <= 1) {
    return "min(1380px, calc(100vw - 96px))";
  }

  return `${1380 * params.zoom}px`;
}

export function LookInsidePreview({
  title,
  subtitle,
  authorName,
  coverUrl,
  checkoutUrl,
  pages,
  introduction,
  chapterOneExcerpt,
}: LookInsidePreviewProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("double");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const visualPages = useMemo(() => getValidPages(pages), [pages]);
  const visualSpreads = useMemo(() => buildSpreads(visualPages), [visualPages]);

  const fallbackPages = useMemo(
    () => getFallbackPages({ introduction, chapterOneExcerpt }),
    [introduction, chapterOneExcerpt]
  );

  const hasVisualPages = visualPages.length > 0;
  const hasFallbackPages = fallbackPages.length > 0;
  const hasPreview = hasVisualPages || hasFallbackPages;

  const totalViews = hasVisualPages
    ? viewMode === "double"
      ? visualSpreads.length
      : visualPages.length
    : fallbackPages.length;

  const currentSpread =
    hasVisualPages && viewMode === "double"
      ? visualSpreads[currentIndex] ?? visualSpreads[0] ?? null
      : null;

  const currentSinglePage =
    hasVisualPages && viewMode === "single"
      ? visualPages[currentIndex] ?? visualPages[0] ?? null
      : null;

  const currentFallbackPage =
    !hasVisualPages && hasFallbackPages
      ? fallbackPages[currentIndex] ?? fallbackPages[0] ?? null
      : null;

  const currentLabel = hasVisualPages
    ? viewMode === "double"
      ? currentSpread?.label ?? "Vista previa"
      : currentSinglePage
        ? getPageLabel(currentSinglePage)
        : "Vista previa"
    : currentFallbackPage?.label ?? "Fragmento";

  const stageWidth = getStageWidth({
    viewMode,
    zoom,
    hasRightPage: Boolean(currentSpread?.right),
  });

  const scrollToStart = useCallback(() => {
    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  }, []);

  const openPreview = useCallback(() => {
    if (!hasPreview) {
      return;
    }

    setCurrentIndex(0);
    setZoom(1);
    setOpen(true);
  }, [hasPreview]);

  const goPrevious = useCallback(() => {
    if (totalViews <= 1) {
      return;
    }

    setCurrentIndex((current) =>
      current <= 0 ? totalViews - 1 : current - 1
    );

    scrollToStart();
  }, [scrollToStart, totalViews]);

  const goNext = useCallback(() => {
    if (totalViews <= 1) {
      return;
    }

    setCurrentIndex((current) =>
      current >= totalViews - 1 ? 0 : current + 1
    );

    scrollToStart();
  }, [scrollToStart, totalViews]);

  const zoomIn = useCallback(() => {
    setZoom((current) => clampZoom(current + 0.15));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => clampZoom(current - 0.15));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    scrollToStart();
  }, [scrollToStart]);

  const toggleViewMode = useCallback(() => {
    if (!hasVisualPages) {
      return;
    }

    setViewMode((current) => (current === "double" ? "single" : "double"));
  }, [hasVisualPages]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        goNext();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "+") {
        event.preventDefault();
        zoomIn();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        zoomOut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrevious, open, zoomIn, zoomOut]);

  useEffect(() => {
    setCurrentIndex(0);
    setZoom(1);
    scrollToStart();
  }, [scrollToStart, viewMode]);

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        disabled={!hasPreview}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BookOpen className="h-5 w-5" />
        Leer fragmento
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] bg-slate-950"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${title}`}
        >
          <div className="flex h-screen w-screen flex-col overflow-hidden">
            <ReaderHeader
              title={title}
              subtitle={subtitle}
              authorName={authorName}
              checkoutUrl={checkoutUrl}
              viewMode={viewMode}
              zoom={zoom}
              hasVisualPages={hasVisualPages}
              onToggleViewMode={toggleViewMode}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onResetZoom={resetZoom}
              onClose={() => setOpen(false)}
            />

            <MobileToolbar
              viewMode={viewMode}
              zoom={zoom}
              hasVisualPages={hasVisualPages}
              onToggleViewMode={toggleViewMode}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onResetZoom={resetZoom}
            />

            <main className="relative min-h-0 flex-1 bg-[#d8d2c4]">
              <NavigationButton direction="previous" onClick={goPrevious} />
              <NavigationButton direction="next" onClick={goNext} />

              <div
                ref={viewportRef}
                className="h-full w-full overflow-auto overscroll-contain scroll-smooth"
              >
                <div className="flex min-h-full min-w-full items-start justify-center px-4 py-6 md:px-20 md:py-10">
                  {hasVisualPages && viewMode === "double" && currentSpread ? (
                    <DoublePageView
                      spread={currentSpread}
                      stageWidth={stageWidth}
                    />
                  ) : hasVisualPages && currentSinglePage ? (
                    <SinglePageView
                      page={currentSinglePage}
                      stageWidth={stageWidth}
                    />
                  ) : currentFallbackPage ? (
                    <TextPageView page={currentFallbackPage} zoom={zoom} />
                  ) : (
                    <EmptyPreview />
                  )}
                </div>
              </div>
            </main>

            <ReaderFooter
              currentLabel={currentLabel}
              currentIndex={currentIndex}
              totalViews={totalViews}
              onPrevious={goPrevious}
              onNext={goNext}
            />

            <ReaderMobileBuyBar checkoutUrl={checkoutUrl} coverUrl={coverUrl} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ReaderHeader({
  title,
  subtitle,
  authorName,
  checkoutUrl,
  viewMode,
  zoom,
  hasVisualPages,
  onToggleViewMode,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose,
}: {
  title: string;
  subtitle?: string | null;
  authorName: string;
  checkoutUrl: string;
  viewMode: ViewMode;
  zoom: number;
  hasVisualPages: boolean;
  onToggleViewMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950 px-4 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <BookOpen className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Vista previa</p>
          <p className="truncate text-xs text-white/60">
            {title} · {authorName}
          </p>
          {subtitle ? (
            <p className="hidden truncate text-[11px] text-white/40 md:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        {hasVisualPages ? (
          <button
            type="button"
            onClick={onToggleViewMode}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15"
          >
            {viewMode === "double" ? "Ver 1 página" : "Ver 2 páginas"}
          </button>
        ) : null}

        <div className="flex items-center rounded-xl bg-white/10 p-1">
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
            aria-label="Alejar"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="min-w-16 text-center text-xs font-black">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
            aria-label="Acercar"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onResetZoom}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
            aria-label="Restablecer zoom"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <Link
          href={checkoutUrl}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ffd814] px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-[#f7ca00]"
        >
          <ShoppingCart className="h-4 w-4" />
          Comprar
        </Link>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15"
        aria-label="Cerrar vista previa"
      >
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

function MobileToolbar({
  viewMode,
  zoom,
  hasVisualPages,
  onToggleViewMode,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: {
  viewMode: ViewMode;
  zoom: number;
  hasVisualPages: boolean;
  onToggleViewMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 md:hidden">
      {hasVisualPages ? (
        <button
          type="button"
          onClick={onToggleViewMode}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
        >
          {viewMode === "double" ? "1 página" : "2 páginas"}
        </button>
      ) : (
        <span className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
          Texto
        </span>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onZoomOut}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300"
          aria-label="Alejar"
        >
          <Minus className="h-4 w-4" />
        </button>

        <span className="min-w-12 text-center text-xs font-black text-slate-700">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={onZoomIn}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300"
          aria-label="Acercar"
        >
          <Plus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300"
          aria-label="Restablecer zoom"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NavigationButton({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xl transition hover:scale-105 hover:bg-white md:flex ${
        isPrevious ? "left-4" : "right-4"
      }`}
      aria-label={isPrevious ? "Anterior" : "Siguiente"}
    >
      {isPrevious ? (
        <ChevronLeft className="h-7 w-7" />
      ) : (
        <ChevronRight className="h-7 w-7" />
      )}
    </button>
  );
}

function DoublePageView({
  spread,
  stageWidth,
}: {
  spread: VisualSpread;
  stageWidth: string;
}) {
  return (
    <div
      className="flex items-start justify-center gap-4 md:gap-6"
      style={{ width: stageWidth }}
    >
      <PreviewImage page={spread.left} />
      {spread.right ? <PreviewImage page={spread.right} /> : null}
    </div>
  );
}

function SinglePageView({
  page,
  stageWidth,
}: {
  page: LookInsidePreviewPage;
  stageWidth: string;
}) {
  return (
    <div style={{ width: stageWidth }}>
      <PreviewImage page={page} />
    </div>
  );
}

function PreviewImage({ page }: { page: LookInsidePreviewPage }) {
  return (
    <div className="min-w-0 flex-1">
      <img
        src={page.imageUrl ?? ""}
        alt={getPageLabel(page)}
        className="block h-auto w-full max-w-none select-none rounded-sm bg-white object-contain shadow-2xl ring-1 ring-black/10"
        draggable={false}
        loading="eager"
        decoding="sync"
      />
    </div>
  );
}

function TextPageView({
  page,
  zoom,
}: {
  page: TextPreviewPage;
  zoom: number;
}) {
  return (
    <article
      className="w-full max-w-3xl rounded-sm bg-[#fffdf7] px-8 py-10 shadow-2xl ring-1 ring-black/10 md:px-14"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
      }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
        {page.label}
      </p>

      <h2 className="mt-3 text-3xl font-black text-slate-950">
        {page.title}
      </h2>

      <p className="mt-6 whitespace-pre-line font-serif text-[19px] leading-10 text-slate-900">
        {page.content}
      </p>
    </article>
  );
}

function EmptyPreview() {
  return (
    <div className="rounded-2xl bg-white px-8 py-10 text-center text-slate-600 shadow-xl">
      No hay páginas de muestra disponibles.
    </div>
  );
}

function ReaderFooter({
  currentLabel,
  currentIndex,
  totalViews,
  onPrevious,
  onNext,
}: {
  currentLabel: string;
  currentIndex: number;
  totalViews: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 text-sm text-slate-700">
      <button
        type="button"
        onClick={onPrevious}
        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-black transition hover:bg-slate-100"
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </button>

      <p className="truncate px-3 text-center font-black">
        {currentLabel} · {currentIndex + 1} de {totalViews}
      </p>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-black transition hover:bg-slate-100"
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </button>
    </footer>
  );
}

function ReaderMobileBuyBar({
  checkoutUrl,
  coverUrl,
}: {
  checkoutUrl: string;
  coverUrl?: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Portada"
            className="h-10 w-8 shrink-0 rounded object-cover"
          />
        ) : null}

        <p className="truncate text-xs font-semibold text-slate-600">
          Fragmento de muestra
        </p>
      </div>

      <Link
        href={checkoutUrl}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#ffd814] px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-[#f7ca00]"
      >
        <ShoppingCart className="h-4 w-4" />
        Comprar
      </Link>
    </div>
  );
}