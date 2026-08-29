import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { normalizeFixedLayoutEpub } from "./fixed-layout-normalizer";

const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    "base64"
  )
);

async function makeEpub(layout: "fixed" | "reflowable") {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    "OEBPS/package.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title><meta property="rendition:layout">${layout === "fixed" ? "pre-paginated" : "reflowable"}</meta></metadata><manifest><item id="p1" href="page.xhtml" media-type="application/xhtml+xml"/><item id="img" href="page.png" media-type="image/png"/><item id="css" href="page.css" media-type="text/css"/></manifest><spine><itemref idref="p1"/></spine></package>`
  );
  zip.file(
    "OEBPS/page.xhtml",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="page.css"/></head><body><div class="page"><img src="page.png"/></div></body></html>`
  );
  zip.file(
    "OEBPS/page.css",
    `.page{position:absolute;width:100%;height:100%;overflow:hidden}.page img{width:100%;height:100%}`
  );
  zip.file("OEBPS/page.png", PNG_1X1);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("normalizeFixedLayoutEpub", () => {
  it("normaliza un fixed-layout de una imagen por página", async () => {
    const source = await makeEpub("fixed");
    const result = await normalizeFixedLayoutEpub(source);

    expect(result.report.status).toBe("normalized");
    expect(result.report.eligible).toBe(true);
    expect(result.report.pagesNormalized).toBe(1);
    expect(result.report.architecture.absolutePositionRules).toBeGreaterThan(0);
    expect(result.output).not.toBeNull();

    const zip = await JSZip.loadAsync(result.output!);
    const page = await zip.file("OEBPS/page.xhtml")!.async("string");
    expect(page).toContain("libroseller-fixed-layout");
    expect(page).toContain('content="width=1,height=1"');
    expect(page).not.toContain('class="page"');
    expect(page).not.toContain('rel="stylesheet"');
  });

  it("preserva un EPUB reflowable", async () => {
    const source = await makeEpub("reflowable");
    const result = await normalizeFixedLayoutEpub(source);
    expect(result.report.status).toBe("skipped");
    expect(result.report.eligible).toBe(false);
    expect(result.output).toBeNull();
  });
});
