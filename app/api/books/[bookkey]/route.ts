import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "book-covers";
const FILE_BUCKET = "book-files";
const PREVIEW_BUCKET = "book-previews";

const ALLOWED_BOOK_STATUSES = new Set([
  "draft",
  "under_review",
  "changes_requested",
  "approved",
  "published",
  "unlisted",
  "archived",
  "rejected",
]);

const ALLOWED_BOOK_EXTENSIONS = new Set(["pdf", "epub"]);

type RouteContext = {
  params: {
    bookkey: string;
  };
};

type OwnedBook = {
  id: string;
  title: string;
  slug: string;
  owner_user_id: string;
  cover_url: string | null;
};

type EditionRow = {
  id: string;
};

type RevisionType =
  | "minor_update"
  | "major_update"
  | "metadata_update"
  | "cover_update";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeBookKey(value: string | undefined) {
  return decodeURIComponent(value ?? "").trim();
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value || null;
}

function parseNullableNumber(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`El campo ${key} no es válido.`);
  }

  return parsed;
}

function parseRequiredPrice(formData: FormData) {
  const value = readText(formData, "price");
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("El precio no es válido.");
  }

  return parsed;
}

function parseBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function getExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getBookAssetType(fileName: string) {
  return getExtension(fileName) === "epub" ? "epub" : "pdf";
}

function isValidImageFile(file: File) {
  return !file.type || file.type.startsWith("image/");
}

function isAllowedBookFile(file: File) {
  return ALLOWED_BOOK_EXTENSIONS.has(getExtension(file.name));
}

function getFileField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File)) return null;
  if (value.size <= 0) return null;

  return value;
}

async function uploadFile(params: {
  bucket: string;
  storagePath: string;
  file: File;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(params.bucket)
    .upload(params.storagePath, buffer, {
      contentType: params.file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo: ${error.message}`);
  }
}

function getPublicUrl(bucket: string, storagePath: string) {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

async function getOwnedBook(bookId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      book: null,
      response: jsonError("No autorizado.", 401),
    };
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, owner_user_id, cover_url")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    return {
      user,
      book: null,
      response: jsonError(`Error cargando libro: ${bookError.message}`, 500),
    };
  }

  if (!book) {
    return {
      user,
      book: null,
      response: jsonError("Libro no encontrado.", 404),
    };
  }

  const ownedBook = book as OwnedBook;

  if (ownedBook.owner_user_id !== user.id) {
    return {
      user,
      book: null,
      response: jsonError("No tienes permiso para editar este libro.", 403),
    };
  }

  return {
    user,
    book: ownedBook,
    response: null,
  };
}

async function getOrCreateEdition(
  bookId: string,
  price: number,
  currency: string
) {
  const { data: existingEdition, error: editionError } = await supabaseAdmin
    .from("book_editions")
    .select("id")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (editionError) {
    throw new Error(`Error cargando edición: ${editionError.message}`);
  }

  if (existingEdition) {
    return (existingEdition as EditionRow).id;
  }

  const { data: insertedEdition, error: insertError } = await supabaseAdmin
    .from("book_editions")
    .insert({
      book_id: bookId,
      format: "ebook",
      edition_name: "Edición digital",
      price,
      currency,
      file_url: null,
      is_active: true,
      sort_order: 0,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Error creando edición: ${insertError.message}`);
  }

  return (insertedEdition as EditionRow).id;
}

async function upsertAsset(params: {
  bookId: string;
  editionId: string | null;
  assetType: string;
  bucket: string;
  storagePath: string;
  fileUrl: string | null;
  mimeType: string | null;
  isPublic: boolean;
  sortOrder: number;
}) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("book_assets")
    .select("id")
    .eq("book_id", params.bookId)
    .eq("asset_type", params.assetType)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Error buscando asset: ${existingError.message}`);
  }

  const payload = {
    book_id: params.bookId,
    edition_id: params.editionId,
    asset_type: params.assetType,
    storage_bucket: params.bucket,
    storage_path: params.storagePath,
    file_url: params.fileUrl,
    mime_type: params.mimeType,
    is_public: params.isPublic,
    sort_order: params.sortOrder,
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("book_assets")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new Error(`Error actualizando asset: ${error.message}`);
    }

    return;
  }

  const { error } = await supabaseAdmin.from("book_assets").insert(payload);

  if (error) {
    throw new Error(`Error creando asset: ${error.message}`);
  }
}

async function insertRevision(params: {
  bookId: string;
  editionId: string | null;
  userId: string;
  revisionType: RevisionType;
  changeNote: string | null;
  bucket: string | null;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
}) {
  const { error } = await supabaseAdmin.from("book_revisions").insert({
    book_id: params.bookId,
    edition_id: params.editionId,
    changed_by_user_id: params.userId,
    revision_type: params.revisionType,
    change_note: params.changeNote,
    storage_bucket: params.bucket,
    storage_path: params.storagePath,
    file_name: params.fileName,
    mime_type: params.mimeType,
  });

  if (error) {
    throw new Error(`Error guardando revisión: ${error.message}`);
  }
}

async function clearPreviewRows(bookId: string) {
  const { error } = await supabaseAdmin
    .from("book_preview_pages")
    .delete()
    .eq("book_id", bookId);

  if (error) {
    console.warn("No se pudieron limpiar previews anteriores:", error.message);
  }
}

async function clearPreviewFiles(book: OwnedBook) {
  const previewFolder = `previews/${book.slug}-${book.id}`;

  const { data, error } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .list(previewFolder, {
      limit: 300,
      sortBy: {
        column: "name",
        order: "asc",
      },
    });

  if (error) {
    return;
  }

  const paths = (data ?? [])
    .filter((item) => item.name)
    .map((item) => `${previewFolder}/${item.name}`);

  if (paths.length === 0) return;

  const { error: removeError } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .remove(paths);

  if (removeError) {
    console.warn("No se pudieron borrar imágenes preview:", removeError.message);
  }
}

async function markPreviewPending(book: OwnedBook) {
  await Promise.allSettled([clearPreviewRows(book.id), clearPreviewFiles(book)]);

  const { error } = await supabaseAdmin
    .from("books")
    .update({
      preview_status: "pending",
      preview_error: null,
      preview_generated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", book.id);

  if (error) {
    console.warn("No se pudo marcar preview como pendiente:", error.message);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const bookId = normalizeBookKey(params.bookkey);

    if (!bookId) {
      return jsonError("ID inválido.", 400);
    }

    const access = await getOwnedBook(bookId);

    if (access.response) {
      return access.response;
    }

    const user = access.user!;
    const book = access.book!;
    const formData = await request.formData();

    const title = readText(formData, "title");
    const status = readText(formData, "status") || "under_review";
    const price = parseRequiredPrice(formData);
    const currency = readText(formData, "currency") || "DOP";

    if (!title) {
      return jsonError("El título es obligatorio.", 400);
    }

    if (!ALLOWED_BOOK_STATUSES.has(status)) {
      return jsonError("Estado de libro inválido.", 400);
    }

    const editionId = await getOrCreateEdition(book.id, price, currency);
    const now = new Date().toISOString();

    const keywords = parseKeywords(readText(formData, "keywords"));

    const bookUpdate = {
      title,
      subtitle: nullableText(formData, "subtitle"),
      publisher_name: nullableText(formData, "publisher_name"),
      description_short: nullableText(formData, "description_short"),
      description_long: nullableText(formData, "description"),
      introduction: nullableText(formData, "introduction"),
      chapter_one_excerpt: nullableText(formData, "chapter_one_excerpt"),
      sample_url: nullableText(formData, "sample_url"),
      primary_niche: nullableText(formData, "primary_niche"),
      primary_category: nullableText(formData, "primary_category"),
      secondary_category: nullableText(formData, "secondary_category"),
      keywords,
      target_audience: nullableText(formData, "target_audience"),
      reader_promise: nullableText(formData, "reader_promise"),
      sales_hook: nullableText(formData, "sales_hook"),
      comparable_books: nullableText(formData, "comparable_books"),
      meta_title: nullableText(formData, "meta_title"),
      meta_description: nullableText(formData, "meta_description"),
      marketing_angle: nullableText(formData, "marketing_angle"),
      language_code: readText(formData, "language_code") || "es",
      status,
      updated_at: now,
    };

    const { error: bookUpdateError } = await supabaseAdmin
      .from("books")
      .update(bookUpdate)
      .eq("id", book.id);

    if (bookUpdateError) {
      throw new Error(`Error actualizando libro: ${bookUpdateError.message}`);
    }

    const editionUpdate = {
      price,
      currency,
      format: readText(formData, "format") || "ebook",
      edition_name: nullableText(formData, "edition_name") || "Edición digital",
      compare_at_price: parseNullableNumber(formData, "compare_at_price"),
      page_count: parseNullableNumber(formData, "page_count"),
      isbn: nullableText(formData, "isbn"),
      affiliate_enabled: parseBoolean(formData, "affiliate_enabled"),
      affiliate_commission_percentage: parseNullableNumber(
        formData,
        "affiliate_commission_percentage"
      ),
      download_allowed: parseBoolean(formData, "download_allowed"),
      updated_at: now,
    };

    const { error: editionUpdateError } = await supabaseAdmin
      .from("book_editions")
      .update(editionUpdate)
      .eq("id", editionId);

    if (editionUpdateError) {
      throw new Error(
        `Error actualizando edición: ${editionUpdateError.message}`
      );
    }

    const changeNote = nullableText(formData, "change_note");
    const cover = getFileField(formData, "cover");
    const bookFile = getFileField(formData, "book_file");

    if (cover) {
      if (!isValidImageFile(cover)) {
        return jsonError("La portada debe ser una imagen válida.", 400);
      }

      const coverExt = getExtension(cover.name) || "jpg";
      const coverPath = `covers/${book.slug}-${randomUUID()}.${coverExt}`;

      await uploadFile({
        bucket: COVER_BUCKET,
        storagePath: coverPath,
        file: cover,
      });

      const coverUrl = getPublicUrl(COVER_BUCKET, coverPath);

      const { error: coverUpdateError } = await supabaseAdmin
        .from("books")
        .update({
          cover_url: coverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", book.id);

      if (coverUpdateError) {
        throw new Error(
          `Error actualizando portada: ${coverUpdateError.message}`
        );
      }

      await upsertAsset({
        bookId: book.id,
        editionId: null,
        assetType: "cover",
        bucket: COVER_BUCKET,
        storagePath: coverPath,
        fileUrl: coverUrl,
        mimeType: cover.type || null,
        isPublic: true,
        sortOrder: 0,
      });

      await insertRevision({
        bookId: book.id,
        editionId,
        userId: user.id,
        revisionType: "cover_update",
        changeNote,
        bucket: COVER_BUCKET,
        storagePath: coverPath,
        fileName: cover.name,
        mimeType: cover.type || null,
      });
    }

    if (bookFile) {
      if (!isAllowedBookFile(bookFile)) {
        return jsonError("El archivo del libro debe ser PDF o EPUB.", 400);
      }

      const bookExt = getExtension(bookFile.name) || "pdf";
      const assetType = getBookAssetType(bookFile.name);
      const filePath = `books/${book.slug}-${randomUUID()}.${bookExt}`;

      await uploadFile({
        bucket: FILE_BUCKET,
        storagePath: filePath,
        file: bookFile,
      });

      await upsertAsset({
        bookId: book.id,
        editionId,
        assetType,
        bucket: FILE_BUCKET,
        storagePath: filePath,
        fileUrl: null,
        mimeType: bookFile.type || null,
        isPublic: false,
        sortOrder: 1,
      });

      const { error: clearFileUrlError } = await supabaseAdmin
        .from("book_editions")
        .update({
          file_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editionId);

      if (clearFileUrlError) {
        throw new Error(
          `Error limpiando URL pública del archivo: ${clearFileUrlError.message}`
        );
      }

      await markPreviewPending(book);

      await insertRevision({
        bookId: book.id,
        editionId,
        userId: user.id,
        revisionType: "minor_update",
        changeNote,
        bucket: FILE_BUCKET,
        storagePath: filePath,
        fileName: bookFile.name,
        mimeType: bookFile.type || null,
      });
    }

    if (!cover && !bookFile) {
      await insertRevision({
        bookId: book.id,
        editionId,
        userId: user.id,
        revisionType: "metadata_update",
        changeNote,
        bucket: null,
        storagePath: null,
        fileName: null,
        mimeType: null,
      });
    }

    return NextResponse.json({
      message: bookFile
        ? "Libro actualizado correctamente. Regenera el fragmento visual del manuscrito."
        : "Libro actualizado correctamente.",
      book: {
        id: book.id,
        slug: book.slug,
        title,
        status,
      },
      preview: {
        needsRegeneration: Boolean(bookFile),
        command: bookFile
          ? `npm run preview:book -- --slug ${book.slug} --pages 16 --scale 5200`
          : null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/books/[bookkey] error:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Error interno actualizando libro.",
      500
    );
  }
}