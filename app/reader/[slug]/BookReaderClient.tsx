"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

type BookReaderClientProps = {
  title: string;
  coverUrl: string | null;
  pdfUrl: string;
};

type SpreadData = {
  leftNumber: number | null;
  rightNumber: number | null;
  left: string | null;
  right: string | null;
};

type FlipState =
  | null
  | {
      direction: "next" | "prev" | "open-cover" | "close-cover";
      front: string | null;
      back: string | null;
      baseLeft: string | null;
      baseRight: string | null;
    };

type OutlineNodeLike = {
  title?: string;
  dest?: string | unknown[] | null;
  items?: OutlineNodeLike[];
};

const FLIP_MS = 700;
const MIN_SWIPE = 60;
const RESIZE_BUCKET = 140;
const FALLBACK_END_PAGE = 15;
const TEXT_SCAN_LIMIT = 40;

function isPageNumber(value: number | null): value is number {
  return typeof value === "number";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.92);
  });
}

function revokeAllObjectUrls(map: Map<number, string>) {
  for (const url of map.values()) {
    URL.revokeObjectURL(url);
  }
  map.clear();
}

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName;
  return (
    el.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function flattenOutline(items: OutlineNodeLike[] = []): OutlineNodeLike[] {
  return items.flatMap((item) => [item, ...flattenOutline(item.items ?? [])]);
}

function isChapterTwoTitle(title: string) {
  const text = normalizeText(title);

  return (
    /^capitulo\s*2\b/.test(text) ||
    /^capitulo\s*ii\b/.test(text) ||
    /^chapter\s*2\b/.test(text) ||
    /^chapter\s*ii\b/.test(text)
  );
}

function hasChapterTwoText(text: string) {
  const normalized = normalizeText(text);

  return (
    /\bcapitulo\s*2\b/.test(normalized) ||
    /\bcapitulo\s*ii\b/.test(normalized) ||
    /\bchapter\s*2\b/.test(normalized) ||
    /\bchapter\s*ii\b/.test(normalized)
  );
}

async function resolveOutlinePageNumber(
  pdfDoc: PDFDocumentProxy,
  item: OutlineNodeLike
): Promise<number | null> {
  if (!item.dest) return null;

  const destination =
    typeof item.dest === "string"
      ? await pdfDoc.getDestination(item.dest)
      : item.dest;

  if (!destination || !Array.isArray(destination) || !destination[0]) {
    return null;
  }

  const firstTarget = destination[0];

  if (typeof firstTarget === "number") {
    return firstTarget + 1;
  }

  try {
    const pageIndex = await pdfDoc.getPageIndex(firstTarget as never);
    return pageIndex + 1;
  } catch {
    return null;
  }
}

async function detectChapterOneEndPage(
  pdfDoc: PDFDocumentProxy
): Promise<number> {
  const hardFallback = Math.min(pdfDoc.numPages, FALLBACK_END_PAGE);

  try {
    const outline = (await pdfDoc.getOutline()) as OutlineNodeLike[] | null;

    if (outline && outline.length > 0) {
      const allItems = flattenOutline(outline);
      const chapterTwoItem = allItems.find((item) =>
        isChapterTwoTitle(item.title ?? "")
      );

      if (chapterTwoItem) {
        const chapterTwoPage = await resolveOutlinePageNumber(
          pdfDoc,
          chapterTwoItem
        );

        if (chapterTwoPage && chapterTwoPage > 1) {
          return Math.min(pdfDoc.numPages, chapterTwoPage - 1);
        }
      }
    }
  } catch {
    // seguimos con fallback por texto
  }

  try {
    const maxScanPage = Math.min(pdfDoc.numPages, TEXT_SCAN_LIMIT);

    for (let pageNumber = 1; pageNumber <= maxScanPage; pageNumber += 1) {
      let page: PDFPageProxy | null = null;

      try {
        page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) =>
            "str" in item && typeof item.str === "string" ? item.str : ""
          )
          .join(" ");

        page.cleanup();

        if (hasChapterTwoText(pageText)) {
          return Math.max(1, pageNumber - 1);
        }
      } catch {
        page?.cleanup();
      }
    }
  } catch {
    // seguimos con fallback duro
  }

  return hardFallback;
}

function PageSurface({
  src,
  side,
  label,
}: {
  src: string | null;
  side: "left" | "right";
  label: string;
}) {
  const isLeft = side === "left";

  return (
    <div
      className={[
        "relative h-full overflow-hidden border border-slate-300 bg-white",
        "shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
        isLeft
          ? "rounded-l-[28px] rounded-r-[10px] border-r-0"
          : "rounded-r-[28px] rounded-l-[10px] border-l-0",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none absolute inset-0 z-[2]",
          isLeft
            ? "bg-[linear-gradient(to_right,rgba(15,23,42,0.12),transparent_18%)]"
            : "bg-[linear-gradient(to_left,rgba(15,23,42,0.12),transparent_18%)]",
        ].join(" ")}
      />

      <div className="relative z-[1] flex h-full items-center justify-center p-3">
        {src ? (
          <img
            src={src}
            alt={label}
            draggable={false}
            loading="eager"
            className="h-full w-full select-none object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            Página vacía
          </div>
        )}
      </div>
    </div>
  );
}

function FlipLeaf({
  flip,
  active,
}: {
  flip: NonNullable<FlipState>;
  active: boolean;
}) {
  const forward = flip.direction === "next" || flip.direction === "open-cover";

  const transform = forward
    ? active
      ? "rotateY(-180deg)"
      : "rotateY(0deg)"
    : active
      ? "rotateY(180deg)"
      : "rotateY(0deg)";

  return (
    <div
      className="pointer-events-none absolute bottom-6 top-6 z-20"
      style={{
        left: forward ? "50%" : "0%",
        width: "50%",
        transformStyle: "preserve-3d",
        transformOrigin: forward ? "left center" : "right center",
        transform,
        transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: "transform",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <PageSurface
          src={flip.front}
          side={forward ? "right" : "left"}
          label="Hoja frontal"
        />
        <div
          className={[
            "absolute inset-0",
            forward
              ? "bg-[linear-gradient(to_left,rgba(15,23,42,0.22),transparent_28%)]"
              : "bg-[linear-gradient(to_right,rgba(15,23,42,0.22),transparent_28%)]",
          ].join(" ")}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <PageSurface
          src={flip.back}
          side={forward ? "left" : "right"}
          label="Hoja trasera"
        />
        <div
          className={[
            "absolute inset-0",
            forward
              ? "bg-[linear-gradient(to_right,rgba(15,23,42,0.18),transparent_24%)]"
              : "bg-[linear-gradient(to_left,rgba(15,23,42,0.18),transparent_24%)]",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

export default function BookReaderClient({
  title,
  coverUrl,
  pdfUrl,
}: BookReaderClientProps) {
  const hasCover = Boolean(coverUrl);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dynamicEndPage, setDynamicEndPage] = useState(FALLBACK_END_PAGE);

  const [currentSpread, setCurrentSpread] = useState<number>(hasCover ? -1 : 0);
  const [flip, setFlip] = useState<FlipState>(null);
  const [flipActive, setFlipActive] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [bookWidth, setBookWidth] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const cacheRef = useRef<Map<number, string>>(new Map());
  const pendingRef = useRef<Map<number, Promise<string | null>>>(new Map());

  const timerRef = useRef<number | null>(null);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);

  const generationRef = useRef(0);
  const resizeBucketRef = useRef<number | null>(null);
  const navLockRef = useRef(false);

  const totalPdfPages = pdfDoc?.numPages ?? 0;

  const visibleRange = useMemo(
    () => ({
      start: 1,
      end: dynamicEndPage,
    }),
    [dynamicEndPage]
  );

  const visiblePageCount = useMemo(() => {
    if (totalPdfPages === 0) return 0;

    const safeStart = Math.max(1, visibleRange.start);
    const safeEnd = Math.min(totalPdfPages, visibleRange.end);

    if (safeEnd < safeStart) return 0;

    return safeEnd - safeStart + 1;
  }, [totalPdfPages, visibleRange.end, visibleRange.start]);

  const spreadCount = useMemo(() => {
    if (visiblePageCount === 0) return 0;
    return Math.ceil((visiblePageCount + 1) / 2);
  }, [visiblePageCount]);

  const toRealPageNumber = useCallback(
    (visiblePageNumber: number) => visibleRange.start + visiblePageNumber - 1,
    [visibleRange.start]
  );

  const bumpRender = useCallback(() => {
    setRenderTick((value) => value + 1);
  }, []);

  const clearAnimationHandles = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (raf1Ref.current !== null) {
      window.cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = null;
    }

    if (raf2Ref.current !== null) {
      window.cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
    }
  }, []);

  const clearCache = useCallback(
    (refresh = true) => {
      pendingRef.current.clear();
      revokeAllObjectUrls(cacheRef.current);

      if (refresh) {
        bumpRender();
      }
    },
    [bumpRender]
  );

  const getSpreadPages = useCallback(
    (spreadIndex: number): SpreadData => {
      if (spreadIndex < 0 || visiblePageCount === 0) {
        return {
          leftNumber: null,
          rightNumber: null,
          left: null,
          right: null,
        };
      }

      const leftVisibleNumber = spreadIndex === 0 ? null : spreadIndex * 2;
      const rawRightVisibleNumber = spreadIndex === 0 ? 1 : spreadIndex * 2 + 1;

      const rightVisibleNumber =
        rawRightVisibleNumber <= visiblePageCount ? rawRightVisibleNumber : null;

      const leftRealNumber = leftVisibleNumber
        ? toRealPageNumber(leftVisibleNumber)
        : null;

      const rightRealNumber = rightVisibleNumber
        ? toRealPageNumber(rightVisibleNumber)
        : null;

      return {
        leftNumber: leftRealNumber,
        rightNumber: rightRealNumber,
        left: leftRealNumber ? cacheRef.current.get(leftRealNumber) ?? null : null,
        right: rightRealNumber
          ? cacheRef.current.get(rightRealNumber) ?? null
          : null,
      };
    },
    [toRealPageNumber, visiblePageCount]
  );

  const ensurePageImage = useCallback(
    async (pageNumber: number): Promise<string | null> => {
      const minPage = Math.max(1, visibleRange.start);
      const maxPage = Math.min(totalPdfPages, visibleRange.end);

      if (!pdfDoc || pageNumber < minPage || pageNumber > maxPage) {
        return null;
      }

      const cached = cacheRef.current.get(pageNumber);
      if (cached) return cached;

      const pending = pendingRef.current.get(pageNumber);
      if (pending) return pending;

      const generationAtStart = generationRef.current;

      const promise = (async () => {
        let page: PDFPageProxy | null = null;
        let objectUrl: string | null = null;

        try {
          page = await pdfDoc.getPage(pageNumber);

          if (generationAtStart !== generationRef.current) {
            page.cleanup();
            return null;
          }

          const baseViewport = page.getViewport({ scale: 1 });
          const dpr =
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

          const safeBookWidth = Math.max(bookWidth || 1100, 720);
          const targetPageWidth = Math.max(
            900,
            Math.min(1800, Math.floor((safeBookWidth / 2) * dpr * 1.2))
          );

          const scale = targetPageWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            page.cleanup();
            return null;
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;

          const blob = await canvasToBlob(canvas);

          page.cleanup();
          canvas.width = 0;
          canvas.height = 0;

          if (!blob) return null;

          objectUrl = URL.createObjectURL(blob);

          if (generationAtStart !== generationRef.current) {
            URL.revokeObjectURL(objectUrl);
            return null;
          }

          cacheRef.current.set(pageNumber, objectUrl);
          bumpRender();

          return objectUrl;
        } catch {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          return null;
        } finally {
          pendingRef.current.delete(pageNumber);
        }
      })();

      pendingRef.current.set(pageNumber, promise);
      return promise;
    },
    [bookWidth, bumpRender, pdfDoc, totalPdfPages, visibleRange.end, visibleRange.start]
  );

  const startFlip = useCallback(
    (nextFlip: NonNullable<FlipState>, onDone: () => void) => {
      clearAnimationHandles();

      setFlip(nextFlip);
      setFlipActive(false);
      setIsFlipping(true);

      raf1Ref.current = window.requestAnimationFrame(() => {
        raf2Ref.current = window.requestAnimationFrame(() => {
          setFlipActive(true);
        });
      });

      timerRef.current = window.setTimeout(() => {
        onDone();
        setFlip(null);
        setFlipActive(false);
        setIsFlipping(false);
        navLockRef.current = false;
      }, FLIP_MS);
    },
    [clearAnimationHandles]
  );

  const currentSpreadData = useMemo(
    () => getSpreadPages(currentSpread),
    [currentSpread, getSpreadPages, renderTick]
  );

  const isCoverView = hasCover && currentSpread === -1;

  const canGoNext =
    !isFlipping &&
    !navLockRef.current &&
    ((hasCover && currentSpread === -1 && visiblePageCount > 0) ||
      currentSpread < spreadCount - 1);

  const canGoPrev =
    !isFlipping &&
    !navLockRef.current &&
    (currentSpread > 0 || (hasCover && currentSpread === 0));

  const goNext = useCallback(async () => {
    if (!canGoNext || navLockRef.current) return;

    navLockRef.current = true;

    try {
      if (hasCover && currentSpread === -1) {
        const firstSpread = getSpreadPages(0);
        const firstPage = isPageNumber(firstSpread.rightNumber)
          ? await ensurePageImage(firstSpread.rightNumber)
          : null;

        startFlip(
          {
            direction: "open-cover",
            front: coverUrl,
            back: firstPage,
            baseLeft: null,
            baseRight: firstPage,
          },
          () => setCurrentSpread(0)
        );

        return;
      }

      const current = getSpreadPages(currentSpread);
      const target = getSpreadPages(currentSpread + 1);

      const front = isPageNumber(current.rightNumber)
        ? await ensurePageImage(current.rightNumber)
        : null;

      const back = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseLeft = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseRight = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      startFlip(
        {
          direction: "next",
          front,
          back,
          baseLeft,
          baseRight,
        },
        () => setCurrentSpread((prev) => Math.min(prev + 1, spreadCount - 1))
      );
    } catch {
      navLockRef.current = false;
      setIsFlipping(false);
    }
  }, [
    canGoNext,
    coverUrl,
    currentSpread,
    ensurePageImage,
    getSpreadPages,
    hasCover,
    spreadCount,
    startFlip,
  ]);

  const goPrev = useCallback(async () => {
    if (!canGoPrev || navLockRef.current) return;

    navLockRef.current = true;

    try {
      if (hasCover && currentSpread === 0) {
        const current = getSpreadPages(0);
        const firstPage = isPageNumber(current.rightNumber)
          ? await ensurePageImage(current.rightNumber)
          : null;

        startFlip(
          {
            direction: "close-cover",
            front: null,
            back: coverUrl,
            baseLeft: null,
            baseRight: firstPage,
          },
          () => setCurrentSpread(-1)
        );

        return;
      }

      const current = getSpreadPages(currentSpread);
      const target = getSpreadPages(currentSpread - 1);

      const front = isPageNumber(current.leftNumber)
        ? await ensurePageImage(current.leftNumber)
        : null;

      const back = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      const baseLeft = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseRight = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      startFlip(
        {
          direction: "prev",
          front,
          back,
          baseLeft,
          baseRight,
        },
        () => setCurrentSpread((prev) => Math.max(prev - 1, 0))
      );
    } catch {
      navLockRef.current = false;
      setIsFlipping(false);
    }
  }, [
    canGoPrev,
    coverUrl,
    currentSpread,
    ensurePageImage,
    getSpreadPages,
    hasCover,
    startFlip,
  ]);

  useEffect(() => {
    let cancelled = false;
    let localDoc: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        setPdfDoc(null);
        setDynamicEndPage(FALLBACK_END_PAGE);

        generationRef.current += 1;
        navLockRef.current = false;
        clearAnimationHandles();
        clearCache();

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;

        if (cancelled) {
          await doc.destroy();
          return;
        }

        localDoc = doc;

        const detectedEndPage = doc.numPages;

        if (cancelled) {
          await doc.destroy();
          return;
        }

        setDynamicEndPage(detectedEndPage);
        setPdfDoc(doc);
        setCurrentSpread(hasCover ? -1 : 0);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("No se pudo abrir el PDF del libro.");
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      generationRef.current += 1;
      navLockRef.current = false;
      clearAnimationHandles();
      clearCache(false);
      void localDoc?.destroy();
    };
  }, [clearAnimationHandles, clearCache, hasCover, pdfUrl]);

  useEffect(() => {
    if (!viewportRef.current) return;

    const node = viewportRef.current;

    const updateWidth = (width: number) => {
      setBookWidth(width);

      const bucket = Math.max(1, Math.round(width / RESIZE_BUCKET));

      if (resizeBucketRef.current === null) {
        resizeBucketRef.current = bucket;
        return;
      }

      if (bucket !== resizeBucketRef.current) {
        resizeBucketRef.current = bucket;
        generationRef.current += 1;
        clearCache();
      }
    };

    updateWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      updateWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [clearCache]);

  useEffect(() => {
    if (!pdfDoc || visiblePageCount === 0) return;

    const warmNearbyPages = async () => {
      const spreadsToWarm =
        currentSpread < 0
          ? [0, 1]
          : [currentSpread - 1, currentSpread, currentSpread + 1];

      const candidates = spreadsToWarm
        .flatMap((spreadIndex) => {
          const spread = getSpreadPages(spreadIndex);
          return [spread.leftNumber, spread.rightNumber];
        })
        .filter(isPageNumber);

      const unique = [...new Set(candidates)];

      await Promise.all(unique.map((page) => ensurePageImage(page)));
    };

    void warmNearbyPages();
  }, [currentSpread, ensurePageImage, getSpreadPages, visiblePageCount, pdfDoc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void goNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void goPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  useEffect(() => {
    return () => {
      clearAnimationHandles();
      clearCache(false);
    };
  }, [clearAnimationHandles, clearCache]);

  const progressLabel = isCoverView
    ? "Portada"
    : `Lectura completa · ${totalPdfPages} páginas`;
  return (
    <section className="w-full px-4 py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">
            {title}
          </h1>
          <p className="text-sm text-slate-500">{progressLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void goPrev()}
            disabled={!canGoPrev}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => void goNext()}
            disabled={!canGoNext}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mx-auto max-w-7xl touch-pan-y"
        onTouchStart={(event) => {
          touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartXRef.current;
          const endX = event.changedTouches[0]?.clientX ?? null;

          touchStartXRef.current = null;

          if (startX === null || endX === null) return;

          const delta = endX - startX;

          if (delta <= -MIN_SWIPE) {
            void goNext();
          } else if (delta >= MIN_SWIPE) {
            void goPrev();
          }
        }}
      >
        {loading ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 shadow-sm">
              Cargando libro...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        ) : isCoverView ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-[linear-gradient(to_right,rgba(15,23,42,0.18),transparent)]" />
              <div className="relative aspect-[3/4]">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={`Portada de ${title}`}
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative mx-auto h-[72vh] max-h-[920px] min-h-[460px] w-full max-w-7xl"
            style={{ perspective: "2400px" }}
          >
            <div className="absolute inset-x-6 inset-y-6">
              <div className="absolute inset-y-0 left-1/2 z-[1] w-px -translate-x-1/2 bg-slate-300 shadow-[0_0_30px_rgba(15,23,42,0.18)]" />

              <div className="grid h-full w-full grid-cols-2">
                <PageSurface
                  src={flip ? flip.baseLeft : currentSpreadData.left}
                  side="left"
                  label="Página izquierda"
                />
                <PageSurface
                  src={flip ? flip.baseRight : currentSpreadData.right}
                  side="right"
                  label="Página derecha"
                />
              </div>

              {flip ? <FlipLeaf flip={flip} active={flipActive} /> : null}

              {isFlipping ? (
                <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow">
                  Pasando hoja...
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}