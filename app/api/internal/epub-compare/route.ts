import { NextResponse } from "next/server";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { analyzeEpubBuffer } from "@/lib/epub-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_KEY = "Je7jXTZeh2j36BAJhMYh5W36mqD-IqCx";
const TARGETS = ["la-generacion-alofoke", "la-rebelion-de-los-hombres-heridos-y-traumatizados"] as const;

function dirname(path: string) { const i = path.lastIndexOf("/"); return i >= 0 ? path.slice(0, i + 1) : ""; }
function attr(source: string, name: string) { return source.match(new RegExp(`${name}\\s*=\\s*[\"']([^\"']+)[\"']`, "i"))?.[1]?.trim() || ""; }
function normalizeZipPath(base: string, href: string) {
  const raw = decodeURIComponent((href.split("#")[0] || "").replace(/^\//, "")); const stack: string[] = [];
  for (const part of `${base}${raw}`.split("/")) { if (!part || part === ".") continue; if (part === "..") stack.pop(); else stack.push(part); }
  return stack.join("/");
}
function count(source: string, regex: RegExp) { return source.match(regex)?.length ?? 0; }
function imageDimensions(bytes: Uint8Array) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20), type: "png" };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return { width: v.getUint16(i + 7), height: v.getUint16(i + 5), type: "jpeg" };
      }
      if (i + 4 >= bytes.length) break;
      const len = (bytes[i + 2] << 8) + bytes[i + 3]; if (len < 2) break; i += 2 + len;
    }
  }
  return null;
}

async function deepMetrics(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path\s*=\s*[\"']([^\"']+)[\"']/i)?.[1] || "";
  const opf = opfPath ? await zip.file(opfPath)?.async("string") : "";
  const base = dirname(opfPath);
  const items = Array.from((opf || "").matchAll(/<item\b([^>]*)\/?\s*>/gi)).map((m) => ({ href: attr(m[1] || "", "href"), mediaType: attr(m[1] || "", "media-type").toLowerCase() }));
  let css = ""; let html = ""; const dims = new Map<string, number>();
  for (const item of items) {
    const path = normalizeZipPath(base, item.href); const file = zip.file(path);
    if (item.mediaType === "text/css") css += `\n${(await file?.async("string")) || ""}`;
    if (item.mediaType === "application/xhtml+xml" || item.mediaType === "text/html") html += `\n${(await file?.async("string")) || ""}`;
    if (item.mediaType.startsWith("image/") && file) {
      const bytes = await file.async("uint8array"); const d = imageDimensions(bytes);
      if (d) { const key = `${d.width}x${d.height}:${d.type}`; dims.set(key, (dims.get(key) || 0) + 1); }
    }
  }
  return {
    cssRaw: css.trim(),
    imageDimensions: Array.from(dims.entries()).map(([dimension, files]) => ({ dimension, files })).sort((a,b) => b.files-a.files),
    cssBytes: Buffer.byteLength(css, "utf8"), htmlBytes: Buffer.byteLength(html, "utf8"),
    inlineStyleAttributes: count(html, /\bstyle=[\"'][^\"']+[\"']/gi), classAttributes: count(html, /\bclass=[\"'][^\"']+[\"']/gi),
    h1: count(html, /<h1\b/gi), h2: count(html, /<h2\b/gi), h3: count(html, /<h3\b/gi), paragraphs: count(html, /<p\b/gi), divs: count(html, /<div\b/gi), spans: count(html, /<span\b/gi),
    cssTextAlignCenter: count(css, /text-align\s*:\s*center/gi), cssTextAlignLeft: count(css, /text-align\s*:\s*left/gi), cssTextAlignJustify: count(css, /text-align\s*:\s*justify/gi),
    cssAbsolutePosition: count(css, /position\s*:\s*absolute/gi), cssOverflowHidden: count(css, /overflow(?:-x|-y)?\s*:\s*hidden/gi), cssImportant: count(css, /!important\b/gi),
    metaViewportCount: count(html, /<meta\b[^>]*name=[\"']viewport[\"']/gi), imgTags: count(html, /<img\b/gi), svgTags: count(html, /<svg\b/gi), imageTags: count(html, /<image\b/gi),
  };
}

async function analyze(slug: string) {
  const { data: book, error: bookError } = await supabaseAdmin.from("books").select("id, slug, title").eq("slug", slug).maybeSingle();
  if (bookError || !book) throw new Error(`Book not found: ${slug}`);
  const { data: asset, error: assetError } = await supabaseAdmin.from("book_assets").select("storage_bucket, storage_path, created_at").eq("book_id", book.id).eq("asset_type", "epub").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (assetError || !asset?.storage_bucket || !asset.storage_path) throw new Error(`EPUB asset missing: ${slug}`);
  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from(asset.storage_bucket).download(asset.storage_path);
  if (downloadError || !blob) throw new Error(`EPUB download failed: ${slug}`);
  const buffer = await blob.arrayBuffer(); const [preflight, structure] = await Promise.all([analyzeEpubBuffer(buffer), deepMetrics(buffer)]);
  return { book, assetCreatedAt: asset.created_at, bytes: buffer.byteLength, preflight, structure };
}

export async function GET(request: Request) {
  if ((new URL(request.url).searchParams.get("key") || "") !== AUDIT_KEY) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try { const results = await Promise.all(TARGETS.map(analyze)); return NextResponse.json({ generatedAt: new Date().toISOString(), results }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "diagnostic failed" }, { status: 500 }); }
}
