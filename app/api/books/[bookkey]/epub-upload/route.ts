import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

type RouteContext = {
  params: Promise<{ bookkey: string }>;
};

type OwnedBook = {
  id: string;
  slug: string;
  owner_user_id: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeBookKey(value: string | undefined) {
  return decodeURIComponent(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, book: null, error: jsonError("No autorizado.", 401) };
  }

  let query = supabaseAdmin
    .from("books")
    .select("id, slug, owner_user_id")
    .limit(1);

  query = isUuid(bookkey) ? query.eq("id", bookkey) : query.eq("slug", bookkey);

  const { data, error } = await query.maybeSingle<OwnedBook>();

  if (error) {
    return {
      user,
      book: null,
      error: jsonError(`Error cargando libro: ${error.message}`, 500),
    };
  }

  if (!data) {
    return { user, book: null, error: jsonError("Libro no encontrado.", 404) };
  }

  if (data.owner_user_id !== user.id) {
    return {
      user,
      book: null,
      error: jsonError("No tienes permiso para editar este libro.", 403),
    };
  }

  return { user, book: data, error: null };
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

    if (!fileName.toLowerCase().endsWith(".epub")) {
      return jsonError("El archivo debe tener extensión .epub.", 400);
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return jsonError("El tamaño del EPUB no es válido.", 400);
    }

    if (fileSize > MAX_EPUB_SIZE_BYTES) {
      return jsonError(
        `El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`,
        413
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonError("El tipo MIME del EPUB no es válido.", 400);
    }

    const storagePath = `books/${access.book.id}/full/${safeSlug(
      access.book.slug
    )}-${randomUUID()}.epub`;

    const { data, error } = await supabaseAdmin.storage
      .from(FILE_BUCKET)
      .createSignedUploadUrl(storagePath);

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
