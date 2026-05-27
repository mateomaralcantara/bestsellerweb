"use client";

import { useEffect, useMemo, useState } from "react";
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

function cleanText(value?: string | null) {
  return value?.trim() || "";
}

function getFallbackPages(params: {
  introduction?: string | null;
  chapterOneExcerpt?: string | null;
}) {
  const pages: {
    label: string;
    title: string;
    content: string;
  }[] = [];

  const intro = cleanText(params.introduction);
  const chapter = cleanText(params.chapterOneExcerpt);

  if (intro) {
    pages.push({
      label: "Introducción",
      title: "Introducción",
      content: intro,
    });
  }

  if (chapter) {
    pages.push({
      label: "Capítulo 1",
      title: "Primer capítulo",
      content: chapter,
    });
  }

  return pages;
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
  const [open, setOpen] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const visualPages = useMemo(() => {
    return [...pages]
      .filter((page) => page.imageUrl)
      .sort((a, b) => a.pageIndex - b.pageIndex);
  }, [pages]);

  const fallbackPages = useMemo(
    () => getFallbackPages({ introduction, chapterOneExcerpt }),
    [introduction, chapterOneExcerpt]
  );

  const hasVisualPages = visualPages.length > 0;
  const hasFallbackPages = fallbackPages.length > 0;
  const hasPreview = hasVisualPages || hasFallbackPages;

  const currentVisualPage = visualPages[currentPageIndex] ?? visualPages[0];
  const currentFallbackPage =
    fallbackPages[currentPageIndex] ?? fallbackPages[0];

  const totalPages = hasVisualPages ? visualPages.length : fallbackPages.length;

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }

      if (event.key === "ArrowRight") {
        goNext();
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, currentPageIndex, totalPages]);

  function openPreview() {
    if (!hasPreview) return;

    setCurrentPageIndex(0);
    setZoom(1);
    setOpen(true);
  }

  function goPrevious() {
    if (totalPages <= 1) return;

    setCurrentPageIndex((current) =>
      current <= 0 ? totalPages - 1 : current - 1
    );
  }

  function goNext() {
    if (totalPages <= 1) return;

    setCurrentPageIndex((current) =>
      current >= totalPages - 1 ? 0 : current + 1
    );
  }

  function zoomOut() {
    setZoom((value) => Math.max(0.75, Number((value - 0.1).toFixed(2))));
  }

  function zoomIn() {
    setZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(2))));
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        disabled={!hasPreview}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BookOpen className="h-5 w-5" />
        Leer fragmento
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Fragmento de ${title}`}
        >
          <div className="flex h-full flex-col bg-[#f3f0e8]">
            <header className="flex h-16 items-center justify-between border-b border-slate-300 bg-[#232f3e] px-4 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <BookOpen className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    Vista previa del libro
                  </p>
                  <p className="truncate text-xs text-white/70">
                    {title} · {authorName}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={zoomOut}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
                  aria-label="Alejar"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="min-w-14 text-center text-xs font-bold text-white/80">
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={zoomIn}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
                  aria-label="Acercar"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
                  aria-label="Restablecer zoom"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                <Link
                  href={checkoutUrl}
                  className="ml-2 inline-flex items-center gap-2 rounded-lg bg-[#ffd814] px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-[#f7ca00]"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Comprar
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
                aria-label="Cerrar vista previa"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_1fr_280px]">
              <aside className="hidden overflow-y-auto border-r border-slate-300 bg-[#fafafa] p-4 lg:block">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`Portada de ${title}`}
                      className="aspect-[3/4] w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                      Sin portada
                    </div>
                  )}
                </div>

                <h2 className="mt-4 line-clamp-3 text-base font-black text-slate-950">
                  {title}
                </h2>

                {subtitle ? (
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600">
                    {subtitle}
                  </p>
                ) : null}

                <p className="mt-2 text-sm text-slate-500">
                  Por{" "}
                  <span className="font-semibold text-slate-800">
                    {authorName}
                  </span>
                </p>

                <Link
                  href={checkoutUrl}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[#ffd814] px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-[#f7ca00]"
                >
                  Comprar ahora
                </Link>
              </aside>

              <main className="relative min-h-0 overflow-hidden bg-[#e8e4da]">
                <button
                  type="button"
                  onClick={goPrevious}
                  className="absolute left-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg transition hover:bg-white md:flex"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg transition hover:bg-white md:flex"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>

                <div className="flex h-full items-center justify-center overflow-auto p-4 md:p-8">
                  {hasVisualPages && currentVisualPage ? (
                    <div
                      className="origin-center transition-transform duration-200"
                      style={{ transform: `scale(${zoom})` }}
                    >
                      <img
                        src={currentVisualPage.imageUrl ?? ""}
                        alt={
                          currentVisualPage.kind === "cover"
                            ? "Portada"
                            : `Página ${currentVisualPage.sourcePageNumber ?? currentPageIndex + 1}`
                        }
                        className="max-h-[calc(100vh-150px)] max-w-full rounded-sm bg-white object-contain shadow-2xl ring-1 ring-black/10"
                      />
                    </div>
                  ) : currentFallbackPage ? (
                    <article
                      className="max-h-[calc(100vh-150px)] w-full max-w-3xl overflow-y-auto rounded-sm bg-[#fffdf7] px-8 py-10 shadow-2xl ring-1 ring-black/10 md:px-14"
                      style={{ transform: `scale(${zoom})` }}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
                        {currentFallbackPage.label}
                      </p>

                      <h2 className="mt-3 text-3xl font-black text-slate-950">
                        {currentFallbackPage.title}
                      </h2>

                      <p className="mt-6 whitespace-pre-line font-serif text-[19px] leading-10 text-slate-900">
                        {currentFallbackPage.content}
                      </p>
                    </article>
                  ) : null}
                </div>

                <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-slate-300 bg-white/95 px-4 py-3 text-sm text-slate-700">
                  <button
                    type="button"
                    onClick={goPrevious}
                    className="inline-flex items-center gap-1 font-semibold transition hover:text-slate-950"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  <p className="font-semibold">
                    Página {currentPageIndex + 1} de {totalPages}
                  </p>

                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1 font-semibold transition hover:text-slate-950"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </footer>
              </main>

              <aside className="hidden overflow-y-auto border-l border-slate-300 bg-[#fafafa] p-4 lg:block">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                  Fragmento
                </p>

                {hasVisualPages ? (
                  <div className="grid grid-cols-2 gap-3">
                    {visualPages.map((page, index) => (
                      <button
                        key={`${page.pageIndex}-${page.imageUrl}`}
                        type="button"
                        onClick={() => setCurrentPageIndex(index)}
                        className={`rounded-lg border bg-white p-1 transition ${
                          currentPageIndex === index
                            ? "border-[#ff9900] ring-2 ring-[#ff9900]/40"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <img
                          src={page.imageUrl ?? ""}
                          alt={`Miniatura ${index + 1}`}
                          className="aspect-[3/4] w-full rounded object-cover"
                        />
                        <p className="mt-1 truncate text-center text-[11px] font-semibold text-slate-600">
                          {page.kind === "cover"
                            ? "Portada"
                            : `Pág. ${page.sourcePageNumber ?? index + 1}`}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fallbackPages.map((page, index) => (
                      <button
                        key={page.label}
                        type="button"
                        onClick={() => setCurrentPageIndex(index)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                          currentPageIndex === index
                            ? "border-[#ff9900] bg-white text-slate-950 ring-2 ring-[#ff9900]/30"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                  Esta es una muestra. El contenido completo se desbloquea al
                  comprar el libro.
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}