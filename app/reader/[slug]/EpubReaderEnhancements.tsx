"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  bookSlug: string;
  progressKey: string;
};

type Bookmark = {
  id: string;
  label: string;
  excerpt: string;
  createdAt: string;
};

function readerRoot() {
  return document.querySelector<HTMLElement>('[data-libroseller-epub-reader="true"]');
}

function currentFrame() {
  return readerRoot()?.querySelector<HTMLIFrameElement>("iframe") ?? null;
}

function bookmarkKey(slug: string) {
  return `libroseller:bookmarks:${slug}`;
}

function readBookmarks(slug: string): Bookmark[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(bookmarkKey(slug)) || "[]") as Bookmark[];
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch {
    return [];
  }
}

function applyReadingPreferences(lineHeight: number, sidePadding: number) {
  const doc = currentFrame()?.contentDocument;
  if (!doc?.head) return;

  let style = doc.querySelector<HTMLStyleElement>("style[data-libroseller-reader-preferences]");
  if (!style) {
    style = doc.createElement("style");
    style.dataset.librosellerReaderPreferences = "true";
    doc.head.appendChild(style);
  }

  style.textContent = `
    body { line-height: ${lineHeight} !important; padding-left: ${sidePadding}px !important; padding-right: ${sidePadding}px !important; }
    p, li, blockquote { line-height: ${lineHeight} !important; }
  `;
}

function findText(query: string) {
  const frame = currentFrame();
  const doc = frame?.contentDocument;
  const win = frame?.contentWindow;
  if (!doc?.body || !win || !query.trim()) return false;

  const needle = query.trim().toLocaleLowerCase("es");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const text = node.textContent || "";
    const index = text.toLocaleLowerCase("es").indexOf(needle);
    if (index >= 0) {
      const range = doc.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + query.trim().length);
      const selection = win.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      (node.parentElement as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    node = walker.nextNode();
  }

  return false;
}

function getCurrentBookmark(): Bookmark | null {
  const doc = currentFrame()?.contentDocument;
  if (!doc?.body) return null;

  const heading = doc.querySelector("h1,h2,h3,[class*='chapter' i],[class*='title' i]")?.textContent?.trim();
  const bodyText = doc.body.innerText.replace(/\s+/g, " ").trim();
  if (!bodyText) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: (heading || "Posición guardada").slice(0, 140),
    excerpt: bodyText.slice(0, 220),
    createdAt: new Date().toISOString(),
  };
}

async function sendEvent(bookSlug: string, eventType: string, metadata: Record<string, unknown> = {}) {
  try {
    await fetch("/api/marketplace/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ bookSlug, eventType, surface: "reader", metadata }),
    });
  } catch {
    // Telemetría nunca debe interrumpir la lectura.
  }
}

export default function EpubReaderEnhancements({ bookSlug, progressKey }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [lineHeight, setLineHeight] = useState(1.7);
  const [sidePadding, setSidePadding] = useState(0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const milestoneKey = useMemo(() => `libroseller:reader-milestones:${progressKey}`, [progressKey]);

  useEffect(() => {
    setBookmarks(readBookmarks(bookSlug));
    void sendEvent(bookSlug, "reader_started");
  }, [bookSlug]);

  useEffect(() => {
    const apply = () => applyReadingPreferences(lineHeight, sidePadding);
    apply();
    const interval = window.setInterval(apply, 1200);
    return () => window.clearInterval(interval);
  }, [lineHeight, sidePadding]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(`libroseller:epub:${progressKey}`);
        if (!raw) return;
        const percent = Number((JSON.parse(raw) as { percent?: unknown }).percent);
        if (!Number.isFinite(percent)) return;

        const already = new Set<number>(JSON.parse(localStorage.getItem(milestoneKey) || "[]"));
        for (const milestone of [25, 50, 75, 100]) {
          if (percent >= milestone && !already.has(milestone)) {
            already.add(milestone);
            localStorage.setItem(milestoneKey, JSON.stringify(Array.from(already)));
            void sendEvent(bookSlug, milestone === 100 ? "reader_completed" : `reader_${milestone}`, { percent });
          }
        }
      } catch {
        // Sin impacto en UX.
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [bookSlug, milestoneKey, progressKey]);

  function search() {
    const found = findText(query);
    setSearchMessage(found ? "Coincidencia seleccionada en el capítulo actual." : "No aparece en el capítulo actual.");
    if (query.trim()) void sendEvent(bookSlug, "search", { scope: "current_chapter", queryLength: query.trim().length });
  }

  function addBookmark() {
    const bookmark = getCurrentBookmark();
    if (!bookmark) return;
    const next = [bookmark, ...bookmarks].slice(0, 100);
    setBookmarks(next);
    localStorage.setItem(bookmarkKey(bookSlug), JSON.stringify(next));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await readerRoot()?.requestFullscreen();
    } catch {
      // El navegador puede bloquear fullscreen sin interacción válida.
    }
  }

  return (
    <div className="fixed right-3 top-20 z-[70] text-slate-950">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-white/15 bg-[#0b1722]/95 px-4 py-2 text-xs font-black text-white shadow-2xl backdrop-blur"
      >
        Herramientas
      </button>

      {open ? (
        <div className="mt-2 w-[min(92vw,360px)] space-y-4 rounded-[26px] border border-slate-200 bg-white p-4 shadow-2xl">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#155eef]">Buscar en capítulo</p>
            <div className="mt-2 flex gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Palabra o frase" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <button type="button" onClick={search} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Buscar</button>
            </div>
            {searchMessage ? <p className="mt-2 text-xs text-slate-500">{searchMessage}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-600">Interlineado
              <select value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
                <option value={1.45}>Compacto</option><option value={1.7}>Cómodo</option><option value={1.9}>Amplio</option><option value={2.1}>Accesible</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Margen interno
              <select value={sidePadding} onChange={(event) => setSidePadding(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm">
                <option value={0}>Original</option><option value={12}>12 px</option><option value={24}>24 px</option><option value={36}>36 px</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={addBookmark} className="flex-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Guardar marcador</button>
            <button type="button" onClick={() => void toggleFullscreen()} className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Pantalla completa</button>
          </div>

          {bookmarks.length ? (
            <div className="max-h-40 space-y-2 overflow-auto border-t border-slate-100 pt-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Marcadores locales</p>
              {bookmarks.slice(0, 5).map((bookmark) => (
                <div key={bookmark.id} className="rounded-xl bg-slate-50 p-2 text-xs">
                  <p className="font-black text-slate-800">{bookmark.label}</p>
                  <p className="mt-1 line-clamp-2 text-slate-500">{bookmark.excerpt}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
