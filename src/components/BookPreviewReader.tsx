/* Book preview pages use runtime-generated page-image URLs and reader layout. */
/* eslint-disable @next/next/no-img-element */

import React, { useMemo, useState } from "react";

type PreviewPage = {
  pageIndex: number;
  imageUrl: string;
  kind?: "cover" | "pdf_page";
};

type BookPreviewReaderProps = {
  title: string;
  pages: PreviewPage[];
  onClose: () => void;
};

export function BookPreviewReader({
  title,
  pages,
  onClose,
}: BookPreviewReaderProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);

  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));

  const progress = useMemo(() => {
    if (!pages.length) return 0;
    return Math.round(((spreadIndex + 1) / totalSpreads) * 100);
  }, [spreadIndex, totalSpreads, pages.length]);

  const leftPage = pages[spreadIndex * 2];
  const rightPage = pages[spreadIndex * 2 + 1];

  const goPrev = () => {
    setSpreadIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    setSpreadIndex((current) => Math.min(totalSpreads - 1, current + 1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Muestra del libro
          </p>
          <h2 className="font-black truncate">{title}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15"
        >
          Cerrar
        </button>
      </header>

      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 overflow-hidden flex items-center justify-center p-3 md:p-6">
        <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-center">
          {leftPage ? (
            <img
              src={leftPage.imageUrl}
              alt={`Página ${leftPage.pageIndex + 1}`}
              className="w-full max-h-[76vh] object-contain bg-white rounded-xl shadow-2xl select-none"
              draggable={false}
            />
          ) : (
            <div />
          )}

          {rightPage ? (
            <img
              src={rightPage.imageUrl}
              alt={`Página ${rightPage.pageIndex + 1}`}
              className="hidden md:block w-full max-h-[76vh] object-contain bg-white rounded-xl shadow-2xl select-none"
              draggable={false}
            />
          ) : (
            <div className="hidden md:block" />
          )}
        </div>
      </main>

      <footer className="px-4 py-3 border-t border-white/10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={spreadIndex === 0}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>

        <div className="text-center">
          <p className="text-sm font-bold">{progress}%</p>
          <p className="text-xs text-slate-400">
            Vista {spreadIndex + 1} de {totalSpreads}
          </p>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={spreadIndex >= totalSpreads - 1}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </footer>
    </div>
  );
}