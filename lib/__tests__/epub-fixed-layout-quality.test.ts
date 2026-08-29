import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { analyzeFixedLayoutQuality } from "../epub-fixed-layout-quality";

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

async function buildFixedLayout(options?: {
  width?: number;
  height?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  canonicalCss?: boolean;
  layout?: "fixed" | "reflowable";
}) {
  const width = options?.width ?? 1400;
  const height = options?.height ?? 2100;
  const viewportWidth = options?.viewportWidth ?? width;
  const viewportHeight = options?.viewportHeight ?? height;
  const canonicalCss = options?.canonicalCss ?? true;
  const layout = options?.layout ?? "fixed";

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/package.opf"/></rootfiles></container>`
  );

  const rendition = layout === "fixed"
    ? '<meta property="rendition:layout">pre-paginated</meta>'
    : '<meta property="rendition:layout">reflowable</meta>';

  zip.file(
    "OEBPS/package.opf",
    `<?xml version="1.0"?>
    <package version="3.0">
      <metadata>${rendition}</metadata>
      <manifest>
        <item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/>
        <item id="p2" href="p2.xhtml" media-type="application/xhtml+xml"/>
        <item id="i1" href="images/p1.png" media-type="image/png"/>
        <item id="i2" href="images/p2.png" media-type="image/png"/>
        <item id="css" href="style.css" media-type="text/css"/>
      </manifest>
      <spine><itemref idref="p1"/><itemref idref="p2"/></spine>
    </package>`
  );

  const css = canonicalCss
    ? "html,body{width:100%;height:100%;margin:0} body{display:flex} img{width:100%;height:100%;object-fit:contain}"
    : "html,body{width:100%;height:100%;overflow:hidden} .page{position:absolute;width:100%;height:100%} img{width:100%;height:100%}";
  zip.file("OEBPS/style.css", css);

  for (const page of [1, 2]) {
    zip.file(
      `OEBPS/p${page}.xhtml`,
      `<?xml version="1.0"?><html><head><meta name="viewport" content="width=${viewportWidth}, height=${viewportHeight}"/><link rel="stylesheet" href="style.css"/></head><body><img src="images/p${page}.png"/></body></html>`
    );
    zip.file(`OEBPS/images/p${page}.png`, pngHeader(width, height));
  }

  return zip.generateAsync({ type: "uint8array" });
}

describe("analyzeFixedLayoutQuality", () => {
  it("aprueba un fixed-layout canónico con raster de alta resolución", async () => {
    const epub = await buildFixedLayout();
    const report = await analyzeFixedLayoutQuality(epub);

    expect(report.applicable).toBe(true);
    expect(report.penalty).toBe(0);
    expect(report.metrics.pagesInspected).toBe(2);
    expect(report.metrics.viewportMatchPct).toBe(100);
    expect(report.metrics.dominantGeometry).toEqual({ width: 1400, height: 2100, pages: 2 });
    expect(report.findings.some((item) => item.code === "FXL_QUALITY_READY")).toBe(true);
  });

  it("penaliza raster bajo, viewport incorrecto, stretch y clipping", async () => {
    const epub = await buildFixedLayout({
      width: 800,
      height: 1200,
      viewportWidth: 1100,
      viewportHeight: 1650,
      canonicalCss: false,
    });
    const report = await analyzeFixedLayoutQuality(epub);

    expect(report.applicable).toBe(true);
    expect(report.penalty).toBeGreaterThanOrEqual(20);
    expect(report.metrics.criticalResolutionPages).toBe(2);
    expect(report.metrics.viewportMatchPct).toBe(0);
    expect(report.metrics.forcedStretchPages).toBe(2);
    expect(report.metrics.overflowClipPages).toBe(2);
    expect(report.findings.some((item) => item.code === "FXL_RASTER_CRITICAL")).toBe(true);
    expect(report.findings.some((item) => item.code === "FXL_VIEWPORT_GEOMETRY_MISMATCH")).toBe(true);
  });

  it("no aplica penalización raster a EPUB reflowable", async () => {
    const epub = await buildFixedLayout({ layout: "reflowable" });
    const report = await analyzeFixedLayoutQuality(epub);

    expect(report.applicable).toBe(false);
    expect(report.penalty).toBe(0);
    expect(report.findings).toEqual([]);
  });
});
