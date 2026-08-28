import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// En EPUB reflowable no existen paginas fisicas estables: la paginacion depende
// del tamano de pantalla y de la tipografia. Para una muestra segura usamos las
// primeras 25 secciones XHTML legibles del spine. En EPUB fixed-layout suele
// equivaler directamente a las primeras 25 paginas.
const PREVIEW_SPINE_LIMIT = 25;

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

type ReadMode = "preview" | "full";

type BookRecord = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  owner_user_id: string | null;
};

type BookAsset = {
  id: string;
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  sort_order: number | null;
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

function safeBookKey(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getReadMode(request: Request): ReadMode {
  const url = new URL(request.url);
  return url.searchParams.get("mode") === "full" ? "full" : "preview";
}

function safeFileName(title: string | null) {
  const clean =
    String(title || "libro")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "libro";

  return `${clean}.epub`;
}

async function getBookByKey(bookkey: string) {
  const query = supabaseAdmin
    .from("books")
    .select("id, title, slug, status, owner_user_id")
    .limit(1);

  const { data, error } = isUuid(bookkey)
    ? await query.eq("id", bookkey).maybeSingle<BookRecord>()
    : await query.eq("slug", bookkey).maybeSingle<BookRecord>();

  if (error) {
    throw new Error(`Error buscando libro: ${error.message}`);
  }

  return data;
}

async function getAsset(bookId: string, assetType: "epub") {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select(
      "id, asset_type, storage_bucket, storage_path, file_url, mime_type, sort_order"
    )
    .eq("book_id", bookId)
    .eq("asset_type", assetType)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<BookAsset>();

  if (error) {
    throw new Error(`Error buscando asset ${assetType}: ${error.message}`);
  }

  return data;
}

async function userCanReadFullBook(book: BookRecord) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  if (book.owner_user_id === user.id) {
    return true;
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("book_purchases")
    .select("id, status")
    .eq("book_id", book.id)
    .eq("user_id", user.id)
    .in("status", ["paid", "completed", "approved", "succeeded"])
    .limit(1)
    .maybeSingle();

  if (purchaseError) {
    console.error("Error verificando compra EPUB full:", purchaseError.message);
    return false;
  }

  return Boolean(purchase);
}

async function downloadEpubAsset(asset: BookAsset) {
  if (!asset.storage_bucket || !asset.storage_path) {
    throw new Error("El asset EPUB no tiene bucket o ruta de Storage.");
  }

  const { data: file, error } = await supabaseAdmin.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path);

  if (error || !file) {
    throw new Error(
      error?.message || "No se pudo descargar el EPUB desde Storage."
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
    throw new Error("El EPUB descargado esta vacio.");
  }

  return arrayBuffer;
}

function attr(source: string, name: string) {
  const match = source.match(
    new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i")
  );
  return match?.[1]?.trim() || "";
}

function normalizeZipPath(baseDir: string, href: string) {
  const parts = `${baseDir}/${href}`.replace(/\\/g, "/").split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;

    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }

    stack.push(part);
  }

  return stack.join("/");
}

function isHtmlMedia(mediaType: string) {
  return mediaType === "application/xhtml+xml" || mediaType === "text/html";
}

function isNavigationItem(item: ManifestItem) {
  if (/\bnav\b/i.test(item.properties)) return true;

  const href = item.href.toLowerCase().split("#")[0];
  return (
    href.endsWith("nav.xhtml") ||
    href.endsWith("nav.html") ||
    href.endsWith("toc.xhtml") ||
    href.endsWith("toc.html")
  );
}

async function buildSafePreviewEpub(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const containerFile = zip.file("META-INF/container.xml");

  if (!containerFile) {
    throw new Error("EPUB invalido: falta META-INF/container.xml.");
  }

  const containerXml = await containerFile.async("string");
  const opfPath =
    containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "";

  if (!opfPath) {
    throw new Error("EPUB invalido: no se encontro el OPF.");
  }

  const opfFile = zip.file(opfPath);

  if (!opfFile) {
    throw new Error("EPUB invalido: el OPF no existe en el ZIP.");
  }

  const opf = await opfFile.async("string");
  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/"))
    : "";

  const manifestItems: ManifestItem[] = Array.from(
    opf.matchAll(/<item\b[^>]*\/?\s*>/gi)
  ).map((match) => ({
    id: attr(match[0], "id"),
    href: attr(match[0], "href"),
    mediaType: attr(match[0], "media-type"),
    properties: attr(match[0], "properties"),
  }));

  const manifestById = new Map(
    manifestItems.filter((item) => item.id).map((item) => [item.id, item])
  );

  const spineRefs = Array.from(opf.matchAll(/<itemref\b[^>]*\/?\s*>/gi))
    .map((match) => ({
      raw: match[0],
      idref: attr(match[0], "idref"),
      linear: attr(match[0], "linear"),
    }))
    .filter((item) => item.idref);

  const readableSpine = spineRefs.filter((ref) => {
    const item = manifestById.get(ref.idref);

    if (!item) return false;
    if (ref.linear.toLowerCase() === "no") return false;
    if (!isHtmlMedia(item.mediaType)) return false;
    if (isNavigationItem(item)) return false;

    return true;
  });

  const keptIds = new Set(
    readableSpine.slice(0, PREVIEW_SPINE_LIMIT).map((item) => item.idref)
  );

  if (keptIds.size === 0) {
    throw new Error("EPUB invalido: no hay secciones legibles para preview.");
  }

  let nextOpf = opf.replace(/<itemref\b[^>]*\/?\s*>/gi, (raw) => {
    const idref = attr(raw, "idref");
    return keptIds.has(idref) ? raw : "";
  });

  nextOpf = nextOpf.replace(/<item\b[^>]*\/?\s*>/gi, (raw) => {
    const id = attr(raw, "id");
    const mediaType = attr(raw, "media-type");
    const properties = attr(raw, "properties");
    const href = attr(raw, "href");

    if (!isHtmlMedia(mediaType)) return raw;

    const item: ManifestItem = { id, href, mediaType, properties };
    if (isNavigationItem(item)) return raw;

    return keptIds.has(id) ? raw : "";
  });

  for (const item of manifestItems) {
    if (!isHtmlMedia(item.mediaType)) continue;
    if (isNavigationItem(item)) continue;
    if (keptIds.has(item.id)) continue;

    const zipPath = normalizeZipPath(opfDir, item.href.split("#")[0]);
    if (zipPath) zip.remove(zipPath);
  }

  zip.file(opfPath, nextOpf);
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  const result = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/epub+zip",
  });

  const exact = new Uint8Array(result.byteLength);
  exact.set(result);
  return exact.buffer;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonError("Identificador de libro invalido.", 400);
    }

    const mode = getReadMode(request);
    const book = await getBookByKey(bookkey);

    if (!book) {
      return jsonError("Libro no encontrado.", 404);
    }

    if (mode === "full") {
      const canRead = await userCanReadFullBook(book);

      if (!canRead) {
        return jsonError("Debes comprar este libro para leerlo completo.", 403);
      }
    }

    // Una sola fuente de verdad: el preview SIEMPRE se deriva del EPUB completo
    // actual. Asi, al reemplazar el EPUB completo, la muestra cambia de inmediato
    // y nunca puede quedar apuntando a un epub_preview viejo.
    const asset = await getAsset(book.id, "epub");

    if (!asset) {
      return jsonError(
        mode === "preview"
          ? "Este libro no tiene EPUB completo disponible para generar la muestra."
          : "Este libro no tiene EPUB completo registrado.",
        404
      );
    }

    const fullEpub = await downloadEpubAsset(asset);
    const payload =
      mode === "preview" ? await buildSafePreviewEpub(fullEpub) : fullEpub;

    const fileName = safeFileName(book.title);

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Length": String(payload.byteLength),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/epub error:", error);

    return jsonError("Error interno cargando EPUB.", 500);
  }
}
