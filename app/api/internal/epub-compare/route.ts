import { NextResponse } from "next/server";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { analyzeEpubBuffer } from "@/lib/epub-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_KEY = "Je7jXTZeh2j36BAJhMYh5W36mqD-IqCx";
const TARGETS = [
  "la-generacion-alofoke",
  "la-rebelion-de-los-hombres-heridos-y-traumatizados",
] as const;

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}
function attr(source: string, name: string) {
  return source.match(new RegExp(`${name}\\s*=\\s*[\"']([^\"']+)[\"']`, "i"))?.[1]?.trim() || "";
}
function normalizeZipPath(base: string, href: string) {
  const raw = decodeURIComponent((href.split("#")[0] || "").replace(/^\//, ""));
  const stack: string[] = [];
  for (const part of `${base}${raw}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop(); else stack.push(part);
  }
  return stack.join("/");
}
function count(source: string, regex: RegExp) { return source.match(regex)?.length ?? 0; }

async function deepMetrics(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path\s*=\s*[\"']([^\"']+)[\"']/i)?.[1] || "";
  const opf = opfPath ? await zip.file(opfPath)?.async("string") : "";
  const base = dirname(opfPath);
  const items = Array.from((opf || "").matchAll(/<item\b([^>]*)\/?\s*>/gi)).map((m) => ({ href: attr(m[1] || "", "href"), mediaType: attr(m[1] || "", "media-type").toLowerCase() }));
  let css = ""; let html = "";
  for (const item of items) {
    const path = normalizeZipPath(base, item.href);
    if (item.mediaType === "text/css") css += `\n${(await zip.file(path)?.async("string")) || ""}`;
    if (item.mediaType === "application/xhtml+xml" || item.mediaType === "text/html") html += `\n${(await zip.file(path)?.async("string")) || ""}`;
  }
  return {
    cssBytes: Buffer.byteLength(css, "utf8"), htmlBytes: Buffer.byteLength(html, "utf8"),
    inlineStyleAttributes: count(html, /\bstyle=[\"'][^\"']+[\"']/gi), classAttributes: count(html, /\bclass=[\"'][^\"']+[\"']/gi),
    h1: count(html, /<h1\b/gi), h2: count(html, /<h2\b/gi), h3: count(html, /<h3\b/gi), roleHeading: count(html, /\brole=[\"']heading[\"']/gi), semanticChapter: count(html, /epub:type=[\"'][^\"']*chapter[^\"']*[\"']/gi),
    paragraphs: count(html, /<p\b/gi), divs: count(html, /<div\b/gi), spans: count(html, /<span\b/gi),
    cssTextAlignCenter: count(css, /text-align\s*:\s*center/gi), cssTextAlignLeft: count(css, /text-align\s*:\s*left/gi), cssTextAlignJustify: count(css, /text-align\s*:\s*justify/gi), cssTextIndent: count(css, /text-indent\s*:/gi), cssMarginAuto: count(css, /margin-(?:left|right)\s*:\s*auto/gi),
    cssFontFamily: count(css, /font-family\s*:/gi), cssFontSize: count(css, /font-size\s*:/gi), cssLineHeight: count(css, /line-height\s*:/gi),
    cssWidthPx: count(css, /(?:width|min-width|max-width)\s*:\s*\d+(?:\.\d+)?px/gi), cssHeightPx: count(css, /(?:height|min-height|max-height)\s*:\s*\d+(?:\.\d+)?px/gi), cssAbsolutePosition: count(css, /position\s*:\s*absolute/gi), cssOverflowHidden: count(css, /overflow(?:-x|-y)?\s*:\s*hidden/gi), cssImportant: count(css, /!important\b/gi), cssPageBreaks: count(css, /(?:page-break-(?:before|after|inside)|break-(?:before|after|inside))\s*:/gi), cssSelectorsChapterTitle: count(css, /(?:chapter|capitulo|title|titulo|heading)[^{]*\{/gi),
    inlineTextAlignCenter: count(html, /style=[\"'][^\"']*text-align\s*:\s*center[^\"']*[\"']/gi), inlineTextAlignLeft: count(html, /style=[\"'][^\"']*text-align\s*:\s*left[^\"']*[\"']/gi), inlineTextAlignJustify: count(html, /style=[\"'][^\"']*text-align\s*:\s*justify[^\"']*[\"']/gi),
  };
}

async function analyze(slug: string) {
  const { data: book, error: bookError } = await supabaseAdmin.from("books").select("id, slug, title").eq("slug", slug).maybeSingle();
  if (bookError || !book) throw new Error(`Book not found: ${slug}`);
  const { data: asset, error: assetError } = await supabaseAdmin.from("book_assets").select("storage_bucket, storage_path, created_at").eq("book_id", book.id).eq("asset_type", "epub").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (assetError || !asset?.storage_bucket || !asset.storage_path) throw new Error(`EPUB asset missing: ${slug}`);
  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from(asset.storage_bucket).download(asset.storage_path);
  if (downloadError || !blob) throw new Error(`EPUB download failed: ${slug}`);
  const buffer = await blob.arrayBuffer();
  const [preflight, structure] = await Promise.all([analyzeEpubBuffer(buffer), deepMetrics(buffer)]);
  return { book, assetCreatedAt: asset.created_at, bytes: buffer.byteLength, preflight, structure };
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (key !== AUDIT_KEY) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const results = await Promise.all(TARGETS.map((slug) => analyze(slug)));
    return NextResponse.json({ generatedAt: new Date().toISOString(), results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "diagnostic failed" }, { status: 500 });
  }
}
