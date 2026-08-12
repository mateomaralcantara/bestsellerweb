// ============================================
// ARCHIVO: app/api/books/[bookkey]/route.ts
// ============================================

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "book-covers";
const FILE_BUCKET = "book-files";
const PREVIEW_BUCKET = "book-previews";

const MAX_COVER_SIZE_MB = 10;
const MAX_PDF_SIZE_MB = 250;
const MAX_EPUB_SIZE_MB = 100;

const MAX_COVER_SIZE_BYTES = MAX_COVER_SIZE_MB * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
const MAX_EPUB_SIZE_BYTES = MAX_EPUB_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_PDF_EXTENSIONS = new Set(["pdf"]);
const ALLOWED_EPUB_EXTENSIONS = new Set(["epub"]);

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

type AssetType = "cover" | "manuscript_pdf" | "epub" | "epub_preview";

type RevisionType =
  | "metadata_update"
  | "cover_update"
  | "manuscript_update"
  | "epub_update"
  | "preview_update";

type UploadedAsset = {
  assetType: AssetType;
  bucket: string;
  storagePath: string;
  fileUrl: string | null;
  mimeType: string | null;
  fileName: string;
  fileSize: number;
  isPublic: boolean;
  sortOrder: number;
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

function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...data,
    },
    { status }
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Error interno actualizando libro.";
}

function normalizeBookKey(value: string | undefined) {
  return decodeURIComponent(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value || null;
}

function parseNullableNumber(formData: FormData, key: string) {
  const value = readText(formData, key).replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`El campo ${key} no es válido.`);
  }

  return parsed;
}

function parseRequiredPrice(formData: FormData) {
  const value = readText(formData, "price").replace(",", ".");
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("El precio no es válido.");
  }

  return parsed;
}

function parseBoolean(formData: FormData, key: string) {
  const value = formData.get(key);

  return value === "true" || value === "on" || value === "1" || value === "yes";
}

function assignBooleanIfPresent(
  payload: Record<string, unknown>,
  payloadKey: string,
  formData: FormData,
  formKey: string
) {
  if (formData.has(formKey)) {
    payload[payloadKey] = parseBoolean(formData, formKey);
  }
}

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function getExtension(fileName: string) {
  const cleanName = String(fileName ?? "").split("?")[0];
  const parts = cleanName.split(".");

  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getFileExtension(file: File, fallback: string) {
  const ext = getExtension(file.name);

  if (ext) {
    return ext;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "application/epub+zip") return "epub";

  return fallback;
}

function safeStorageName(value: string) {
  return (
    String(value || "archivo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "archivo"
  );
}

function getFileField(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);

    if (value instanceof File && value.size > 0) {
      return value;
    }
  }

  return null;
}

function isValidImageFile(file: File) {
  const ext = getFileExtension(file, "jpg");

  const validMime =
    !file.type ||
    file.type.startsWith("image/") ||
    file.type === "application/octet-stream";

  const validExt = ALLOWED_IMAGE_EXTENSIONS.has(ext);

  return validMime && validExt;
}

function isValidPdfFile(file: File) {
  const ext = getFileExtension(file, "pdf");

  const validMime =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "application/octet-stream";

  const validExt = ALLOWED_PDF_EXTENSIONS.has(ext);

  return validMime && validExt;
}

function isValidEpubFile(file: File) {
  const ext = getFileExtension(file, "epub");

  const validMime =
    !file.type ||
    file.type === "application/epub+zip" ||
    file.type === "application/octet-stream" ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed";

  const validExt = ALLOWED_EPUB_EXTENSIONS.has(ext);

  return validMime && validExt;
}

function getMissingColumnFromError(errorMessage: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /column "([^"]+)" does not exist/i,
    /schema cache.*'([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function updateWithColumnFallback(params: {
  table: string;
  payload: Record<string, unknown>;
  eqColumn: string;
  eqValue: string;
  maxRetries?: number;
}) {
  let payload = { ...params.payload };
  const maxRetries = params.maxRetries ?? 40;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await supabaseAdmin
      .from(params.table)
      .update(payload)
      .eq(params.eqColumn, params.eqValue);

    if (!error) {
      return;
    }

    const missingColumn = getMissingColumnFromError(error.message);

    if (!missingColumn || !(missingColumn in payload)) {
      throw new Error(`Error actualizando ${params.table}: ${error.message}`);
    }

    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  throw new Error(`No se pudo actualizar ${params.table}.`);
}

async function insertWithColumnFallback(params: {
  table: string;
  payload: Record<string, unknown>;
  maxRetries?: number;
}) {
  let payload = { ...params.payload };
  const maxRetries = params.maxRetries ?? 40;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { error } = await supabaseAdmin.from(params.table).insert(payload);

    if (!error) {
      return;
    }

    const missingColumn = getMissingColumnFromError(error.message);

    if (!missingColumn || !(missingColumn in payload)) {
      throw new Error(`Error insertando en ${params.table}: ${error.message}`);
    }

    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  throw new Error(`No se pudo insertar en ${params.table}.`);
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
      contentType: params.file.type || "application/octet-stream",
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

  return publicUrl || null;
}

async function getOwnedBook(bookKey: string) {
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

  let bookQuery = supabaseAdmin
    .from("books")
    .select("id, title, slug, owner_user_id, cover_url");

  bookQuery = isUuid(bookKey)
    ? bookQuery.eq("id", bookKey)
    : bookQuery.eq("slug", bookKey);

  const { data: book, error: bookError } = await bookQuery.maybeSingle();

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

async function replaceAsset(params: {
  bookId: string;
  editionId: string | null;
  assetType: AssetType;
  replaceAssetTypes: string[];
  bucket: string;
  storagePath: string;
  fileUrl: string | null;
  mimeType: string | null;
  isPublic: boolean;
  sortOrder: number;
  fileName: string | null;
  fileSize: number | null;
}) {
  const { error: deleteError } = await supabaseAdmin
    .from("book_assets")
    .delete()
    .eq("book_id", params.bookId)
    .in("asset_type", params.replaceAssetTypes);

  if (deleteError) {
    throw new Error(`Error limpiando asset anterior: ${deleteError.message}`);
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
    file_name: params.fileName,
    file_size: params.fileSize,
    updated_at: new Date().toISOString(),
  };

  await insertWithColumnFallback({
    table: "book_assets",
    payload,
  });
}

async function tryInsertRevision(params: {
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
  try {
    await insertWithColumnFallback({
      table: "book_revisions",
      payload: {
        book_id: params.bookId,
        edition_id: params.editionId,
        changed_by_user_id: params.userId,
        revision_type: params.revisionType,
        change_note: params.changeNote,
        storage_bucket: params.bucket,
        storage_path: params.storagePath,
        file_name: params.fileName,
        mime_type: params.mimeType,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.warn("No se pudo guardar revisión:", error);
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

  if (paths.length === 0) {
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .remove(paths);

  if (removeError) {
    console.warn("No se pudieron borrar imágenes preview:", removeError.message);
  }
}

async function markPreviewPendingFromPdf(book: OwnedBook) {
  await Promise.allSettled([clearPreviewRows(book.id), clearPreviewFiles(book)]);

  await updateWithColumnFallback({
    table: "books",
    eqColumn: "id",
    eqValue: book.id,
    payload: {
      preview_mode: "pdf_images",
      preview_status: "pending",
      preview_error: null,
      preview_generated_at: null,
      updated_at: new Date().toISOString(),
    },
  });
}

function validateMainFields(formData: FormData) {
  const title = readText(formData, "title");
  const status = readText(formData, "status") || "under_review";
  const keywords = parseKeywords(readText(formData, "keywords"));

  if (!title) {
    throw new Error("El título es obligatorio.");
  }

  if (!ALLOWED_BOOK_STATUSES.has(status)) {
    throw new Error("Estado de libro inválido.");
  }

  if (keywords.length > 0 && keywords.length < 3) {
    throw new Error("Agrega mínimo 3 palabras clave o deja el campo vacío.");
  }

  return {
    title,
    status,
    keywords,
  };
}

function validateCoverFile(file: File) {
  if (file.size > MAX_COVER_SIZE_BYTES) {
    throw new Error(`La portada no debe superar ${MAX_COVER_SIZE_MB} MB.`);
  }

  if (!isValidImageFile(file)) {
    throw new Error("La portada debe ser JPG, PNG o WebP.");
  }
}

function validatePdfFile(file: File) {
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(`El PDF no debe superar ${MAX_PDF_SIZE_MB} MB.`);
  }

  if (!isValidPdfFile(file)) {
    throw new Error("El manuscrito principal debe ser un archivo PDF.");
  }
}

function validateEpubFile(file: File) {
  if (file.size > MAX_EPUB_SIZE_BYTES) {
    throw new Error(`El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`);
  }

  if (!isValidEpubFile(file)) {
    throw new Error("El archivo EPUB no es válido.");
  }
}

async function uploadCover(params: {
  book: OwnedBook;
  editionId: string;
  userId: string;
  changeNote: string | null;
  cover: File;
}) {
  validateCoverFile(params.cover);

  const coverExt = getFileExtension(params.cover, "jpg");
  const coverPath = `covers/${params.book.slug}-${randomUUID()}.${coverExt}`;

  await uploadFile({
    bucket: COVER_BUCKET,
    storagePath: coverPath,
    file: params.cover,
  });

  const coverUrl = getPublicUrl(COVER_BUCKET, coverPath);

  await updateWithColumnFallback({
    table: "books",
    eqColumn: "id",
    eqValue: params.book.id,
    payload: {
      cover_url: coverUrl,
      updated_at: new Date().toISOString(),
    },
  });

  await replaceAsset({
    bookId: params.book.id,
    editionId: null,
    assetType: "cover",
    replaceAssetTypes: ["cover"],
    bucket: COVER_BUCKET,
    storagePath: coverPath,
    fileUrl: coverUrl,
    mimeType: params.cover.type || null,
    isPublic: true,
    sortOrder: 0,
    fileName: safeStorageName(params.cover.name),
    fileSize: params.cover.size,
  });

  await tryInsertRevision({
    bookId: params.book.id,
    editionId: params.editionId,
    userId: params.userId,
    revisionType: "cover_update",
    changeNote: params.changeNote,
    bucket: COVER_BUCKET,
    storagePath: coverPath,
    fileName: params.cover.name,
    mimeType: params.cover.type || null,
  });
}

async function uploadManuscriptPdf(params: {
  book: OwnedBook;
  editionId: string;
  userId: string;
  changeNote: string | null;
  pdf: File;
}) {
  validatePdfFile(params.pdf);

  const pdfPath = `manuscripts/${params.book.slug}-${randomUUID()}.pdf`;

  await uploadFile({
    bucket: FILE_BUCKET,
    storagePath: pdfPath,
    file: params.pdf,
  });

  await replaceAsset({
    bookId: params.book.id,
    editionId: params.editionId,
    assetType: "manuscript_pdf",
    replaceAssetTypes: ["manuscript_pdf", "pdf"],
    bucket: FILE_BUCKET,
    storagePath: pdfPath,
    fileUrl: null,
    mimeType: params.pdf.type || "application/pdf",
    isPublic: false,
    sortOrder: 1,
    fileName: safeStorageName(params.pdf.name),
    fileSize: params.pdf.size,
  });

  await updateWithColumnFallback({
    table: "book_editions",
    eqColumn: "id",
    eqValue: params.editionId,
    payload: {
      file_url: null,
      format: "ebook",
      updated_at: new Date().toISOString(),
    },
  });

  await markPreviewPendingFromPdf(params.book);

  await tryInsertRevision({
    bookId: params.book.id,
    editionId: params.editionId,
    userId: params.userId,
    revisionType: "manuscript_update",
    changeNote: params.changeNote,
    bucket: FILE_BUCKET,
    storagePath: pdfPath,
    fileName: params.pdf.name,
    mimeType: params.pdf.type || "application/pdf",
  });

  return pdfPath;
}

async function uploadOptionalEpub(params: {
  book: OwnedBook;
  editionId: string;
  userId: string;
  changeNote: string | null;
  epub: File;
}) {
  validateEpubFile(params.epub);

  const epubPath = `epubs/${params.book.slug}-${randomUUID()}.epub`;

  await uploadFile({
    bucket: FILE_BUCKET,
    storagePath: epubPath,
    file: params.epub,
  });

  await replaceAsset({
    bookId: params.book.id,
    editionId: params.editionId,
    assetType: "epub",
    replaceAssetTypes: ["epub"],
    bucket: FILE_BUCKET,
    storagePath: epubPath,
    fileUrl: null,
    mimeType: params.epub.type || "application/epub+zip",
    isPublic: false,
    sortOrder: 2,
    fileName: safeStorageName(params.epub.name),
    fileSize: params.epub.size,
  });

  await tryInsertRevision({
    bookId: params.book.id,
    editionId: params.editionId,
    userId: params.userId,
    revisionType: "epub_update",
    changeNote: params.changeNote,
    bucket: FILE_BUCKET,
    storagePath: epubPath,
    fileName: params.epub.name,
    mimeType: params.epub.type || "application/epub+zip",
  });

  return epubPath;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const bookKey = normalizeBookKey(params.bookkey);

    if (!bookKey) {
      return jsonError("ID inválido.", 400);
    }

    const access = await getOwnedBook(bookKey);

    if (access.response) {
      return access.response;
    }

    const user = access.user!;
    const book = access.book!;
    const formData = await request.formData();

    const { title, status, keywords } = validateMainFields(formData);

    const price = parseRequiredPrice(formData);
    const currency = readText(formData, "currency") || "DOP";
    const paypalPrice = parseNullableNumber(formData, "paypal_price");
    const paypalCurrency = (
      readText(formData, "paypal_currency") || "USD"
    ).toUpperCase();

    if (paypalPrice !== null && paypalPrice <= 0) {
      return jsonError("El precio PayPal debe ser mayor que cero.", 400);
    }

    if (paypalCurrency !== "USD") {
      return jsonError("La moneda PayPal debe ser USD.", 400);
    }

    const editionId = await getOrCreateEdition(book.id, price, currency);
    const now = new Date().toISOString();

    const bookUpdate: Record<string, unknown> = {
      title,
      subtitle: nullableText(formData, "subtitle"),
      publisher_name: nullableText(formData, "publisher_name"),

      description_short: nullableText(formData, "description_short"),
      description_long:
        nullableText(formData, "description") ||
        nullableText(formData, "description_long"),
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

    assignBooleanIfPresent(bookUpdate, "featured", formData, "is_featured");
    assignBooleanIfPresent(bookUpdate, "is_featured", formData, "is_featured");

    await updateWithColumnFallback({
      table: "books",
      payload: bookUpdate,
      eqColumn: "id",
      eqValue: book.id,
    });

    const editionUpdate: Record<string, unknown> = {
      price,
      currency,
      paypal_price: paypalPrice,
      paypal_currency: paypalCurrency,
      format: readText(formData, "format") || "ebook",
      edition_name: nullableText(formData, "edition_name") || "Edición digital",
      compare_at_price: parseNullableNumber(formData, "compare_at_price"),
      page_count: parseNullableNumber(formData, "page_count"),
      isbn: nullableText(formData, "isbn"),
      affiliate_commission_percentage: parseNullableNumber(
        formData,
        "affiliate_commission_percentage"
      ),
      updated_at: now,
    };

    assignBooleanIfPresent(
      editionUpdate,
      "affiliate_enabled",
      formData,
      "affiliate_enabled"
    );

    assignBooleanIfPresent(
      editionUpdate,
      "download_allowed",
      formData,
      "download_allowed"
    );

    await updateWithColumnFallback({
      table: "book_editions",
      payload: editionUpdate,
      eqColumn: "id",
      eqValue: editionId,
    });

    const changeNote = nullableText(formData, "change_note");

    const cover = getFileField(formData, ["cover"]);
    const manuscriptPdf = getFileField(formData, [
      "manuscript_pdf",
      "pdf_file",
      "book_pdf",
      "book_file",
    ]);
    const optionalEpub = getFileField(formData, ["epub_file", "epub"]);

    let changedCover = false;
    let changedManuscriptPdf = false;
    let changedEpub = false;

    if (cover) {
      await uploadCover({
        book,
        editionId,
        userId: user.id,
        changeNote,
        cover,
      });

      changedCover = true;
    }

    if (manuscriptPdf) {
      await uploadManuscriptPdf({
        book,
        editionId,
        userId: user.id,
        changeNote,
        pdf: manuscriptPdf,
      });

      changedManuscriptPdf = true;
    }

    if (optionalEpub) {
      await uploadOptionalEpub({
        book,
        editionId,
        userId: user.id,
        changeNote,
        epub: optionalEpub,
      });

      changedEpub = true;
    }

    if (!changedCover && !changedManuscriptPdf && !changedEpub) {
      await tryInsertRevision({
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

    return jsonOk({
      message: changedManuscriptPdf
        ? "Libro actualizado correctamente. El fragmento quedó pendiente para generarse desde el PDF."
        : "Libro actualizado correctamente.",
      book: {
        id: book.id,
        slug: book.slug,
        title,
        status,
      },
      updated: {
        metadata: true,
        cover: changedCover,
        manuscript_pdf: changedManuscriptPdf,
        epub: changedEpub,
      },
      preview: {
        mode: changedManuscriptPdf ? "pdf_images" : null,
        status: changedManuscriptPdf ? "pending" : null,
        needsRegeneration: changedManuscriptPdf,
        command: changedManuscriptPdf
          ? `npm run preview:book -- --slug ${book.slug} --pages 16 --scale 5200`
          : null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/books/[bookkey] error:", error);

    return jsonError(getErrorMessage(error), 500);
  }
}
