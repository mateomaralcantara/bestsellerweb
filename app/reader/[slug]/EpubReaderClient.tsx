"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
      rendition?: { layout?: unknown };
    };
  };
  packaging?: {
    metadata?: {
      layout?: unknown;
      rendition?: { layout?: unknown };
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

type Size = {
  width: number;
  height: number;
};

type StructuralLayoutProbe = {
  fixed: boolean;
  ratio: number | null;
  evidencePages: number;
  reason: string;
};

const MIN_FONT = 85;
const MAX_FONT = 150;
const FONT_STEP = 10;

// 120 no significa 120% de un tamaño arbitrario: es el punto FIT TO CANVAS.
const DEFAULT_PAGE_ZOOM = 120;
const MIN_PAGE_ZOOM = 100;
const MAX_PAGE_ZOOM = 250;
const PAGE_ZOOM_STEP = 10;

const SAVE_DELAY_MS = 600;
const LOCATION_CHARS = 900;
const FIXED_LAYOUT_DEFAULT_RATIO = 2 / 3;
const REFLOWABLE_MAX_WIDTH = 1060;
const REFLOWABLE_GUTTER = 14;
const FIXED_STYLE_ID = "libroseller-fixed-layout-lock";

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

function metadataSaysFixed(book: EpubBook) {
  const metadata = book.package?.metadata ?? book.packaging?.metadata;
  const layout = asText(
    metadata?.layout ?? metadata?.rendition?.layout
  ).toLowerCase();

  return layout.includes("pre-paginated") || layout.includes("fixed");
}

function localKey(progressKey: string) {
  return `libroseller:epub:${progressKey}`;
}

function forceOriginalVariant(url: string) {
  if (/(?:\?|&)variant=/i.test(url)) {
    return url.replace(
      /([?&])variant=[^&]*/i,
      "$1variant=original"
    );
  }

  return `${url}${url.includes("?") ? "&" : "?"}variant=original`;
}

function fitFixedPage(container: Size, ratio: number): Size {
  const safeRatio =
    Number.isFinite(ratio) && ratio > 0 ? ratio : FIXED_LAYOUT_DEFAULT_RATIO;

  const maxWidth = Math.max(1, container.width);
  const maxHeight = Math.max(1, container.height);

  let width = maxWidth;
  let height = width / safeRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * safeRatio;
  }

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

function getReflowablePageSize(container: Size): Size {
  return {
    width: Math.max(
      1,
      Math.min(
        REFLOWABLE_MAX_WIDTH,
        container.width - REFLOWABLE_GUTTER * 2
      )
    ),
    height: Math.max(1, container.height - REFLOWABLE_GUTTER * 2),
  };
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
  if (fixedLayout) return {};

  return {
    body: {
      "text-rendering": "optimizeLegibility !important",
      "-webkit-font-smoothing": "antialiased !important",
    },
    "h1, h2, h3, h4, h5, h6": {
      "text-align": "center !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
    },
    "p, li, blockquote": {
      "text-align": "justify !important",
      "text-justify": "inter-word !important",
      hyphens: "auto !important",
      orphans: "2 !important",
      widows: "2 !important",
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
    },
    table: {
      "max-width": "100% !important",
      "border-collapse": "collapse !important",
      "margin-left": "auto !important",
      "margin-right": "auto !important",
    },
    "pre, code": {
      "white-space": "pre-wrap !important",
      "overflow-wrap": "anywhere !important",
    },
  };
}

function nightRules(
  fixedLayout: boolean
): Record<string, Record<string, string>> {
  if (fixedLayout) return {};

  const base = paperRules(false);

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

function epubAttr(source: string, name: string) {
  return (
    source.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]?.trim() ||
    ""
  );
}

function epubZipPath(baseDir: string, href: string) {
  const raw = `${baseDir}/${href.split("#")[0] || ""}`.replace(/\\/g, "/");
  const stack: string[] = [];

  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

function epubMeaningfulText(html: string) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;

  return body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*\/?>/gi, " ")
    .replace(/<br\b[^>]*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function ratioFromViewportMarkup(html: string) {
  const content =
    html.match(
      /<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["'][^>]*>/i
    )?.[1] ||
    html.match(
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']viewport["'][^>]*>/i
    )?.[1] ||
    "";

  const width = Number(
    content.match(/(?:^|[,;]\s*)width\s*=\s*([0-9.]+)/i)?.[1]
  );
  const height = Number(
    content.match(/(?:^|[,;]\s*)height\s*=\s*([0-9.]+)/i)?.[1]
  );

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const ratio = width / height;
  return ratio >= 0.25 && ratio <= 4 ? ratio : null;
}

async function detectFixedImageLayoutFromBuffer(
  buffer: ArrayBuffer
): Promise<StructuralLayoutProbe> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const container = await zip.file("META-INF/container.xml")?.async("string");

    if (!container) {
      return { fixed: false, ratio: null, evidencePages: 0, reason: "missing-container" };
    }

    const opfPath =
      container.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "";
    const opf = opfPath ? await zip.file(opfPath)?.async("string") : "";

    if (!opf || !opfPath) {
      return { fixed: false, ratio: null, evidencePages: 0, reason: "missing-opf" };
    }

    const declaredLayout =
      opf
        .match(
          /<meta\b[^>]*property=["']rendition:layout["'][^>]*>([\s\S]*?)<\/meta>/i
        )?.[1]
        ?.trim()
        .toLowerCase() || "";

    const legacyFixed =
      /<meta\b[^>]*name=["']fixed-layout["'][^>]*content=["'](?:true|yes)["']/i.test(
        opf
      );

    const metadataFixed =
      legacyFixed ||
      declaredLayout.includes("pre-paginated") ||
      declaredLayout.includes("fixed");

    const manifest = new Map<
      string,
      { href: string; mediaType: string; properties: string }
    >();

    for (const match of Array.from(opf.matchAll(/<item\b([^>]*)\/?>/gi))) {
      const attrs = match[1] || "";
      const id = epubAttr(attrs, "id");
      const href = epubAttr(attrs, "href");
      if (!id || !href) continue;

      manifest.set(id, {
        href,
        mediaType: epubAttr(attrs, "media-type").toLowerCase(),
        properties: epubAttr(attrs, "properties").toLowerCase(),
      });
    }

    const opfDir = opfPath.includes("/")
      ? opfPath.slice(0, opfPath.lastIndexOf("/"))
      : "";

    const readable: Array<{
      href: string;
      mediaType: string;
      properties: string;
    }> = [];

    for (const match of Array.from(opf.matchAll(/<itemref\b([^>]*)\/?>/gi))) {
      const attrs = match[1] || "";
      const idref = epubAttr(attrs, "idref");
      const linear = epubAttr(attrs, "linear").toLowerCase();
      const item = manifest.get(idref);

      if (!item || linear === "no") continue;
      if (/\bnav\b/.test(item.properties)) continue;
      if (
        item.mediaType !== "application/xhtml+xml" &&
        item.mediaType !== "text/html"
      ) {
        continue;
      }
      if (isSkippableSection(item.href)) continue;

      readable.push(item);
    }

    const ratios: number[] = [];

    for (const item of readable.slice(0, 8)) {
      const html = await zip.file(epubZipPath(opfDir, item.href))?.async("string");
      if (!html) continue;

      const images = Array.from(html.matchAll(/<img\b[^>]*\/?>/gi));
      if (images.length !== 1) continue;
      if (epubMeaningfulText(html)) continue;

      const ratio = ratioFromViewportMarkup(html);
      if (ratio) ratios.push(ratio);
    }

    const requiredEvidence = readable.length >= 3 ? 3 : readable.length;
    const enoughEvidence =
      requiredEvidence > 0 && ratios.length >= requiredEvidence;

    let ratio: number | null = null;
    let consistent = false;

    if (ratios.length > 0) {
      const average =
        ratios.reduce((sum, value) => sum + value, 0) / ratios.length;

      consistent = ratios.every(
        (value) => Math.abs(value - average) / average <= 0.08
      );

      if (consistent) ratio = average;
    }

    const structuralFixed = enoughEvidence && consistent;

    return {
      fixed: metadataFixed || structuralFixed,
      ratio,
      evidencePages: ratios.length,
      reason: metadataFixed
        ? structuralFixed
          ? "metadata+structural"
          : "metadata"
        : structuralFixed
          ? "structural-image-pages"
          : "reflowable-or-unknown",
    };
  } catch (probeError) {
    console.warn("EPUB structural probe omitido:", probeError);
    return { fixed: false, ratio: null, evidencePages: 0, reason: "probe-error" };
  }
}

function readRenderedPage(viewer: HTMLElement) {
  try {
    const iframe = viewer.querySelector<HTMLIFrameElement>("iframe");
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return null;

    const viewportMeta = doc
      .querySelector('meta[name="viewport"]')
      ?.getAttribute("content") || "";

    const width = Number(
      viewportMeta.match(/(?:^|[,;]\s*)width\s*=\s*([0-9.]+)/i)?.[1]
    );
    const height = Number(
      viewportMeta.match(/(?:^|[,;]\s*)height\s*=\s*([0-9.]+)/i)?.[1]
    );

    let ratio =
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
        ? width / height
        : null;

    const images = Array.from(doc.body.querySelectorAll("img"));
    const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();

    if ((!ratio || ratio < 0.25 || ratio > 4) && images.length === 1) {
      const image = images[0];
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        ratio = image.naturalWidth / image.naturalHeight;
      }
    }

    return {
      iframe,
      doc,
      ratio: ratio && ratio >= 0.25 && ratio <= 4 ? ratio : null,
      imageOnly: images.length === 1 && text.length === 0,
      image: images.length === 1 ? images[0] : null,
    };
  } catch {
    return null;
  }
}

function lockFixedPage(viewer: HTMLElement) {
  const page = readRenderedPage(viewer);
  if (!page) return null;

  const { iframe, doc, imageOnly, image } = page;

  iframe.dataset.librosellerFixedLayout = "true";
  iframe.style.setProperty("display", "block", "important");
  iframe.style.setProperty("width", "100%", "important");
  iframe.style.setProperty("height", "100%", "important");
  iframe.style.setProperty("margin", "0", "important");
  iframe.style.setProperty("padding", "0", "important");
  iframe.style.setProperty("border", "0", "important");

  doc.documentElement.dataset.librosellerFixedLayout = "true";
  doc.body.dataset.librosellerFixedLayout = "true";

  doc.documentElement.style.setProperty("margin", "0", "important");
  doc.documentElement.style.setProperty("padding", "0", "important");
  doc.documentElement.style.setProperty("width", "100%", "important");
  doc.documentElement.style.setProperty("height", "100%", "important");
  doc.documentElement.style.setProperty("overflow", "hidden", "important");

  doc.body.style.setProperty("margin", "0", "important");
  doc.body.style.setProperty("padding", "0", "important");
  doc.body.style.setProperty("width", "100%", "important");
  doc.body.style.setProperty("height", "100%", "important");
  doc.body.style.setProperty("max-width", "none", "important");
  doc.body.style.setProperty("max-height", "none", "important");
  doc.body.style.setProperty("overflow", "hidden", "important");

  if (!doc.getElementById(FIXED_STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = FIXED_STYLE_ID;
    style.textContent = `
      html[data-libroseller-fixed-layout="true"],
      html[data-libroseller-fixed-layout="true"] body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        overflow: hidden !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  if (imageOnly && image) {
    doc.body.style.setProperty("display", "flex", "important");
    doc.body.style.setProperty("align-items", "center", "important");
    doc.body.style.setProperty("justify-content", "center", "important");

    let ancestor = image.parentElement;
    while (ancestor && ancestor !== doc.body) {
      ancestor.style.setProperty("margin", "0", "important");
      ancestor.style.setProperty("padding", "0", "important");
      ancestor.style.setProperty("border", "0", "important");
      ancestor.style.setProperty("width", "100%", "important");
      ancestor.style.setProperty("height", "100%", "important");
      ancestor.style.setProperty("max-width", "none", "important");
      ancestor.style.setProperty("max-height", "none", "important");
      ancestor.style.setProperty("position", "static", "important");
      ancestor.style.setProperty("inset", "auto", "important");
      ancestor.style.setProperty("transform", "none", "important");
      ancestor.style.setProperty("overflow", "hidden", "important");
      ancestor = ancestor.parentElement;
    }

    image.style.setProperty("display", "block", "important");
    image.style.setProperty("position", "static", "important");
    image.style.setProperty("inset", "auto", "important");
    image.style.setProperty("transform", "none", "important");
    image.style.setProperty("margin", "0", "important");
    image.style.setProperty("padding", "0", "important");
    image.style.setProperty("border", "0", "important");
    image.style.setProperty("width", "100%", "important");
    image.style.setProperty("height", "100%", "important");
    image.style.setProperty("max-width", "none", "important");
    image.style.setProperty("max-height", "none", "important");
    image.style.setProperty("object-fit", "contain", "important");
    image.style.setProperty("object-position", "center center", "important");
  }

  return page.ratio;
}

function resizeRendition(
  viewer: HTMLElement,
  rendition: EpubRendition,
  fixedLayout: boolean
) {
  const rect = viewer.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  rendition.resize(width, height);
  return fixedLayout ? lockFixedPage(viewer) : null;
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
  const [pageZoom, setPageZoom] = useState(DEFAULT_PAGE_ZOOM);
  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [progress, setProgress] = useState(0);
  const [locationLabel, setLocationLabel] = useState("Inicio");
  const [moving, setMoving] = useState(false);
  const [fixedLayout, setFixedLayout] = useState(false);
  const [fixedPageRatio, setFixedPageRatio] = useState(
    FIXED_LAYOUT_DEFAULT_RATIO
  );
  const [stageSize, setStageSize] = useState<Size>({ width: 1, height: 1 });

  const progressText = useMemo(
    () => `${Math.round(clamp(progress, 0, 100))}%`,
    [progress]
  );

  const readerScale = fixedLayout ? pageZoom : fontSize;
  const readerScaleMin = fixedLayout ? MIN_PAGE_ZOOM : MIN_FONT;
  const readerScaleMax = fixedLayout ? MAX_PAGE_ZOOM : MAX_FONT;
  const readerScaleStep = fixedLayout ? PAGE_ZOOM_STEP : FONT_STEP;
  const readerScaleDefault = fixedLayout ? DEFAULT_PAGE_ZOOM : 100;

  const fixedFitSize = useMemo(
    () => fitFixedPage(stageSize, fixedPageRatio),
    [fixedPageRatio, stageSize]
  );

  const fixedScale = pageZoom / DEFAULT_PAGE_ZOOM;
  const fixedRenderedSize = useMemo<Size>(
    () => ({
      width: Math.max(1, Math.round(fixedFitSize.width * fixedScale)),
      height: Math.max(1, Math.round(fixedFitSize.height * fixedScale)),
    }),
    [fixedFitSize.height, fixedFitSize.width, fixedScale]
  );

  const reflowableSize = useMemo(
    () => getReflowablePageSize(stageSize),
    [stageSize]
  );

  const activePageSize = fixedLayout ? fixedRenderedSize : reflowableSize;

  const workspaceSize = useMemo<Size>(
    () =>
      fixedLayout
        ? {
            width: Math.max(stageSize.width, fixedRenderedSize.width),
            height: Math.max(stageSize.height, fixedRenderedSize.height),
          }
        : stageSize,
    [fixedLayout, fixedRenderedSize, stageSize]
  );

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
        void fetch(progressUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentLocation: cfi,
            progressPercent: normalized,
            locationType: "epub_cfi",
          }),
        }).catch((saveError) =>
          console.warn("No se pudo guardar progreso EPUB:", saveError)
        );
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

      const remoteCfi = asText(payload.progress?.currentLocation);
      const remotePercent = Number(payload.progress?.progressPercent);

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
      setPageZoom(DEFAULT_PAGE_ZOOM);
    } else {
      setFontSize(100);
    }
  }, [fixedLayout]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const update = () => {
      const rect = stage.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      };

      setStageSize((previous) =>
        previous.width === next.width && previous.height === next.height
          ? previous
          : next
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function boot() {
      const startedAt = performance.now();
      setLoading(true);
      setError("");
      readyRef.current = false;
      fixedLayoutRef.current = false;
      locationsReadyRef.current = false;
      currentCfiRef.current = null;
      currentHrefRef.current = null;
      setFixedLayout(false);
      setFixedPageRatio(FIXED_LAYOUT_DEFAULT_RATIO);
      setPageZoom(DEFAULT_PAGE_ZOOM);

      try {
        const savedPromise = loadSavedProgress();
        const response = await fetch(forceOriginalVariant(epubUrl), {
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

        const structuralPromise = detectFixedImageLayoutFromBuffer(buffer);
        const imported = await import("epubjs");
        const factory = imported.default as unknown as EpubFactory;
        const book = factory(buffer);
        bookRef.current = book;

        if (book.ready) await book.ready;
        if (cancelled) return;

        const structural = await structuralPromise;
        const metadataFixed = metadataSaysFixed(book);
        const detectedFixed = metadataFixed || structural.fixed;
        const initialRatio =
          structural.ratio ?? FIXED_LAYOUT_DEFAULT_RATIO;

        fixedLayoutRef.current = detectedFixed;
        setFixedLayout(detectedFixed);
        setFixedPageRatio(initialRatio);

        const stage = stageRef.current;
        if (stage) {
          const rect = stage.getBoundingClientRect();
          setStageSize({
            width: Math.max(1, Math.floor(rect.width)),
            height: Math.max(1, Math.floor(rect.height)),
          });
        }

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve())
          );
        });

        if (cancelled) return;

        const viewer = viewerRef.current;
        if (!viewer) {
          throw new Error("No se encontró el canvas persistente del lector EPUB.");
        }

        const spineItems = Array.isArray(book.spine?.spineItems)
          ? book.spine?.spineItems ?? []
          : [];
        const readableSpine = spineItems.filter(isReadableSpineItem);
        readableSpineRef.current = readableSpine;

        const firstReadable = readableSpine[0] ?? book.spine?.first?.();
        const firstHref = asText(firstReadable?.href) || undefined;

        const viewerRect = viewer.getBoundingClientRect();
        const rendition = book.renderTo(viewer, {
          width: Math.max(1, Math.floor(viewerRect.width)),
          height: Math.max(1, Math.floor(viewerRect.height)),
          spread: "none",
          flow: "paginated",
          manager: "default",
        });
        renditionRef.current = rendition;

        rendition.themes.register?.("paper", paperRules(detectedFixed));
        rendition.themes.register?.("night", nightRules(detectedFixed));
        rendition.themes.select("paper");

        if (!detectedFixed) {
          rendition.themes.fontSize("100%");
        }

        rendition.on("rendered", () => {
          window.requestAnimationFrame(() => {
            const currentViewer = viewerRef.current;
            const currentRendition = renditionRef.current;
            if (!currentViewer || !currentRendition) return;

            try {
              const ratio = resizeRendition(
                currentViewer,
                currentRendition,
                fixedLayoutRef.current
              );

              if (fixedLayoutRef.current && ratio) {
                setFixedPageRatio((previous) =>
                  Math.abs(previous - ratio) > 0.001 ? ratio : previous
                );
              }
            } catch (renderError) {
              console.warn("EPUB rendered sync:", renderError);
            }
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
        if (saved.percent > 0) applyProgress(saved.percent);

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

        if (cancelled) return;

        readyRef.current = true;

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve())
          );
        });

        const readyViewer = viewerRef.current;
        if (readyViewer) {
          const ratio = resizeRendition(
            readyViewer,
            rendition,
            fixedLayoutRef.current
          );

          if (fixedLayoutRef.current && ratio) {
            setFixedPageRatio(ratio);
          }
        }

        setLoading(false);

        console.info("LibroSeller EPUB reader ready:", {
          metadataFixed,
          structuralFixed: structural.fixed,
          structuralEvidencePages: structural.evidencePages,
          structuralReason: structural.reason,
          fixedLayout: detectedFixed,
          ratio: initialRatio,
          sourceVariant: "original",
          readyMs: Math.round(performance.now() - startedAt),
        });

        void book.locations
          .generate(LOCATION_CHARS)
          .then(() => {
            if (cancelled) return;
            locationsReadyRef.current = true;

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
            } catch {
              // El progreso estructural ya está disponible.
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
      fixedLayoutRef.current = false;
      locationsReadyRef.current = false;

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
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

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.style.width = `${activePageSize.width}px`;
    viewer.style.height = `${activePageSize.height}px`;
  }, [activePageSize.height, activePageSize.width]);

  useLayoutEffect(() => {
    if (!readyRef.current) return;

    let secondFrame: number | null = null;

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const viewer = viewerRef.current;
        const rendition = renditionRef.current;
        if (!viewer || !rendition || !readyRef.current) return;

        try {
          const ratio = resizeRendition(
            viewer,
            rendition,
            fixedLayoutRef.current
          );

          if (fixedLayoutRef.current && ratio) {
            setFixedPageRatio((previous) =>
              Math.abs(previous - ratio) > 0.001 ? ratio : previous
            );
          }
        } catch (resizeError) {
          console.warn("EPUB resize pospuesto:", resizeError);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [
    activePageSize.height,
    activePageSize.width,
    fixedLayout,
    stageSize.height,
    stageSize.width,
  ]);

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
  }, [fixedLayout, fixedRenderedSize.height, fixedRenderedSize.width, pageZoom]);

  useEffect(() => {
    if (fixedLayoutRef.current) return;
    renditionRef.current?.themes.fontSize(`${fontSize}%`);
  }, [fontSize]);

  useEffect(() => {
    if (fixedLayoutRef.current) {
      renditionRef.current?.themes.select("paper");
      return;
    }

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
            title={
              fixedLayout
                ? "120 = ajustar al canvas"
                : `Restablecer a ${readerScaleDefault}%`
            }
          >
            {readerScale}%
          </button>

          <button
            type="button"
            onClick={() => changeReaderScale(1)}
            disabled={readerScale >= readerScaleMax}
            className="h-8 min-w-8 rounded-lg px-2 text-sm font-bold text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label={fixedLayout ? "Agrandar página" : "Aumentar texto"}
          >
            {fixedLayout ? "+" : "A+"}
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            setTheme((value) => (value === "paper" ? "night" : "paper"))
          }
          disabled={fixedLayout}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
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
            className="grid place-items-center"
            style={{
              width: `${workspaceSize.width}px`,
              height: `${workspaceSize.height}px`,
              padding: fixedLayout ? 0 : `${REFLOWABLE_GUTTER}px`,
              boxSizing: "border-box",
            }}
          >
            <div
              className={
                fixedLayout
                  ? "relative shrink-0 overflow-hidden bg-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
                  : "relative shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#fffdf8] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
              }
              style={{
                width: `${activePageSize.width}px`,
                height: `${activePageSize.height}px`,
                background: fixedLayout
                  ? "#ffffff"
                  : theme === "night"
                    ? "#111827"
                    : "#fffdf8",
              }}
            >
              <div
                ref={viewerRef}
                data-libroseller-epub-viewer="persistent"
                className="absolute inset-0 overflow-hidden"
                style={{
                  width: `${activePageSize.width}px`,
                  height: `${activePageSize.height}px`,
                }}
              />
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
