import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBookEpubById } from "@/lib/epub-normalization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_BUCKET = "book-files";
const MAX_EPUB_SIZE_MB = 100;
const MAX_EPUB_SIZE_BYTES = MAX_EPUB_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "",
  "application/epub+zip",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
]);

type RouteContext = { params: Promise<{ bookkey: string }> };
type OwnedBook = { id: string; slug: string; owner_user_id: string };
type EditionRow = { id: string };
type ExistingAsset = { id: string; storage_bucket: string | null; storage_path: string | null };

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeBookKey(value: string | undefined) {
  try {
    return decodeURIComponent(value ?? "").trim();
  } catch {
    return "";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeSlug(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "libro"
  );
}

async function getOwnedBook(bookkey: string) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, book: null, error: jsonError("No autorizado.", 401) };

  let query = supabaseAdmin.from("books").select("id, slug, owner_user_id").limit(1);
  query = isUuid(bookkey) ? query.eq("id", bookkey) : query.eq("slug", bookkey);
  const { data, error } = await query.maybeSingle<OwnedBook>();
  if (error) return { user, book: null, error: jsonError(`Error cargando libro: ${error.message}`, 500) };
  if (!data) return { user, book: null, error: jsonError("Libro no encontrado.", 404) };
  if (data.owner_user_id !== user.id) {
    return { user, book: null, error: jsonError("No tienes permiso para editar este libro.", 403) };
  }
  return { user, book: data, error: null };
}

async function getActiveEdition(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_editions")
    .select("id")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<EditionRow>();
  if (error) throw new Error(`Error cargando edición: ${error.message}`);
  return data?.id ?? null;
}

async function verifyUploadedObject(book: OwnedBook, storagePath: string) {
  const expectedPrefix = `books/${book.id}/full/`;
  if (!storagePath.startsWith(expectedPrefix) || !storagePath.endsWith(".epub")) {
    throw new Error("La ruta EPUB subida no es válida para este libro.");
  }
  const fileName = storagePath.slice(expectedPrefix.length);
  if (!fileName || fileName.includes("/")) throw new Error("La ruta EPUB subida no es válida.");

  const { data, error } = await supabaseAdmin.storage
    .from(FILE_BUCKET)
    .list(expectedPrefix.replace(/\/$/, ""), { search: fileName, limit: 10 });
  if (error) throw new Error(`No se pudo verificar el EPUB subido: ${error.message}`);

  const uploaded = (data ?? []).find((item) => item.name === fileName);
  if (!uploaded) throw new Error("El EPUB todavía no aparece en Storage.");
  const size = Number(uploaded.metadata?.size ?? 0);
  if (Number.isFinite(size) && size > MAX_EPUB_SIZE_BYTES) {
    await supabaseAdmin.storage.from(FILE_BUCKET).remove([storagePath]);
    throw new Error(`El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`);
  }
  return { size: Number.isFinite(size) && size > 0 ? size : null };
}

async function removeStorageObjects(paths: Array<string | null | undefined>) {
  const clean = Array.from(new Set(paths.filter((item): item is string => Boolean(item))));
  if (!clean.length) return;
  const { error } = await supabaseAdmin.storage.from(FILE_BUCKET).remove(clean);
  if (error) console.warn("No se pudieron limpiar EPUB anteriores:", error.message);
}

async function invalidatePreviousNormalization(bookId: string) {
  const { error } = await supabaseAdmin
    .from("epub_normalizations")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("book_id", bookId)
    .eq("is_current", true);
  if (error) {
    console.warn("Normalizador aún no habilitado en Supabase:", error.message);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const bookkey = normalizeBookKey((await params).bookkey);
    if (!bookkey) return jsonError("ID de libro inválido.", 400);
    const access = await getOwnedBook(bookkey);
    if (access.error || !access.book) return access.error;

    const body = (await request.json()) as { fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body.fileSize);
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";

    if (!fileName.toLowerCase().endsWith(".epub")) return jsonError("El archivo debe tener extensión .epub.", 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0) return jsonError("El tamaño del EPUB no es válido.", 400);
    if (fileSize > MAX_EPUB_SIZE_BYTES) return jsonError(`El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`, 413);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return jsonError("El tipo MIME del EPUB no es válido.", 400);

    const storagePath = `books/${access.book.id}/full/${safeSlug(access.book.slug)}-${randomUUID()}.epub`;
    const { data, error } = await supabaseAdmin.storage.from(FILE_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.token) {
      console.error("No se pudo crear URL firmada EPUB:", error?.message);
      return jsonError("No se pudo preparar la carga directa del EPUB.", 500);
    }

    return NextResponse.json({
      ok: true,
      bucket: FILE_BUCKET,
      path: storagePath,
      token: data.token,
      maxSizeBytes: MAX_EPUB_SIZE_BYTES,
      expiresInSeconds: 7200,
    });
  } catch (error) {
    console.error("POST /api/books/[bookkey]/epub-upload error:", error);
    return jsonError("Error preparando la carga directa del EPUB.", 500);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const bookkey = normalizeBookKey((await params).bookkey);
    if (!bookkey) return jsonError("ID de libro inválido.", 400);
    const access = await getOwnedBook(bookkey);
    if (access.error || !access.book || !access.user) return access.error;

    const body = (await request.json()) as { path?: unknown; fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    const storagePath = typeof body.path === "string" ? body.path.trim() : "";
    const declaredSize = Number(body.fileSize);
    const mimeType =
      typeof body.mimeType === "string" && ALLOWED_MIME_TYPES.has(body.mimeType.trim())
        ? body.mimeType.trim() || "application/epub+zip"
        : "application/epub+zip";

    if (!storagePath) return jsonError("Falta la ruta del EPUB cargado.", 400);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_EPUB_SIZE_BYTES) {
      return jsonError(`El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`, 413);
    }

    const verified = await verifyUploadedObject(access.book, storagePath);
    const editionId = await getActiveEdition(access.book.id);
    const { data: previousEpubs, error: previousError } = await supabaseAdmin
      .from("book_assets")
      .select("id, storage_bucket, storage_path")
      .eq("book_id", access.book.id)
      .eq("asset_type", "epub")
      .order("sort_order", { ascending: true })
      .returns<ExistingAsset[]>();
    if (previousError) throw new Error(`Error cargando EPUB anterior: ${previousError.message}`);

    const now = new Date().toISOString();
    const primaryAsset = previousEpubs?.[0] ?? null;
    const assetPayload = {
      book_id: access.book.id,
      edition_id: editionId,
      asset_type: "epub",
      storage_bucket: FILE_BUCKET,
      storage_path: storagePath,
      file_url: null,
      mime_type: mimeType,
      is_public: false,
      sort_order: 2,
    };

    if (primaryAsset) {
      const { error } = await supabaseAdmin.from("book_assets").update(assetPayload).eq("id", primaryAsset.id);
      if (error) throw new Error(`Error actualizando asset EPUB: ${error.message}`);
      const duplicateIds = (previousEpubs ?? []).slice(1).map((item) => item.id);
      if (duplicateIds.length) await supabaseAdmin.from("book_assets").delete().in("id", duplicateIds);
    } else {
      const { error } = await supabaseAdmin.from("book_assets").insert(assetPayload);
      if (error) throw new Error(`Error registrando asset EPUB: ${error.message}`);
    }

    await invalidatePreviousNormalization(access.book.id);

    const { data: oldPreviews } = await supabaseAdmin
      .from("book_assets")
      .select("id, storage_bucket, storage_path")
      .eq("book_id", access.book.id)
      .eq("asset_type", "epub_preview")
      .returns<ExistingAsset[]>();
    const { error: deletePreviewError } = await supabaseAdmin
      .from("book_assets")
      .delete()
      .eq("book_id", access.book.id)
      .eq("asset_type", "epub_preview");
    if (deletePreviewError) console.warn("No se pudo limpiar epub_preview anterior:", deletePreviewError.message);

    const { error: bookUpdateError } = await supabaseAdmin
      .from("books")
      .update({
        preview_mode: "epub_preview",
        preview_status: "ready",
        preview_page_count: 25,
        preview_error: null,
        preview_generated_at: now,
        updated_at: now,
      })
      .eq("id", access.book.id);
    if (bookUpdateError) console.warn("No se pudo actualizar metadata preview:", bookUpdateError.message);

    await removeStorageObjects([
      ...(previousEpubs ?? []).map((item) => item.storage_path).filter((item) => item && item !== storagePath),
      ...(oldPreviews ?? []).map((item) => item.storage_path),
    ]);

    const normalization = await normalizeBookEpubById(access.book.id);

    return NextResponse.json({
      ok: true,
      message: "EPUB actualizado directamente en Storage.",
      epub: {
        bucket: FILE_BUCKET,
        path: storagePath,
        size: verified.size ?? (Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : null),
      },
      preview: { mode: "derived_from_current_epub", pageCount: 25, refreshed: true },
      normalization: {
        status: normalization.status,
        optimized: normalization.optimized,
        report: normalization.report,
        warning: normalization.error || null,
      },
    });
  } catch (error) {
    console.error("PUT /api/books/[bookkey]/epub-upload error:", error);
    const message = error instanceof Error ? error.message : "Error finalizando EPUB.";
    return jsonError(message, 500);
  }
}
