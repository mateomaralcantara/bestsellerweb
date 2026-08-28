import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_SPINE_LIMIT = 5;

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
  raw: string;
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
  return decodeURIComponent(value || "").trim();
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

async function getAsset(bookId: string, assetType: string) {
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
    console.error("Error verificando compra EPUB full:", purchaseError);
    return false;
  }

  return Boolean(purchase);
}

async function downloadEpubAsset(asset: BookAsset) {
  if (!asset.storage_bucket || !asset.storage_path) {
    return {
      ok: false as const,
      error: "El asset EPUB no tiene bucket o ruta de Storage.",
      arrayBuffer: null,
    };
  }

  const { data: file, error } = await supabaseAdmin.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path);

  if (error || !file) {
    return {
      ok: false as const,
      error: error?.message || "No se pudo descargar el EPUB desde Storage.",
      arrayBuffer: null,
    };
  }

  const arrayBuffer = await file.arrayBuffer();

  if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
    return {
      ok: false as const,
      error: "El EPUB descargado está vacío.",
      arrayBuffer: null,
    };
  }

  return {
    ok: true as const,
    error: "",
    arrayBuffer,
  };
}

function attr(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || "";
}

function normalizeZipPath(baseDir: string, href: string) {
  const parts = `${baseDir}/${href}`
    .replace(/\\/g, "/")
    .split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return stack.join("/");
}

function isHtmlMedia(mediaType: string) {
  return mediaType === "application/xhtml+xml" || mediaType === "text/html";
}

async function buildSafePreviewEpub(arrayBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const containerFile = zip.file("META-INF/container.xml");

  if (!containerFile) {
    throw new Error("EPUB inválido: falta META-INF/container.xml.");
  }

  const containerXml = await containerFile.async("string");
  const opfPath =
    containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "";

  if (!opfPath) {
    throw new Error("EPUB inválido: no se encontró el OPF.");
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error("EPUB inválido: el OPF no existe en el ZIP.");
  }

  const opf = await opfFile.async("string");
  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/"))
    : "";

  const manifestItems: ManifestItem[] = Array.from(
    opf.matchAll(/<item\b[^>]*\/?\s*>/gi)
  ).map((match) => ({
    raw: match[0],
    id: attr(match[0], "id"),
    href: attr(match[0], "href"),
    mediaType: attr(match[0], "media-type"),
    properties: attr(match[0], "properties"),
  }));

  const manifestById = new Map(
    manifestItems.filter((item) => item.id).map((item) => [item.id, item])
  );

  const spineRefs = Array.from(opf.matchAll(/<itemref\b[^>]*\/?\s*>/gi))
    .map((match) => ({ raw: match[0], idref: attr(match[0], "idref") }))
    .filter((item) => item.idref);

  const readableSpine = spineRefs.filter((ref) => {
    const item = manifestById.get(ref.idref);
    if (!item) return false;
    if (!isHtmlMedia(item.mediaType)) return false;
    if (/\bnav\b/i.test(item.properties)) return false;

    const href = item.href.toLowerCase().split("#")[0];
    return !href.endsWith("nav.xhtml") && !href.endsWith("toc.xhtml");
  });

  const keptIds = new Set(
    readableSpine.slice(0, PREVIEW_SPINE_LIMIT).map((item) => item.idref)
  );

  if (keptIds.size === 0) {
    throw new Error("EPUB inválido: no hay secciones legibles para preview.");
  }

  let nextOpf = opf.replace(/<itemref\b[^>]*\/?\s*>/gi, (raw) => {
    const idref = attr(raw, "idref");
    return keptIds.has(idref) ? raw : "";
  });

  nextOpf = nextOpf.replace(/<item\b[^>]*\/?\s*>/gi, (raw) => {
    const id = attr(raw, "id");
    const mediaType = attr(raw, "media-type");
    const properties = attr(raw, "properties");

    if (!isHtmlMedia(mediaType)) return raw;
    if (/\bnav\b/i.test(properties)) return raw;
    return keptIds.has(id) ? raw : "";
  });

  for (const item of manifestItems) {
    if (!isHtmlMedia(item.mediaType)) continue;
    if (/\bnav\b/i.test(item.properties)) continue;
    if (keptIds.has(item.id)) continue;

    const zipPath = normalizeZipPath(opfDir, item.href.split("#")[0]);
    if (zipPath) zip.remove(zipPath);
  }

  zip.file(opfPath, nextOpf);

  const result = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/epub+zip",
  });

  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonError("Identificador de libro inválido.", 400);
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

    let asset = await getAsset(
      book.id,
      mode === "preview" ? "epub_preview" : "epub"
    );
    let derivePreview = false;

    if (!asset && mode === "preview") {
      asset = await getAsset(book.id, "epub");
      derivePreview = Boolean(asset);
    }

    if (!asset) {
      return jsonError(
        mode === "preview"
          ? "Este libro no tiene EPUB disponible para preview."
          : "Este libro no tiene EPUB completo registrado.",
        404
      );
    }

    const downloaded = await downloadEpubAsset(asset);

    if (!downloaded.ok || !downloaded.arrayBuffer) {
      return jsonError(downloaded.error, 500);
    }

    const payload =
      mode === "preview" && derivePreview
        ? await buildSafePreviewEpub(downloaded.arrayBuffer)
        : downloaded.arrayBuffer;

    const contentType = "application/epub+zip";
    const fileName = safeFileName(book.title);

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(payload.byteLength),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control":
          mode === "preview"
            ? "public, max-age=300, stale-while-revalidate=600"
            : "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/epub error:", error);

    return jsonError("Error interno cargando EPUB.", 500);
  }
}
