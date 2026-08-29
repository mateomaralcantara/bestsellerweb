import JSZip from "jszip";

export type FixedLayoutQualitySeverity = "info" | "warning" | "error";

export type FixedLayoutQualityFinding = {
  code: string;
  severity: FixedLayoutQualitySeverity;
  message: string;
  detail?: string;
};

export type FixedLayoutQualityReport = {
  applicable: boolean;
  penalty: number;
  findings: FixedLayoutQualityFinding[];
  metrics: {
    pagesInspected: number;
    singleImagePages: number;
    knownImageDimensions: number;
    viewportPages: number;
    viewportMatches: number;
    lowResolutionPages: number;
    criticalResolutionPages: number;
    forcedStretchPages: number;
    overflowClipPages: number;
    aspectRatioSpreadPct: number;
    dominantGeometry: { width: number; height: number; pages: number } | null;
    minGeometry: { width: number; height: number } | null;
    maxGeometry: { width: number; height: number } | null;
    geometryVariants: Array<{ width: number; height: number; pages: number }>;
    singleImageCoveragePct: number;
    viewportCoveragePct: number;
    viewportMatchPct: number;
  };
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

type Geometry = { width: number; height: number };

const EMPTY_METRICS: FixedLayoutQualityReport["metrics"] = {
  pagesInspected: 0,
  singleImagePages: 0,
  knownImageDimensions: 0,
  viewportPages: 0,
  viewportMatches: 0,
  lowResolutionPages: 0,
  criticalResolutionPages: 0,
  forcedStretchPages: 0,
  overflowClipPages: 0,
  aspectRatioSpreadPct: 0,
  dominantGeometry: null,
  minGeometry: null,
  maxGeometry: null,
  geometryVariants: [],
  singleImageCoveragePct: 0,
  viewportCoveragePct: 0,
  viewportMatchPct: 0,
};

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
  const raw = decodeURIComponent((href.split("#")[0] || "").replace(/^\//, ""));
  const stack: string[] = [];
  for (const part of `${base}${raw}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function parseManifest(opf: string): ManifestItem[] {
  const items: ManifestItem[] = [];
  const regex = /<item\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(opf))) {
    const attributes = match[1] || "";
    const href = attr(attributes, "href");
    if (!href) continue;
    items.push({
      id: attr(attributes, "id"),
      href,
      mediaType: attr(attributes, "media-type").toLowerCase(),
      properties: attr(attributes, "properties").toLowerCase(),
    });
  }
  return items;
}

function parseSpineIds(opf: string) {
  const ids: string[] = [];
  const regex = /<itemref\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(opf))) {
    const idref = attr(match[1] || "", "idref");
    if (idref) ids.push(idref);
  }
  return ids;
}

function isFixedLayout(opf: string) {
  const rendition = opf.match(/<meta\b[^>]*property=["']rendition:layout["'][^>]*>([\s\S]*?)<\/meta>/i)?.[1] || "";
  const legacy = /<meta\b[^>]*name=["']fixed-layout["'][^>]*content=["'](?:true|yes)["']/i.test(opf);
  const value = rendition.trim().toLowerCase();
  return value.includes("pre-paginated") || value.includes("fixed") || legacy;
}

function parseViewport(xhtml: string): Geometry | null {
  const meta = xhtml.match(/<meta\b[^>]*name=["']viewport["'][^>]*>/i)?.[0] || "";
  if (!meta) return null;
  const content = attr(meta, "content");
  const width = Number(content.match(/(?:^|[,;\s])width\s*=\s*([0-9.]+)/i)?.[1] || 0);
  const height = Number(content.match(/(?:^|[,;\s])height\s*=\s*([0-9.]+)/i)?.[1] || 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

function parseImageSources(xhtml: string) {
  const sources: string[] = [];
  const regex = /<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xhtml))) {
    const src = attr(match[1] || "", "src");
    if (src) sources.push(src);
  }
  return sources;
}

function readPngGeometry(bytes: Uint8Array): Geometry | null {
  if (bytes.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width && height ? { width, height } : null;
}

function readJpegGeometry(bytes: Uint8Array): Geometry | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof && offset + 8 < bytes.length) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return width && height ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpGeometry(bytes: Uint8Array): Geometry | null {
  if (bytes.length < 30) return null;
  const ascii = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  const chunk = ascii(12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

function readImageGeometry(bytes: Uint8Array) {
  return readPngGeometry(bytes) || readJpegGeometry(bytes) || readWebpGeometry(bytes);
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function pushFinding(
  findings: FixedLayoutQualityFinding[],
  code: string,
  severity: FixedLayoutQualitySeverity,
  message: string,
  detail?: string
) {
  findings.push({ code, severity, message, ...(detail ? { detail } : {}) });
}

function pageCssSignals(css: string) {
  const hasFullWidth = /(?:img|\.page\s+img)[^{]*\{[^}]*width\s*:\s*100%/i.test(css);
  const hasFullHeight = /(?:img|\.page\s+img)[^{]*\{[^}]*height\s*:\s*100%/i.test(css);
  const hasObjectFit = /(?:img|\.page\s+img)[^{]*\{[^}]*object-fit\s*:\s*(?:contain|cover|scale-down)/i.test(css);
  const overflowHidden = /overflow(?:-x|-y)?\s*:\s*hidden/i.test(css);
  return {
    forcedStretch: hasFullWidth && hasFullHeight && !hasObjectFit,
    overflowHidden,
  };
}

export async function analyzeFixedLayoutQuality(
  input: ArrayBuffer | Uint8Array
): Promise<FixedLayoutQualityReport> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const findings: FixedLayoutQualityFinding[] = [];

  try {
    const zip = await JSZip.loadAsync(bytes);
    const container = await zip.file("META-INF/container.xml")?.async("string");
    const packagePath = container?.match(/<rootfile\b[^>]*full-path=["']([^"']+)["']/i)?.[1] || "";
    if (!packagePath) return { applicable: false, penalty: 0, findings, metrics: { ...EMPTY_METRICS } };

    const opf = await zip.file(packagePath)?.async("string");
    if (!opf || !isFixedLayout(opf)) {
      return { applicable: false, penalty: 0, findings, metrics: { ...EMPTY_METRICS } };
    }

    const packageBase = dirname(packagePath);
    const manifest = parseManifest(opf);
    const byId = new Map(manifest.map((item) => [item.id, item]));
    const spineIds = parseSpineIds(opf);
    const spineContent = spineIds
      .map((id) => byId.get(id))
      .filter((item): item is ManifestItem => Boolean(item && /(?:xhtml\+xml|text\/html)/i.test(item.mediaType)))
      .slice(0, 240);

    if (!spineContent.length) {
      pushFinding(findings, "FXL_SPINE_EMPTY", "error", "El fixed-layout no tiene páginas XHTML legibles en el spine.");
      return {
        applicable: true,
        penalty: 35,
        findings,
        metrics: { ...EMPTY_METRICS },
      };
    }

    const geometryCounts = new Map<string, number>();
    const geometries: Geometry[] = [];
    let singleImagePages = 0;
    let knownImageDimensions = 0;
    let viewportPages = 0;
    let viewportMatches = 0;
    let lowResolutionPages = 0;
    let criticalResolutionPages = 0;
    let forcedStretchPages = 0;
    let overflowClipPages = 0;

    const cssCache = new Map<string, string>();

    for (const page of spineContent) {
      const pagePath = normalizeZipPath(packageBase, page.href);
      const xhtml = await zip.file(pagePath)?.async("string");
      if (!xhtml) continue;

      const imageSources = parseImageSources(xhtml);
      if (imageSources.length === 1) singleImagePages += 1;

      const viewport = parseViewport(xhtml);
      if (viewport) viewportPages += 1;

      let css = xhtml.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)?.join("\n") || "";
      const linkRegex = /<link\b([^>]*)>/gi;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(xhtml))) {
        const attributes = linkMatch[1] || "";
        const rel = attr(attributes, "rel").toLowerCase();
        const href = attr(attributes, "href");
        if (!href || (rel && !rel.split(/\s+/).includes("stylesheet"))) continue;
        const cssPath = normalizeZipPath(dirname(pagePath), href);
        let linked = cssCache.get(cssPath);
        if (linked === undefined) {
          linked = (await zip.file(cssPath)?.async("string")) || "";
          cssCache.set(cssPath, linked);
        }
        css += `\n${linked}`;
      }

      const signals = pageCssSignals(css);
      if (signals.forcedStretch) forcedStretchPages += 1;
      if (signals.overflowHidden) overflowClipPages += 1;

      if (imageSources.length !== 1) continue;
      const imagePath = normalizeZipPath(dirname(pagePath), imageSources[0]);
      const imageBytes = await zip.file(imagePath)?.async("uint8array");
      if (!imageBytes) continue;
      const geometry = readImageGeometry(imageBytes);
      if (!geometry) continue;

      knownImageDimensions += 1;
      geometries.push(geometry);
      const key = `${geometry.width}x${geometry.height}`;
      geometryCounts.set(key, (geometryCounts.get(key) || 0) + 1);

      const shortSide = Math.min(geometry.width, geometry.height);
      const longSide = Math.max(geometry.width, geometry.height);
      if (shortSide < 900 || longSide < 1350) criticalResolutionPages += 1;
      else if (shortSide < 1200 || longSide < 1800) lowResolutionPages += 1;

      if (viewport) {
        const widthDelta = Math.abs(viewport.width - geometry.width) / geometry.width;
        const heightDelta = Math.abs(viewport.height - geometry.height) / geometry.height;
        if (widthDelta <= 0.01 && heightDelta <= 0.01) viewportMatches += 1;
      }
    }

    const pagesInspected = spineContent.length;
    const variants = Array.from(geometryCounts.entries())
      .map(([key, pages]) => {
        const [width, height] = key.split("x").map(Number);
        return { width, height, pages };
      })
      .sort((a, b) => b.pages - a.pages || b.width * b.height - a.width * a.height);

    const ratios = geometries.map((item) => item.width / item.height);
    const minRatio = ratios.length ? Math.min(...ratios) : 0;
    const maxRatio = ratios.length ? Math.max(...ratios) : 0;
    const medianRatio = ratios.length ? ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : 0;
    const aspectRatioSpreadPct = medianRatio > 0 ? Math.round(((maxRatio - minRatio) / medianRatio) * 10000) / 100 : 0;

    const minGeometry = geometries.length
      ? { width: Math.min(...geometries.map((item) => item.width)), height: Math.min(...geometries.map((item) => item.height)) }
      : null;
    const maxGeometry = geometries.length
      ? { width: Math.max(...geometries.map((item) => item.width)), height: Math.max(...geometries.map((item) => item.height)) }
      : null;

    const metrics: FixedLayoutQualityReport["metrics"] = {
      pagesInspected,
      singleImagePages,
      knownImageDimensions,
      viewportPages,
      viewportMatches,
      lowResolutionPages,
      criticalResolutionPages,
      forcedStretchPages,
      overflowClipPages,
      aspectRatioSpreadPct,
      dominantGeometry: variants[0] || null,
      minGeometry,
      maxGeometry,
      geometryVariants: variants.slice(0, 12),
      singleImageCoveragePct: pct(singleImagePages, pagesInspected),
      viewportCoveragePct: pct(viewportPages, pagesInspected),
      viewportMatchPct: pct(viewportMatches, knownImageDimensions),
    };

    let penalty = 0;

    if (metrics.singleImageCoveragePct < 90) {
      const severe = metrics.singleImageCoveragePct < 70;
      penalty += severe ? 15 : 7;
      pushFinding(
        findings,
        "FXL_PAGE_ARCHITECTURE",
        severe ? "error" : "warning",
        `Solo ${metrics.singleImageCoveragePct}% de las páginas fixed-layout usan una imagen única por página.`,
        "El normalizador automático solo puede garantizar el perfil canónico en fixed-layout simples de una imagen por página."
      );
    }

    if (knownImageDimensions < singleImagePages) {
      penalty += Math.min(6, Math.max(2, singleImagePages - knownImageDimensions));
      pushFinding(
        findings,
        "FXL_IMAGE_DIMENSIONS_UNKNOWN",
        "warning",
        `No se pudo determinar la resolución raster de ${singleImagePages - knownImageDimensions} páginas.`
      );
    }

    if (criticalResolutionPages > 0) {
      penalty += Math.min(24, 10 + Math.ceil((criticalResolutionPages / Math.max(1, knownImageDimensions)) * 14));
      pushFinding(
        findings,
        "FXL_RASTER_CRITICAL",
        "error",
        `${criticalResolutionPages} páginas tienen resolución raster críticamente baja.`,
        "Umbral crítico LibroSeller: lado corto ≥ 900 px y lado largo ≥ 1350 px."
      );
    } else if (lowResolutionPages > 0) {
      const ratio = lowResolutionPages / Math.max(1, knownImageDimensions);
      penalty += Math.min(10, 3 + Math.ceil(ratio * 7));
      pushFinding(
        findings,
        "FXL_RASTER_RECOMMENDED",
        "warning",
        `${lowResolutionPages} páginas están por debajo de la resolución editorial recomendada.`,
        "Objetivo LibroSeller para alta nitidez: lado corto ≥ 1200 px y lado largo ≥ 1800 px."
      );
    }

    if (aspectRatioSpreadPct > 3) {
      penalty += 12;
      pushFinding(findings, "FXL_ASPECT_RATIO", "error", `La relación de aspecto varía ${aspectRatioSpreadPct}% entre páginas.`);
    } else if (aspectRatioSpreadPct > 1) {
      penalty += 5;
      pushFinding(findings, "FXL_ASPECT_RATIO", "warning", `La relación de aspecto varía ${aspectRatioSpreadPct}% entre páginas.`);
    }

    if (viewportPages === 0) {
      penalty += 10;
      pushFinding(findings, "FXL_VIEWPORT_MISSING", "warning", "Las páginas fixed-layout no declaran viewport explícito.");
    } else if (metrics.viewportCoveragePct < 95) {
      penalty += 6;
      pushFinding(findings, "FXL_VIEWPORT_COVERAGE", "warning", `Solo ${metrics.viewportCoveragePct}% de las páginas declaran viewport.`);
    }

    if (knownImageDimensions > 0 && metrics.viewportMatchPct < 90) {
      penalty += metrics.viewportMatchPct < 60 ? 10 : 5;
      pushFinding(
        findings,
        "FXL_VIEWPORT_GEOMETRY_MISMATCH",
        metrics.viewportMatchPct < 60 ? "error" : "warning",
        `El viewport coincide con la imagen raster en ${metrics.viewportMatchPct}% de las páginas medibles.`
      );
    }

    if (forcedStretchPages > 0) {
      const ratio = forcedStretchPages / pagesInspected;
      penalty += Math.min(10, 3 + Math.ceil(ratio * 7));
      pushFinding(
        findings,
        "FXL_FORCED_STRETCH",
        "warning",
        `${forcedStretchPages} páginas fuerzan ancho y alto al 100% sin object-fit.`,
        "Puede deformar la página cuando el viewport del lector no coincide exactamente con el raster."
      );
    }

    if (overflowClipPages > 0) {
      const ratio = overflowClipPages / pagesInspected;
      penalty += Math.min(6, 2 + Math.ceil(ratio * 4));
      pushFinding(
        findings,
        "FXL_OVERFLOW_CLIPPING",
        "warning",
        `${overflowClipPages} páginas usan overflow:hidden; existe riesgo de clipping en arquitecturas no canónicas.`
      );
    }

    if (!findings.some((item) => item.severity === "error") && penalty === 0) {
      pushFinding(
        findings,
        "FXL_QUALITY_READY",
        "info",
        "Fixed-layout con geometría, viewport y raster dentro del perfil editorial LibroSeller 10/10."
      );
    }

    return {
      applicable: true,
      penalty: Math.min(45, penalty),
      findings,
      metrics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      applicable: true,
      penalty: 25,
      findings: [
        {
          code: "FXL_QUALITY_ANALYZER",
          severity: "error",
          message: "No se pudo completar la auditoría raster del fixed-layout.",
          detail: message,
        },
      ],
      metrics: { ...EMPTY_METRICS },
    };
  }
}
