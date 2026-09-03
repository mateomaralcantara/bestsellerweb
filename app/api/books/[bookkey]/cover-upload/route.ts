import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "book-covers";
const MAX_COVER_SIZE_MB = 10;
const MAX_COVER_SIZE_BYTES = MAX_COVER_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME_TYPES = new Set([
  "",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/octet-stream",
]);

type RouteContext = { params: Promise<{ bookkey: string }> };
type OwnedBook = { id: string; slug: string; owner_user_id: string };
type ExistingCover = { id: string; storage_bucket: string | null; storage_path: string | null };

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

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

async function getOwnedBook(bookkey: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, book: null, error: jsonError("No autorizado.", 401) };
  }

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

async function verifyUploadedObject(book: OwnedBook, storagePath: string) {
  const expectedPrefix = `covers/${book.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("La ruta de portada no pertenece a este libro.");
  }

  const fileName = storagePath.slice(expectedPrefix.length);
  if (!fileName || fileName.includes("/")) throw new Error("La ruta de portada no es válida.");

  const { data, error } = await supabaseAdmin.storage
    .from(COVER_BUCKET)
    .list(expectedPrefix.replace(/\/$/, ""), { search: fileName, limit: 10 });

  if (error) throw new Error(`No se pudo verificar la portada: ${error.message}`);
  const uploaded = (data ?? []).find((item) => item.name === fileName);
  if (!uploaded) throw new Error("La portada todavía no aparece en Storage.");

  const size = Number(uploaded.metadata?.size ?? 0);
  if (Number.isFinite(size) && size > MAX_COVER_SIZE_BYTES) {
    await supabaseAdmin.storage.from(COVER_BUCKET).remove([storagePath]);
    throw new Error(`La portada no debe superar ${MAX_COVER_SIZE_MB} MB.`);
  }
}

function getPublicUrl(storagePath: string) {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(COVER_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const bookkey = normalizeBookKey((await params).bookkey);
    if (!bookkey) return jsonError("ID de libro inválido.", 400);

    const access = await getOwnedBook(bookkey);
    if (access.error || !access.book) return access.error;

    const body = (await request.json()) as {
      fileName?: unknown;
      fileSize?: unknown;
      mimeType?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body.fileSize);
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const ext = extension(fileName);

    if (!ALLOWED_EXTENSIONS.has(ext)) return jsonError("La portada debe ser JPG, PNG o WebP.", 400);
    if (!Number.isFinite(fileSize) || fileSize <= 0) return jsonError("El tamaño de la portada no es válido.", 400);
    if (fileSize > MAX_COVER_SIZE_BYTES) return jsonError(`La portada no debe superar ${MAX_COVER_SIZE_MB} MB.`, 413);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return jsonError("El tipo MIME de la portada no es válido.", 400);

    const storagePath = `covers/${access.book.id}/${safeSlug(access.book.slug)}-${randomUUID()}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(COVER_BUCKET).createSignedUploadUrl(storagePath);

    if (error || !data?.token) {
      console.error("No se pudo crear URL firmada de portada:", error?.message);
      return jsonError("No se pudo preparar la carga directa de la portada.", 500);
    }

    return NextResponse.json({
      ok: true,
      bucket: COVER_BUCKET,
      path: storagePath,
      token: data.token,
      maxSizeBytes: MAX_COVER_SIZE_BYTES,
    });
  } catch (error) {
    console.error("POST /api/books/[bookkey]/cover-upload error:", error);
    return jsonError("Error preparando la carga directa de la portada.", 500);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const bookkey = normalizeBookKey((await params).bookkey);
    if (!bookkey) return jsonError("ID de libro inválido.", 400);

    const access = await getOwnedBook(bookkey);
    if (access.error || !access.book) return access.error;

    const body = (await request.json()) as {
      path?: unknown;
      mimeType?: unknown;
      fileSize?: unknown;
    };

    const storagePath = typeof body.path === "string" ? body.path.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "image/jpeg";
    if (!storagePath) return jsonError("Falta la ruta de la portada cargada.", 400);

    await verifyUploadedObject(access.book, storagePath);
    const publicUrl = getPublicUrl(storagePath);

    const { data: previousCovers, error: previousError } = await supabaseAdmin
      .from("book_assets")
      .select("id, storage_bucket, storage_path")
      .eq("book_id", access.book.id)
      .eq("asset_type", "cover")
      .order("sort_order", { ascending: true })
      .returns<ExistingCover[]>();

    if (previousError) throw new Error(`Error cargando portada anterior: ${previousError.message}`);

    const primary = previousCovers?.[0] ?? null;
    const assetPayload = {
      book_id: access.book.id,
      edition_id: null,
      asset_type: "cover",
      storage_bucket: COVER_BUCKET,
      storage_path: storagePath,
      file_url: publicUrl,
      mime_type: ALLOWED_MIME_TYPES.has(mimeType) ? mimeType || "image/jpeg" : "image/jpeg",
      is_public: true,
      sort_order: 0,
    };

    if (primary) {
      const { error } = await supabaseAdmin.from("book_assets").update(assetPayload).eq("id", primary.id);
      if (error) throw new Error(`Error actualizando portada: ${error.message}`);

      const duplicateIds = (previousCovers ?? []).slice(1).map((item) => item.id);
      if (duplicateIds.length) await supabaseAdmin.from("book_assets").delete().in("id", duplicateIds);
    } else {
      const { error } = await supabaseAdmin.from("book_assets").insert(assetPayload);
      if (error) throw new Error(`Error registrando portada: ${error.message}`);
    }

    const { error: bookError } = await supabaseAdmin
      .from("books")
      .update({ cover_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", access.book.id);

    if (bookError) throw new Error(`Error actualizando portada del libro: ${bookError.message}`);

    const oldPaths = (previousCovers ?? [])
      .map((item) => item.storage_path)
      .filter((item): item is string => Boolean(item) && item !== storagePath);

    if (oldPaths.length) {
      const { error } = await supabaseAdmin.storage.from(COVER_BUCKET).remove(oldPaths);
      if (error) console.warn("No se pudieron limpiar portadas anteriores:", error.message);
    }

    return NextResponse.json({ ok: true, message: "Portada actualizada.", coverUrl: publicUrl });
  } catch (error) {
    console.error("PUT /api/books/[bookkey]/cover-upload error:", error);
    const message = error instanceof Error ? error.message : "Error finalizando portada.";
    return jsonError(message, 500);
  }
}
