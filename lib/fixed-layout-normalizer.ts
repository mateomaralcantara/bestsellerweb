import { createHash } from "node:crypto";
import path from "node:path";
import JSZip from "jszip";

export type FixedLayoutNormalizationStatus =
  | "normalized"
  | "skipped";

export type FixedLayoutNormalizationReport = {
  status: FixedLayoutNormalizationStatus;
  eligible: boolean;
  changed: boolean;
  layout: "fixed" | "reflowable" | "unknown";
  reason: string;
  sourceSha256: string;
  normalizedSha256: string | null;
  pagesInspected: number;
  pagesNormalized: number;
  imageDimensions: Array<{ width: number; height: number; files: number }>;
  sourceBytes: number;
  normalizedBytes: number | null;
  architecture: {
    wrappers: number;
    stylesheetLinks: number;
    absolutePositionRules: number;
    overflowHiddenRules: number;
    forcedWidthHeightRules: number;
  };
};

export type FixedLayoutNormalizationResult = {
  report: FixedLayoutNormalizationReport;
  output: Uint8Array | null;
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

const CANONICAL_STYLE =
  "html,body{margin:0;padding:0;width:100%;height:100%;background:#fff;}" +
  "body{display:flex;align-items:center;justify-content:center;}" +
  "img{display:block;width:100%;height:100%;object-fit:contain;margin:0;padding:0;border:0;}";

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function attr(source: string, name: string) {
  return (
    source.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2]?.trim() ||
    ""
  );
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeZipPath(baseDir: string, href: string) {
  const clean = decodeURIComponent((href.split("#")[0] || "").replace(/^\//, ""));
  return path.posix.normalize(path.posix.join(baseDir, clean)).replace(/^\.\//, "");
}

function dirname(filePath: string) {
  const value = path.posix.dirname(filePath);
  return value === "." ? "" : value;
}

function parseManifest(opf: string): ManifestItem[] {
  return Array.from(opf.matchAll(/<item\b([^>]*)\/?>/gi))
    .map((match) => ({
      id: attr(match[1] || "", "id"),
      href: attr(match[1] || "", "href"),
      mediaType: attr(match[1] || "", "media-type").toLowerCase(),
      properties: attr(match[1] || "", "properties").toLowerCase(),
    }))
    .filter((item) => item.id && item.href);
}

function resolveLayout(opf: string): FixedLayoutNormalizationReport["layout"] {
  const rendition = opf.match(
    /<meta\b[^>]*property=["']rendition:layout["'][^>]*>([\s\S]*?)<\/meta>/i
  )?.[1];
  const legacy = /<meta\b[^>]*name=["']fixed-layout["'][^>]*content=["'](?:true|yes)["']/i.test(
    opf
  );
  const value = (rendition || "").trim().toLowerCase();
  if (legacy || value.includes("pre-paginated") || value.includes("fixed")) return "fixed";
  if (value.includes("reflowable")) return "reflowable";
  return "unknown";
}

function count(source: string, regex: RegExp) {
  return source.match(regex)?.length ?? 0;
}

function decodeText(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function meaningfulBodyText(html: string) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "";
  return decodeText(
    body
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<img\b[^>]*\/?>/gi, " ")
      .replace(/<br\b[^>]*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function pngSize(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

function imageSize(bytes: Uint8Array) {
  return pngSize(bytes) || jpegSize(bytes);
}

function canonicalizePage(html: string, src: string, width: number, height: number) {
  let next = html
    .replace(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*\/?>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<meta\b[^>]*name=["']viewport["'][^>]*\/?>/gi, "");

  const headInsert = `<meta name="viewport" content="width=${width},height=${height}"/><style id="libroseller-fixed-layout">${CANONICAL_STYLE}</style>`;
  if (/<\/head>/i.test(next)) {
    next = next.replace(/<\/head>/i, `${headInsert}</head>`);
  } else if (/<html\b[^>]*>/i.test(next)) {
    next = next.replace(/<html\b([^>]*)>/i, `<html$1><head>${headInsert}</head>`);
  }

  const canonicalBody = `<body><img src="${xmlEscape(src)}" alt=""/></body>`;
  if (/<body\b[^>]*>[\s\S]*?<\/body>/i.test(next)) {
    next = next.replace(/<body\b[^>]*>[\s\S]*?<\/body>/i, canonicalBody);
  } else {
    next = next.replace(/<\/html>/i, `${canonicalBody}</html>`);
  }
  return next;
}

function skipped(
  bytes: Uint8Array,
  layout: FixedLayoutNormalizationReport["layout"],
  reason: string,
  architecture: FixedLayoutNormalizationReport["architecture"],
  pagesInspected = 0
): FixedLayoutNormalizationResult {
  return {
    output: null,
    report: {
      status: "skipped",
      eligible: false,
      changed: false,
      layout,
      reason,
      sourceSha256: sha256(bytes),
      normalizedSha256: null,
      pagesInspected,
      pagesNormalized: 0,
      imageDimensions: [],
      sourceBytes: bytes.byteLength,
      normalizedBytes: null,
      architecture,
    },
  };
}

export async function normalizeFixedLayoutEpub(
  input: ArrayBuffer | Uint8Array
): Promise<FixedLayoutNormalizationResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const emptyArchitecture = {
    wrappers: 0,
    stylesheetLinks: 0,
    absolutePositionRules: 0,
    overflowHiddenRules: 0,
    forcedWidthHeightRules: 0,
  };

  const zip = await JSZip.loadAsync(bytes);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) return skipped(bytes, "unknown", "Falta META-INF/container.xml.", emptyArchitecture);

  const opfPath = container.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "";
  const opf = opfPath ? await zip.file(opfPath)?.async("string") : "";
  if (!opf || !opfPath) return skipped(bytes, "unknown", "No se encontró el paquete OPF.", emptyArchitecture);

  const layout = resolveLayout(opf);
  if (layout !== "fixed") {
    return skipped(bytes, layout, "El EPUB no es fixed-layout; se conserva íntegramente.", emptyArchitecture);
  }

  const manifest = parseManifest(opf);
  const byId = new Map(manifest.map((item) => [item.id, item]));
  const opfDir = dirname(opfPath);
  const spineIds = Array.from(opf.matchAll(/<itemref\b([^>]*)\/?>/gi))
    .map((match) => attr(match[1] || "", "idref"))
    .filter(Boolean);

  let allCss = "";
  for (const item of manifest.filter((item) => item.mediaType === "text/css")) {
    const text = await zip.file(normalizeZipPath(opfDir, item.href))?.async("string");
    if (text) allCss += `\n${text}`;
  }

  const architecture = {
    wrappers: 0,
    stylesheetLinks: 0,
    absolutePositionRules: count(allCss, /position\s*:\s*absolute/gi),
    overflowHiddenRules: count(allCss, /overflow(?:-x|-y)?\s*:\s*hidden/gi),
    forcedWidthHeightRules: count(allCss, /(?:width|height)\s*:\s*100%/gi),
  };

  const pages: Array<{
    filePath: string;
    html: string;
    src: string;
    width: number;
    height: number;
  }> = [];
  const dimensions = new Map<string, { width: number; height: number; files: number }>();

  for (const idref of spineIds) {
    const item = byId.get(idref);
    if (!item) return skipped(bytes, layout, `El spine referencia un item inexistente: ${idref}.`, architecture, pages.length);
    if (item.properties.split(/\s+/).includes("nav")) continue;
    if (!["application/xhtml+xml", "text/html"].includes(item.mediaType)) {
      return skipped(bytes, layout, "El spine contiene recursos que no son XHTML/HTML.", architecture, pages.length);
    }

    const filePath = normalizeZipPath(opfDir, item.href);
    const html = await zip.file(filePath)?.async("string");
    if (!html) return skipped(bytes, layout, `No se pudo leer ${item.href}.`, architecture, pages.length);

    architecture.wrappers += count(html, /<div\b/gi);
    architecture.stylesheetLinks += count(html, /<link\b[^>]*stylesheet/gi);

    if (/<(?:svg|video|audio|canvas|object|iframe|script|form|input)\b/i.test(html)) {
      return skipped(bytes, layout, "El libro contiene capas complejas o multimedia; se conserva el original.", architecture, pages.length);
    }

    const imgs = Array.from(html.matchAll(/<img\b([^>]*)\/?>/gi));
    if (imgs.length !== 1) {
      return skipped(bytes, layout, "No todas las páginas contienen exactamente una imagen.", architecture, pages.length);
    }
    if (meaningfulBodyText(html)) {
      return skipped(bytes, layout, "Se detectó texto XHTML real; no se rasteriza ni se modifica.", architecture, pages.length);
    }

    const src = attr(imgs[0][1] || "", "src");
    if (!src || /^(?:data:|https?:)/i.test(src)) {
      return skipped(bytes, layout, "Una página usa una imagen externa o embebida no normalizable.", architecture, pages.length);
    }

    const imagePath = normalizeZipPath(dirname(filePath), src);
    const imageBytes = await zip.file(imagePath)?.async("uint8array");
    if (!imageBytes) return skipped(bytes, layout, `No existe la imagen de ${item.href}.`, architecture, pages.length);
    const size = imageSize(imageBytes);
    if (!size || size.width <= 0 || size.height <= 0) {
      return skipped(bytes, layout, "Se detectó un formato de imagen cuya geometría no puede validarse con seguridad.", architecture, pages.length);
    }

    const key = `${size.width}x${size.height}`;
    const current = dimensions.get(key);
    dimensions.set(key, current ? { ...current, files: current.files + 1 } : { ...size, files: 1 });
    pages.push({ filePath, html, src, ...size });
  }

  if (!pages.length) return skipped(bytes, layout, "No se encontraron páginas fixed-layout normalizables.", architecture);

  for (const page of pages) {
    zip.file(page.filePath, canonicalizePage(page.html, page.src, page.width, page.height));
  }

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/epub+zip",
  });
  const normalizedSha256 = sha256(output);
  const sourceSha256 = sha256(bytes);

  return {
    output,
    report: {
      status: "normalized",
      eligible: true,
      changed: normalizedSha256 !== sourceSha256,
      layout,
      reason: "Fixed-layout de una imagen por página normalizado al perfil canónico LibroSeller.",
      sourceSha256,
      normalizedSha256,
      pagesInspected: pages.length,
      pagesNormalized: pages.length,
      imageDimensions: Array.from(dimensions.values()).sort((a, b) => b.files - a.files),
      sourceBytes: bytes.byteLength,
      normalizedBytes: output.byteLength,
      architecture,
    },
  };
}
