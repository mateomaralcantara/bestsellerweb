// ============================================
// ARCHIVO: components/readers/EpubReaderClient.tsx
// ============================================

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EpubReaderClientProps = {
  title: string;
  epubUrl: string;
  mode?: "preview" | "full";
};

type ReaderStatus = "idle" | "loading" | "ready" | "error";

type ReaderEngine = "manual";

type ManualChapter = {
  href: string;
  label: string;
  html: string;
};

type ManualBook = {
  title: string;
  chapters: ManualChapter[];
  resourceUrls: string[];
};

type LoadedReader = {
  resourceUrls: string[];
};

const TOTAL_LOAD_TIMEOUT_MS = 35000;
const MAX_EPUB_COMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_EPUB_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_EPUB_ENTRIES = 5_000;
const MAX_EPUB_TEXT_BYTES = 5 * 1024 * 1024;

function normalizeEpubUrl(rawUrl: string, mode: "preview" | "full") {
  const cleanUrl = String(rawUrl || "").trim();

  if (!cleanUrl) {
    return "";
  }

  if (cleanUrl.includes("/epub?mode=")) {
    return cleanUrl;
  }

  if (cleanUrl.endsWith("/epub")) {
    return `${cleanUrl}?mode=${mode}`;
  }

  if (cleanUrl.includes("/api/books/")) {
    return `${cleanUrl.replace(/\/$/, "")}/epub?mode=${mode}`;
  }

  return cleanUrl;
}

function isProbablyJson(contentType: string, text: string) {
  const cleanText = text.trim();

  return (
    contentType.includes("application/json") ||
    cleanText.startsWith("{") ||
    cleanText.startsWith("[")
  );
}

function isProbablyHtml(contentType: string, text: string) {
  const cleanText = text.trim().toLowerCase();

  return (
    contentType.includes("text/html") ||
    cleanText.startsWith("<!doctype html") ||
    cleanText.startsWith("<html")
  );
}

function isProbablyEpub(arrayBuffer: ArrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) {
    return false;
  }

  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));

  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function getJsonErrorMessage(text: string) {
  try {
    const parsed = JSON.parse(text);

    if (typeof parsed?.error === "string") {
      return parsed.error;
    }

    if (typeof parsed?.message === "string") {
      return parsed.message;
    }

    if (parsed?.ok === true && parsed?.book) {
      return "El lector recibió JSON de metadata del libro, no el EPUB. Revisa que epubUrl apunte a /api/books/[bookkey]/epub?mode=preview.";
    }

    return "El lector recibió JSON en lugar de un archivo EPUB.";
  } catch {
    return "";
  }
}

async function fetchEpubArrayBuffer(url: string) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/epub+zip,*/*",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const arrayBuffer = await response.arrayBuffer();
  const previewText = new TextDecoder().decode(arrayBuffer.slice(0, 2000));

  if (!response.ok) {
    throw new Error(
      getJsonErrorMessage(previewText) ||
        `El API del EPUB respondió con HTTP ${response.status}.`
    );
  }

  if (isProbablyJson(contentType, previewText)) {
    throw new Error(
      getJsonErrorMessage(previewText) ||
        "El lector recibió JSON en lugar de un archivo EPUB."
    );
  }

  if (isProbablyHtml(contentType, previewText)) {
    throw new Error(
      "El lector recibió HTML en lugar de un EPUB. Probablemente la ruta devolvió una página 404 o una pantalla de error."
    );
  }

  if (!isProbablyEpub(arrayBuffer)) {
    throw new Error(
      "La respuesta no parece un EPUB válido. Un EPUB debe iniciar internamente como ZIP/PK."
    );
  }

  return arrayBuffer;
}

function dirname(filePath: string) {
  const cleanPath = filePath.replace(/^\/+/, "");
  const index = cleanPath.lastIndexOf("/");

  if (index === -1) {
    return "";
  }

  return cleanPath.slice(0, index);
}

function normalizeZipPath(basePath: string, relativePath: string) {
  const cleanRelative = decodeURIComponent(relativePath || "")
    .split("#")[0]
    .split("?")[0]
    .replace(/^\/+/, "");

  if (!cleanRelative) {
    return "";
  }

  if (!basePath) {
    return cleanRelative;
  }

  const stack: string[] = [];
  const parts = `${basePath}/${cleanRelative}`.split("/");

  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      stack.pop();
      continue;
    }

    stack.push(part);
  }

  return stack.join("/");
}

function getMimeTypeByPath(filePath: string) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".gif")) {
    return "image/gif";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (lower.endsWith(".css")) {
    return "text/css";
  }

  if (lower.endsWith(".woff")) {
    return "font/woff";
  }

  if (lower.endsWith(".woff2")) {
    return "font/woff2";
  }

  if (lower.endsWith(".ttf")) {
    return "font/ttf";
  }

  if (lower.endsWith(".otf")) {
    return "font/otf";
  }

  return "application/octet-stream";
}

function isHtmlLikePath(filePath: string) {
  const lower = filePath.toLowerCase();

  return (
    lower.endsWith(".html") ||
    lower.endsWith(".xhtml") ||
    lower.endsWith(".htm")
  );
}

function isCssPath(filePath: string) {
  return filePath.toLowerCase().endsWith(".css");
}

function isSkippableResourcePath(filePath: string) {
  const lower = filePath.toLowerCase();

  return (
    lower.endsWith(".opf") ||
    lower.endsWith(".ncx") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".html") ||
    lower.endsWith(".xhtml") ||
    lower.endsWith(".htm")
  );
}

function getElementsByLocalName(document: Document, localName: string) {
  const namespaced = Array.from(document.getElementsByTagNameNS("*", localName));

  if (namespaced.length > 0) {
    return namespaced;
  }

  return Array.from(document.getElementsByTagName(localName));
}

async function readZipText(zip: any, filePath: string) {
  const cleanPath = filePath.replace(/^\/+/, "");
  const file = zip.file(cleanPath);

  if (!file) {
    throw new Error(`No se encontró dentro del EPUB: ${cleanPath}`);
  }

  const uncompressedSize = Number(file?._data?.uncompressedSize || 0);
  if (uncompressedSize > MAX_EPUB_TEXT_BYTES) {
    throw new Error(`El archivo interno es demasiado grande: ${cleanPath}`);
  }

  const text = await file.async("text");
  if (new TextEncoder().encode(text).byteLength > MAX_EPUB_TEXT_BYTES) {
    throw new Error(`El archivo interno excede el límite: ${cleanPath}`);
  }

  return text;
}

async function createResourceUrlMap(zip: any) {
  const resourceUrls = new Map<string, string>();
  const cleanupUrls: string[] = [];

  const files = Object.keys(zip.files).filter((filePath) => {
    const file = zip.files[filePath];

    if (!file || file.dir) {
      return false;
    }

    if (isSkippableResourcePath(filePath)) {
      return false;
    }

    return true;
  });

  for (const filePath of files) {
    if (isCssPath(filePath)) {
      continue;
    }

    const file = zip.file(filePath);

    if (!file) {
      continue;
    }

    const blob = await file.async("blob");
    const typedBlob = new Blob([blob], {
      type: getMimeTypeByPath(filePath),
    });

    const objectUrl = URL.createObjectURL(typedBlob);

    resourceUrls.set(filePath.replace(/^\/+/, ""), objectUrl);
    cleanupUrls.push(objectUrl);
  }

  for (const filePath of files.filter(isCssPath)) {
    const file = zip.file(filePath);

    if (!file) {
      continue;
    }

    const cssBasePath = dirname(filePath);
    let cssText = await file.async("text");

    cssText = cssText.replace(
      /url\((["']?)(.*?)\1\)/g,
      (_match: string, quote: string, rawUrl: string) => {
        const cleanUrl = String(rawUrl || "").trim();

        if (
          !cleanUrl ||
          cleanUrl.startsWith("data:") ||
          cleanUrl.startsWith("#")
        ) {
          return `url(${quote}${cleanUrl}${quote})`;
        }

        const resolvedPath = normalizeZipPath(cssBasePath, cleanUrl);
        const objectUrl = resourceUrls.get(resolvedPath);

        if (!objectUrl) {
          return `url(${quote}${cleanUrl}${quote})`;
        }

        return `url(${quote}${objectUrl}${quote})`;
      }
    );

    const cssBlob = new Blob([cssText], {
      type: "text/css",
    });

    const objectUrl = URL.createObjectURL(cssBlob);

    resourceUrls.set(filePath.replace(/^\/+/, ""), objectUrl);
    cleanupUrls.push(objectUrl);
  }

  return {
    resourceUrls,
    cleanupUrls,
  };
}

function rewriteChapterHtml(params: {
  rawHtml: string;
  chapterPath: string;
  resourceUrls: Map<string, string>;
}) {
  const parser = new DOMParser();
  const htmlDocument = parser.parseFromString(params.rawHtml, "text/html");
  const chapterBasePath = dirname(params.chapterPath);

  htmlDocument
    .querySelectorAll(
      "script, iframe, object, embed, form, input, button, textarea, select, base, meta, link"
    )
    .forEach((element) => element.remove());

  htmlDocument.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcset" ||
        name === "ping" ||
        name === "formaction"
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  const rewriteUrl = (rawUrl: string | null) => {
    const cleanUrl = String(rawUrl || "").trim();

    if (
      !cleanUrl ||
      cleanUrl.startsWith("data:image/") ||
      cleanUrl.startsWith("#")
    ) {
      return cleanUrl;
    }

    const hashIndex = cleanUrl.indexOf("#");
    const hash = hashIndex >= 0 ? cleanUrl.slice(hashIndex) : "";
    const withoutHash = hashIndex >= 0 ? cleanUrl.slice(0, hashIndex) : cleanUrl;

    const resolvedPath = normalizeZipPath(chapterBasePath, withoutHash);
    const objectUrl = params.resourceUrls.get(resolvedPath);

    return objectUrl ? `${objectUrl}${hash}` : cleanUrl;
  };

  htmlDocument.querySelectorAll<HTMLElement>("[src]").forEach((element) => {
    const nextUrl = rewriteUrl(element.getAttribute("src"));

    if (nextUrl) {
      element.setAttribute("src", nextUrl);
    }
  });

  htmlDocument.querySelectorAll<HTMLElement>("link[href]").forEach((element) => {
    const nextUrl = rewriteUrl(element.getAttribute("href"));

    if (nextUrl) {
      element.setAttribute("href", nextUrl);
    }
  });

  htmlDocument.querySelectorAll<HTMLElement>("a[href]").forEach((element) => {
    const href = element.getAttribute("href") || "";

    if (href.startsWith("#")) {
      return;
    }

    element.removeAttribute("href");
  });

  htmlDocument.querySelectorAll("image").forEach((element) => {
    const href =
      element.getAttribute("href") || element.getAttribute("xlink:href") || "";

    const nextUrl = rewriteUrl(href);

    if (nextUrl) {
      element.setAttribute("href", nextUrl);
      element.setAttribute("xlink:href", nextUrl);
    }
  });

  const bodyContent = htmlDocument.body?.innerHTML || params.rawHtml;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: data:; style-src 'unsafe-inline' blob:; font-src blob: data:;" />
<style>
  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.75;
  }

  body {
    padding: 48px;
    max-width: 860px;
    margin: 0 auto;
  }

  img,
  svg {
    max-width: 100%;
    height: auto;
  }

  h1,
  h2,
  h3 {
    line-height: 1.2;
    color: #020617;
  }

  p {
    margin: 0 0 1.1em;
  }

  @media (max-width: 720px) {
    body {
      padding: 28px;
      font-size: 16px;
    }
  }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

async function parseManualEpub(arrayBuffer: ArrayBuffer): Promise<ManualBook> {
  if (arrayBuffer.byteLength > MAX_EPUB_COMPRESSED_BYTES) {
    throw new Error("El EPUB comprimido supera el límite permitido.");
  }

  const JSZipModule = await import("jszip");
  const JSZip = JSZipModule.default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = Object.values(zip.files) as any[];

  if (entries.length > MAX_EPUB_ENTRIES) {
    throw new Error("El EPUB contiene demasiados archivos internos.");
  }

  const uncompressedBytes = entries.reduce(
    (total, entry) => total + Number(entry?._data?.uncompressedSize || 0),
    0
  );

  if (uncompressedBytes > MAX_EPUB_UNCOMPRESSED_BYTES) {
    throw new Error("El EPUB expandido supera el límite de seguridad.");
  }

  const containerText = await readZipText(zip, "META-INF/container.xml");
  const containerXml = new DOMParser().parseFromString(
    containerText,
    "application/xml"
  );

  const rootfile = getElementsByLocalName(containerXml, "rootfile")[0];
  const opfPath = rootfile?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("El EPUB no tiene rootfile full-path en container.xml.");
  }

  const opfText = await readZipText(zip, opfPath);
  const opfXml = new DOMParser().parseFromString(opfText, "application/xml");
  const opfBasePath = dirname(opfPath);

  const manifestItems = getElementsByLocalName(opfXml, "item");
  const spineItems = getElementsByLocalName(opfXml, "itemref");

  const manifest = new Map<
    string,
    {
      id: string;
      href: string;
      mediaType: string;
      properties: string;
    }
  >();

  for (const item of manifestItems) {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    const mediaType = item.getAttribute("media-type") || "";
    const properties = item.getAttribute("properties") || "";

    if (!id || !href) {
      continue;
    }

    manifest.set(id, {
      id,
      href,
      mediaType,
      properties,
    });
  }

  const { resourceUrls, cleanupUrls } = await createResourceUrlMap(zip);

  const chapters: ManualChapter[] = [];

  for (const itemref of spineItems) {
    const idref = itemref.getAttribute("idref") || "";
    const manifestItem = manifest.get(idref);

    if (!manifestItem) {
      continue;
    }

    if (
      manifestItem.mediaType &&
      !manifestItem.mediaType.includes("html") &&
      !manifestItem.mediaType.includes("xhtml")
    ) {
      continue;
    }

    const chapterPath = normalizeZipPath(opfBasePath, manifestItem.href);

    if (!isHtmlLikePath(chapterPath)) {
      continue;
    }

    const rawHtml = await readZipText(zip, chapterPath);
    const html = rewriteChapterHtml({
      rawHtml,
      chapterPath,
      resourceUrls,
    });

    chapters.push({
      href: chapterPath,
      label: `Capítulo ${chapters.length + 1}`,
      html,
    });
  }

  if (chapters.length === 0) {
    throw new Error(
      "No se encontraron capítulos HTML/XHTML en el spine del EPUB."
    );
  }

  const titleNode = getElementsByLocalName(opfXml, "title")[0];
  const parsedTitle = titleNode?.textContent?.trim() || "EPUB";

  return {
    title: parsedTitle,
    chapters,
    resourceUrls: cleanupUrls,
  };
}

function ErrorPanel({
  title,
  message,
  epubUrl,
}: {
  title: string;
  message: string;
  epubUrl: string;
}) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-800">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-500">
        No se pudo mostrar el EPUB
      </p>

      <h2 className="mt-2 text-xl font-black text-red-950">{title}</h2>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
        {message}
      </p>

      <a
        href={epubUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex rounded-2xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
      >
        Probar descarga directa
      </a>
    </div>
  );
}

export default function EpubReaderClient({
  title,
  epubUrl,
  mode = "preview",
}: EpubReaderClientProps) {
  const loadedReaderRef = useRef<LoadedReader | null>(null);

  const [status, setStatus] = useState<ReaderStatus>("idle");
  const [engine, setEngine] = useState<ReaderEngine>("manual");
  const [errorMessage, setErrorMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Inicio");
  const [manualBook, setManualBook] = useState<ManualBook | null>(null);
  const [manualIndex, setManualIndex] = useState(0);

  const finalEpubUrl = useMemo(() => {
    return normalizeEpubUrl(epubUrl, mode);
  }, [epubUrl, mode]);

  const destroyReader = useCallback(() => {
    const currentReader = loadedReaderRef.current;

    loadedReaderRef.current = null;

    try {
      for (const url of currentReader?.resourceUrls || []) {
        URL.revokeObjectURL(url);
      }
    } catch {
      // No bloquea desmontaje.
    }

  }, []);

  const goNext = useCallback(() => {
    setManualIndex((current) => {
      if (!manualBook) {
        return current;
      }

      return Math.min(current + 1, manualBook.chapters.length - 1);
    });
  }, [manualBook]);

  const goPrev = useCallback(() => {
    setManualIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    if (engine !== "manual" || !manualBook) {
      return;
    }

    setLocationLabel(
      `Capítulo ${manualIndex + 1} de ${manualBook.chapters.length}`
    );
  }, [engine, manualBook, manualIndex]);

  useEffect(() => {
    let cancelled = false;
    let totalTimeoutId: ReturnType<typeof window.setTimeout> | null = null;

    async function loadReader() {
      destroyReader();

      if (!finalEpubUrl) {
        setStatus("error");
        setErrorMessage("No se recibió la URL del EPUB.");
        return;
      }

      if (!finalEpubUrl.includes("/epub?mode=")) {
        setStatus("error");
        setErrorMessage(
          `La URL del lector no apunta al endpoint EPUB correcto: ${finalEpubUrl}`
        );
        return;
      }

      setStatus("loading");
      setEngine("manual");
      setManualBook(null);
      setManualIndex(0);
      setErrorMessage("");
      setLocationLabel("Descargando EPUB...");

      totalTimeoutId = setTimeout(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            "El EPUB tardó demasiado cargando. Revisa si el archivo tiene capítulos XHTML válidos."
          );
        }
      }, TOTAL_LOAD_TIMEOUT_MS);

      try {
        const arrayBuffer = await fetchEpubArrayBuffer(finalEpubUrl);

        if (cancelled) {
          return;
        }

        setLocationLabel("Preparando lector seguro...");

        const parsedManualBook = await parseManualEpub(arrayBuffer);

        if (cancelled) {
          for (const url of parsedManualBook.resourceUrls) {
            URL.revokeObjectURL(url);
          }

          return;
        }

        loadedReaderRef.current = {
          resourceUrls: parsedManualBook.resourceUrls,
        };

        if (totalTimeoutId) {
          window.clearTimeout(totalTimeoutId);
          totalTimeoutId = null;
        }

        setManualBook(parsedManualBook);
        setManualIndex(0);
        setEngine("manual");
        setStatus("ready");
        setLocationLabel(`Capítulo 1 de ${parsedManualBook.chapters.length}`);
      } catch (error) {
        if (totalTimeoutId) {
          window.clearTimeout(totalTimeoutId);
          totalTimeoutId = null;
        }

        if (cancelled) {
          return;
        }

        console.error("Error cargando EPUB:", error);

        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el EPUB."
        );
      }
    }

    loadReader();

    return () => {
      cancelled = true;

      if (totalTimeoutId) {
        window.clearTimeout(totalTimeoutId);
      }

      destroyReader();
    };
  }, [destroyReader, finalEpubUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (status !== "ready") {
        return;
      }

      if (event.key === "ArrowRight") {
        goNext();
      }

      if (event.key === "ArrowLeft") {
        goPrev();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrev, status]);

  if (status === "error") {
    return (
      <ErrorPanel
        title={title}
        message={
          errorMessage ||
          "El API sí puede devolver el archivo, pero el lector no pudo renderizarlo."
        }
        epubUrl={finalEpubUrl}
      />
    );
  }

  const currentManualChapter =
    engine === "manual" && manualBook
      ? manualBook.chapters[manualIndex]
      : null;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            {mode === "preview" ? "Muestra protegida" : "Lectura completa"}
          </p>

          <h2 className="mt-1 line-clamp-1 text-base font-black text-slate-950">
            {title}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {locationLabel}
            {engine === "manual" && status === "ready"
              ? " · lector seguro"
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={
              status !== "ready" ||
              (engine === "manual" && manualIndex <= 0)
            }
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Anterior
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={
              status !== "ready" ||
              (engine === "manual" &&
                manualBook !== null &&
                manualIndex >= manualBook.chapters.length - 1)
            }
            className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      </div>

      <div className="relative min-h-[72vh] bg-white">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-950">
                Preparando EPUB...
              </p>

              <p className="mt-2 text-sm text-slate-500">{locationLabel}</p>
            </div>
          </div>
        )}

        {currentManualChapter ? (
          <iframe
            key={currentManualChapter.href}
            title={currentManualChapter.label}
            srcDoc={currentManualChapter.html}
            sandbox=""
            className="h-[72vh] w-full border-0 bg-white"
          />
        ) : <div className="h-[72vh] w-full overflow-hidden bg-white" />}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Navega con botones o con las teclas ← y →.
      </div>
    </section>
  );
}
