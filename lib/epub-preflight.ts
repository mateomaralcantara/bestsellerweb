import { createHash } from "node:crypto";
import JSZip from "jszip";

export type EpubPreflightSeverity = "info" | "warning" | "error";

export type EpubPreflightFinding = {
  code: string;
  severity: EpubPreflightSeverity;
  message: string;
  detail?: string;
};

export type EpubPreflightReport = {
  score: number;
  status: "pass" | "warning" | "fail";
  checksumSha256: string;
  epubVersion: string;
  layout: "reflowable" | "fixed" | "unknown";
  findings: EpubPreflightFinding[];
  summary: {
    packagePath: string | null;
    manifestItems: number;
    spineItems: number;
    contentDocuments: number;
    cssFiles: number;
    fontFiles: number;
    imageFiles: number;
    missingResources: number;
    titleCandidates: number;
    cssImportantDeclarations: number;
    hasNavigation: boolean;
    hasLanguage: boolean;
    hasTitle: boolean;
    hasCreator: boolean;
  };
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(source: string, name: string) {
  const quoted = source.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return decodeXml(quoted?.[2]?.trim() || "");
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

function normalizeZipPath(base: string, href: string) {
  const raw = decodeURIComponent(href.split("#")[0] || "").replace(/^\//, "");
  const stack: string[] = [];

  for (const part of `${base}${raw}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }

  return stack.join("/");
}

function countMatches(source: string, regex: RegExp) {
  return source.match(regex)?.length ?? 0;
}

function textMeta(opf: string, tag: string) {
  const match = opf.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1]?.replace(/<[^>]+>/g, " ").trim() || "");
}

function parseManifest(opf: string): ManifestItem[] {
  const items: ManifestItem[] = [];
  const itemRegex = /<item\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(opf))) {
    const attrs = match[1] || "";
    const href = attr(attrs, "href");
    if (!href) continue;

    items.push({
      id: attr(attrs, "id"),
      href,
      mediaType: attr(attrs, "media-type").toLowerCase(),
      properties: attr(attrs, "properties").toLowerCase(),
    });
  }

  return items;
}

function resolveLayout(opf: string): EpubPreflightReport["layout"] {
  const rendition = opf.match(
    /<meta\b[^>]*property=["']rendition:layout["'][^>]*>([\s\S]*?)<\/meta>/i
  )?.[1];
  const legacyFixed = /<meta\b[^>]*name=["']fixed-layout["'][^>]*content=["'](?:true|yes)["']/i.test(opf);
  const value = (rendition || "").trim().toLowerCase();

  if (value.includes("pre-paginated") || value.includes("fixed") || legacyFixed) {
    return "fixed";
  }
  if (value.includes("reflowable")) return "reflowable";
  return "reflowable";
}

function pushFinding(
  findings: EpubPreflightFinding[],
  code: string,
  severity: EpubPreflightSeverity,
  message: string,
  detail?: string
) {
  findings.push({ code, severity, message, ...(detail ? { detail } : {}) });
}

export async function analyzeEpubFile(file: File): Promise<EpubPreflightReport> {
  const arrayBuffer = await file.arrayBuffer();
  return analyzeEpubBuffer(arrayBuffer);
}

export async function analyzeEpubBuffer(
  input: ArrayBuffer | Uint8Array
): Promise<EpubPreflightReport> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const findings: EpubPreflightFinding[] = [];

  try {
    const zip = await JSZip.loadAsync(bytes);
    const names = new Set(Object.keys(zip.files).filter((name) => !zip.files[name]?.dir));
    const mimetype = await zip.file("mimetype")?.async("string");

    let score = 100;

    if ((mimetype || "").trim() !== "application/epub+zip") {
      score -= 8;
      pushFinding(
        findings,
        "EPUB_MIMETYPE",
        "warning",
        "El archivo no declara el mimetype EPUB canónico."
      );
    }

    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      pushFinding(findings, "EPUB_CONTAINER", "error", "Falta META-INF/container.xml.");
      return {
        score: 20,
        status: "fail",
        checksumSha256,
        epubVersion: "unknown",
        layout: "unknown",
        findings,
        summary: {
          packagePath: null,
          manifestItems: 0,
          spineItems: 0,
          contentDocuments: 0,
          cssFiles: 0,
          fontFiles: 0,
          imageFiles: 0,
          missingResources: 0,
          titleCandidates: 0,
          cssImportantDeclarations: 0,
          hasNavigation: false,
          hasLanguage: false,
          hasTitle: false,
          hasCreator: false,
        },
      };
    }

    const containerXml = await containerFile.async("string");
    const packagePath = containerXml.match(/<rootfile\b[^>]*full-path=["']([^"']+)["']/i)?.[1] || null;

    if (!packagePath || !zip.file(packagePath)) {
      score -= 35;
      pushFinding(findings, "EPUB_PACKAGE", "error", "No se encontró el paquete OPF declarado por el EPUB.");
    }

    const opf = packagePath ? await zip.file(packagePath)?.async("string") : "";
    const safeOpf = opf || "";
    const packageBase = packagePath ? dirname(packagePath) : "";
    const epubVersion = attr(safeOpf.match(/<package\b([^>]*)>/i)?.[1] || "", "version") || "unknown";
    const layout = resolveLayout(safeOpf);
    const manifest = parseManifest(safeOpf);
    const spineItems = countMatches(safeOpf, /<itemref\b/gi);
    const cssItems = manifest.filter((item) => item.mediaType === "text/css");
    const contentItems = manifest.filter((item) =>
      item.mediaType === "application/xhtml+xml" || item.mediaType === "text/html"
    );
    const fontItems = manifest.filter((item) => item.mediaType.startsWith("font/") || /\.(woff2?|otf|ttf)$/i.test(item.href));
    const imageItems = manifest.filter((item) => item.mediaType.startsWith("image/"));
    const hasNavigation = manifest.some((item) =>
      item.properties.split(/\s+/).includes("nav") || /(^|\/)toc\.ncx$/i.test(item.href)
    );
    const hasLanguage = Boolean(textMeta(safeOpf, "dc:language"));
    const hasTitle = Boolean(textMeta(safeOpf, "dc:title"));
    const hasCreator = Boolean(textMeta(safeOpf, "dc:creator"));

    const missingResources = manifest.filter((item) => {
      if (/^(https?:|data:)/i.test(item.href)) return false;
      return !names.has(normalizeZipPath(packageBase, item.href));
    });

    if (!manifest.length) {
      score -= 25;
      pushFinding(findings, "EPUB_MANIFEST", "error", "El manifiesto EPUB está vacío o no pudo interpretarse.");
    }
    if (!spineItems) {
      score -= 25;
      pushFinding(findings, "EPUB_SPINE", "error", "El EPUB no declara un spine de lectura.");
    }
    if (!contentItems.length) {
      score -= 25;
      pushFinding(findings, "EPUB_CONTENT", "error", "No se detectaron documentos XHTML/HTML de contenido.");
    }
    if (!hasNavigation) {
      score -= 8;
      pushFinding(findings, "EPUB_NAV", "warning", "No se detectó una tabla de contenido EPUB navegable.");
    }
    if (!hasLanguage) {
      score -= 3;
      pushFinding(findings, "EPUB_LANGUAGE", "warning", "Falta dc:language en la metadata.");
    }
    if (!hasTitle) {
      score -= 4;
      pushFinding(findings, "EPUB_TITLE", "warning", "Falta dc:title en la metadata.");
    }
    if (!hasCreator) {
      score -= 2;
      pushFinding(findings, "EPUB_CREATOR", "warning", "Falta dc:creator en la metadata.");
    }
    if (missingResources.length) {
      score -= Math.min(30, missingResources.length * 4);
      pushFinding(
        findings,
        "EPUB_MISSING_RESOURCES",
        missingResources.length > 4 ? "error" : "warning",
        `Hay ${missingResources.length} recursos declarados que no existen dentro del EPUB.`,
        missingResources.slice(0, 8).map((item) => item.href).join(", ")
      );
    }

    let cssText = "";
    for (const item of cssItems.slice(0, 40)) {
      const path = normalizeZipPath(packageBase, item.href);
      const text = await zip.file(path)?.async("string");
      if (text) cssText += `\n${text}`;
    }

    let contentText = "";
    for (const item of contentItems.slice(0, 80)) {
      const path = normalizeZipPath(packageBase, item.href);
      const text = await zip.file(path)?.async("string");
      if (text) contentText += `\n${text}`;
    }

    const titleCandidates =
      countMatches(contentText, /<h[1-3]\b/gi) +
      countMatches(contentText, /\b(?:class|id)=["'][^"']*(?:chapter|title|titulo|capitulo|heading|part-title|book-title)[^"']*["']/gi);
    const cssImportantDeclarations = countMatches(cssText, /!important\b/gi);
    const titleAlignmentConflicts = countMatches(
      cssText,
      /(?:chapter|title|titulo|capitulo|heading)[^{]*\{[^}]*text-align\s*:\s*(?:left|right|justify)/gi
    );
    const hardPageWidths = countMatches(cssText, /(?:width|min-width)\s*:\s*(?:9\d{2}|[1-9]\d{3,})px/gi);
    const overflowLocks = countMatches(cssText, /overflow(?:-x|-y)?\s*:\s*hidden/gi);

    if (titleCandidates === 0) {
      score -= 5;
      pushFinding(
        findings,
        "EPUB_TITLE_STRUCTURE",
        "warning",
        "No se detectó una jerarquía clara de títulos/capítulos en el XHTML."
      );
    }

    if (titleAlignmentConflicts > 0) {
      score -= Math.min(12, titleAlignmentConflicts * 3);
      pushFinding(
        findings,
        "EPUB_TITLE_ALIGNMENT",
        "warning",
        `Se detectaron ${titleAlignmentConflicts} reglas CSS que pueden desalinear títulos principales.`,
        "LibroSeller centrará semánticamente los títulos en EPUB reflowable sin modificar la tipografía."
      );
    }

    if (layout === "reflowable" && hardPageWidths > 0) {
      score -= Math.min(10, hardPageWidths * 2);
      pushFinding(
        findings,
        "EPUB_HARD_WIDTH",
        "warning",
        `Se detectaron ${hardPageWidths} anchos rígidos grandes en un EPUB reflowable.`
      );
    }

    if (layout === "reflowable" && overflowLocks > 2) {
      score -= Math.min(8, overflowLocks);
      pushFinding(
        findings,
        "EPUB_OVERFLOW_LOCK",
        "warning",
        "El CSS contiene múltiples bloqueos overflow:hidden que pueden cortar contenido al cambiar el tamaño."
      );
    }

    if (cssImportantDeclarations > 40) {
      score -= 4;
      pushFinding(
        findings,
        "EPUB_CSS_IMPORTANT",
        "info",
        `El EPUB contiene ${cssImportantDeclarations} declaraciones !important; pueden dificultar la adaptación del lector.`
      );
    }

    score = clamp(Math.round(score), 0, 100);
    const hasErrors = findings.some((item) => item.severity === "error");
    const status: EpubPreflightReport["status"] =
      hasErrors || score < 60 ? "fail" : score < 85 ? "warning" : "pass";

    if (status === "pass") {
      pushFinding(findings, "EPUB_READY", "info", "EPUB apto para publicación según el preflight LibroSeller.");
    }

    return {
      score,
      status,
      checksumSha256,
      epubVersion,
      layout,
      findings,
      summary: {
        packagePath,
        manifestItems: manifest.length,
        spineItems,
        contentDocuments: contentItems.length,
        cssFiles: cssItems.length,
        fontFiles: fontItems.length,
        imageFiles: imageItems.length,
        missingResources: missingResources.length,
        titleCandidates,
        cssImportantDeclarations,
        hasNavigation,
        hasLanguage,
        hasTitle,
        hasCreator,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    pushFinding(findings, "EPUB_INVALID_ZIP", "error", "El archivo no pudo abrirse como EPUB/ZIP válido.", message);

    return {
      score: 0,
      status: "fail",
      checksumSha256,
      epubVersion: "unknown",
      layout: "unknown",
      findings,
      summary: {
        packagePath: null,
        manifestItems: 0,
        spineItems: 0,
        contentDocuments: 0,
        cssFiles: 0,
        fontFiles: 0,
        imageFiles: 0,
        missingResources: 0,
        titleCandidates: 0,
        cssImportantDeclarations: 0,
        hasNavigation: false,
        hasLanguage: false,
        hasTitle: false,
        hasCreator: false,
      },
    };
  }
}
