import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/security/http";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_BUCKET = "book-previews";
const PREVIEW_PAGE_LIMIT = 25;
const MAX_PREVIEW_IMAGE_BYTES = 15 * 1024 * 1024;
const SAFE_SLUG = /^[a-z0-9-]{1,160}$/i;

type RouteContext = {
  params: Promise<{
    bookkey: string;
    page: string;
  }>;
};

type PreviewPageRow = {
  image_path: string | null;
};

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    }
  );
}

function safeStoragePath(value: string | null) {
  if (!value || value.length > 1_024 || value.includes("\\") || value.includes("\0")) {
    return null;
  }

  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return value;
}

function detectImageType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  let bookkey = "";
  let pageIndex = -1;

  try {
    const params = await context.params;
    bookkey = decodeURIComponent(params.bookkey || "").trim();
    pageIndex = Number(params.page);
  } catch {
    return jsonError("Recurso no encontrado.", 404);
  }

  if (
    (!isUuid(bookkey) && !SAFE_SLUG.test(bookkey)) ||
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= PREVIEW_PAGE_LIMIT
  ) {
    return jsonError("Recurso no encontrado.", 404);
  }

  const rateLimit = await consumeRateLimit(request, {
    bucket: "book-preview-image",
    identity: bookkey,
    limit: 180,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return jsonError("Demasiadas solicitudes.", 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  let bookQuery = supabaseAdmin
    .from("books")
    .select("id")
    .eq("status", "published")
    .limit(1);

  bookQuery = isUuid(bookkey)
    ? bookQuery.eq("id", bookkey)
    : bookQuery.eq("slug", bookkey);

  const { data: book, error: bookError } = await bookQuery.maybeSingle<{
    id: string;
  }>();

  if (bookError) {
    console.error("No se pudo validar la muestra publicada:", bookError.message);
    return jsonError("No se pudo cargar la muestra.", 503);
  }

  if (!book) {
    return jsonError("Recurso no encontrado.", 404);
  }

  const { data: previewPage, error: previewError } = await supabaseAdmin
    .from("book_preview_pages")
    .select("image_path")
    .eq("book_id", book.id)
    .eq("page_index", pageIndex)
    .limit(1)
    .maybeSingle<PreviewPageRow>();

  if (previewError) {
    console.error("No se pudo localizar la página de muestra:", previewError.message);
    return jsonError("No se pudo cargar la muestra.", 503);
  }

  const storagePath = safeStoragePath(previewPage?.image_path ?? null);
  if (!storagePath) {
    return jsonError("Recurso no encontrado.", 404);
  }

  const { data: image, error: imageError } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .download(storagePath);

  if (imageError || !image) {
    if (imageError) {
      console.error("No se pudo descargar una página de muestra:", imageError.message);
    }
    return jsonError("Recurso no encontrado.", 404);
  }

  if (image.size < 3 || image.size > MAX_PREVIEW_IMAGE_BYTES) {
    console.error("Página de muestra rechazada por tamaño inválido.");
    return jsonError("No se pudo cargar la muestra.", 422);
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const detectedType = detectImageType(bytes);

  if (!detectedType) {
    console.error("Página de muestra rechazada por firma de archivo inválida.");
    return jsonError("No se pudo cargar la muestra.", 422);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": detectedType.contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="preview-${pageIndex + 1}.${detectedType.extension}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
