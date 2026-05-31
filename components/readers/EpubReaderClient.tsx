"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { Book, Rendition } from "epubjs";

type EpubReaderClientProps = {
  title: string;
  epubUrl: string;
  mode?: "preview" | "full";
};

export default function EpubReaderClient({
  title,
  epubUrl,
  mode = "full",
}: EpubReaderClientProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadBook() {
      if (!viewerRef.current) return;

      setLoading(true);
      setError("");

      try {
        viewerRef.current.innerHTML = "";

        const book = ePub(epubUrl);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          spread: "auto",
          flow: "paginated",
        });

        renditionRef.current = rendition;

        rendition.on("relocated", (location: any) => {
          if (!mounted) return;

          const label =
            location?.start?.displayed?.page && location?.start?.displayed?.total
              ? `${location.start.displayed.page} / ${location.start.displayed.total}`
              : "";

          setCurrentLocation(label);
        });

        await rendition.display();

        if (mounted) {
          setLoading(false);
        }
      } catch (loadError) {
        console.error("Error cargando EPUB:", loadError);

        if (mounted) {
          setError("No se pudo cargar el EPUB.");
          setLoading(false);
        }
      }
    }

    loadBook();

    return () => {
      mounted = false;

      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch {
        // Nada grave.
      }

      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [epubUrl]);

  function goPrev() {
    renditionRef.current?.prev();
  }

  function goNext() {
    renditionRef.current?.next();
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            {mode === "preview" ? "Vista previa EPUB" : "Lector EPUB"}
          </p>

          <h1 className="truncate text-base font-black">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {currentLocation ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
              {currentLocation}
            </span>
          ) : null}

          <button
            type="button"
            onClick={goPrev}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            Anterior
          </button>

          <button
            type="button"
            onClick={goNext}
            className="rounded-xl bg-[#ffd814] px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-[#f7ca00]"
          >
            Siguiente
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[70vh] items-center justify-center text-sm font-semibold text-slate-500">
          Cargando EPUB...
        </div>
      ) : null}

      {error ? (
        <div className="flex min-h-[70vh] items-center justify-center p-6 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div
        ref={viewerRef}
        className={`h-[72vh] w-full bg-white ${loading || error ? "hidden" : ""}`}
      />
    </section>
  );
}