import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import {
  DEFAULT_BOOK_DISPLAY_RATING,
  DEFAULT_BOOK_DISPLAY_SALES_COUNT,
  mergeBookSocialProofMetadata,
} from "@/lib/book-social-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "book-covers";
const FILE_BUCKET = "book-files";

const SHORT_DESCRIPTION_LIMIT = 180;
const PREVIEW_PAGE_COUNT = 25;

const MAX_COVER_SIZE_MB = 10;
const MAX_BOOK_SIZE_MB = 100;
const MAX_PREVIEW_SIZE_MB = 50;
const MAX_COVER_SIZE_BYTES = MAX_COVER_SIZE_MB * 1024 * 1024;
const MAX_BOOK_SIZE_BYTES = MAX_BOOK_SIZE_MB * 1024 * 1024;
const MAX_PREVIEW_SIZE_BYTES = MAX_PREVIEW_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_BOOK_EXTENSIONS = new Set(["epub"]);

const ALLOWED_CREATE_STATUSES = new Set(["draft", "under_review"]);

const DEV_MODE = process.env.NODE_ENV !== "production";
const DEV_TEST_USER_ID = process.env.DEV_TEST_USER_ID?.trim() || "";

type BookAssetType = "manuscript_pdf" | "pdf" | "epub";
type CreateBookStatus = "draft" | "under_review";
type PreviewMode = "first_pages" | "pdf_images" | "epub_preview" | "manual" | "disabled";
type PreviewStatus = "disabled" | "pending" | "ready" | "unsupported";
type RecordId = string | number;

type EffectiveUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
  } | null;
};

type RollbackState = {
  bookId: RecordId | null;
  editionId: RecordId | null;
  coverPath: string | null;
  filePath: string | null;
  previewPath: string | null;
};

type UploadBookForm = {
  title: string;
  subtitle: string | null;
  publisherName: string | null;

  descriptionShortInput: string | null;
  descriptionInput: string;
  introductionInput: string | null;
  chapterOneInput: string | null;
  sampleUrlInput: string | null;

  primaryNiche: string;
  primaryCategory: string;
  secondaryCategory: string | null;
  keywords: string[];

  targetAudience: string | null;
  readerPromise: string | null;
  salesHook: string | null;
  comparableBooks: string | null;

  metaTitle: string | null;
  metaDescription: string | null;
  marketingAngle: string | null;

  languageCode: string;
  format: string;
  status: CreateBookStatus;

  price: number;
  currency: string;
  paypalPrice: number | null;
  paypalCurrency: string;
  compareAtPrice: number | null;
  pageCount: number | null;
  isbn: string | null;
  affiliateEnabled: boolean;
  affiliateCommissionPercentage: number | null;
  downloadAllowed: boolean;
  isFeatured: boolean;
  displayRating: number;
  displaySalesCount: number;

  previewMode: PreviewMode;
  previewPageCount: number;
  previewIncludeCover: boolean;
  previewLayout: string;
  previewProgressEnabled: boolean;

  cover: File;
  bookFile: File;
  previewEpub: File | null;
};

type StorageUploadResult = {
  coverPath: string;
  coverUrl: string;
  filePath: string;
  previewPath: string | null;
  bookAssetType: BookAssetType;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Error desconocido";
}

function readTextField(formData: FormData, key: string): string {
  return formData.get(key)?.toString().trim() || "";
}

function readNullableTextField(formData: FormData, key: string): string | null {
  const value = readTextField(formData, key);
  return value || null;
}

function parseBooleanField(
  formData: FormData,
  key: string,
  fallback = false
): boolean {
  const value = formData.get(key);

  if (value === null) return fallback;

  return value === "true" || value === "on" || value === "1";
}

function parseNullableNumberField(
  formData: FormData,
  key: string
): number | null {
  const value = readTextField(formData, key);

  if (!value) return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`El campo ${key} no es válido`);
  }

  return parsed;
}

function parseRequiredPrice(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("El precio no es válido");
  }

  return parsed;
}

function parseDisplayRating(formData: FormData): number {
  const value =
    readTextField(formData, "display_rating") ||
    String(DEFAULT_BOOK_DISPLAY_RATING);
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
    throw new Error("La valoración debe estar entre 0 y 5");
  }

  return Math.round(parsed * 10) / 10;
}

function parseDisplaySalesCount(formData: FormData): number {
  const value =
    readTextField(formData, "display_sales_count") ||
    String(DEFAULT_BOOK_DISPLAY_SALES_COUNT);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999_999_999) {
    throw new Error("El contador de lectores debe ser un número entero válido");
  }

  return parsed;
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePreviewPageCount(_formData: FormData): number {
  return PREVIEW_PAGE_COUNT;
}

function parsePreviewMode(formData: FormData): PreviewMode {
  const raw = readTextField(formData, "preview_mode");

  if (
    raw === "epub_preview" ||
    raw === "manual" ||
    raw === "disabled" ||
    raw === "first_pages" || raw === "pdf_images"
  ) {
    return raw;
  }

  return "epub_preview";
}

function requireFileField(formData: FormData, key: string): File | null {
  const value = formData.get(key);

  if (!(value instanceof File)) return null;
  if (value.size <= 0) return null;

  return value;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getExtension(fileName: string): string {
  const cleanName = String(fileName ?? "").split("?")[0];
  const parts = cleanName.split(".");

  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getMimeExtension(file: File, fallback: string): string {
  const ext = getExtension(file.name);

  if (ext) return ext;

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "application/epub+zip") return "epub";

  return fallback;
}

function getBookAssetType(file: File): BookAssetType {
  const ext = getExtension(file.name);

  if (ext === "epub" || file.type === "application/epub+zip") {
    return "epub";
  }

  return "manuscript_pdf";
}

function normalizeEditionFormat(format: string) {
  const value = format.trim().toLowerCase();

  if (value === "audiobook") return "audiobook";

  if (value === "paperback" || value === "hardcover" || value === "print") {
    return "print";
  }

  if (value === "kindle_external") return "kindle_external";
  if (value === "bundle") return "bundle";

  return "ebook";
}

function getDescriptionShort(params: {
  explicitShort: string | null;
  descriptionLong: string;
}): string | null {
  const explicit = params.explicitShort?.trim();

  if (explicit) {
    return explicit.slice(0, SHORT_DESCRIPTION_LIMIT);
  }

  const description = params.descriptionLong.trim();

  if (!description) {
    return null;
  }

  return description.slice(0, SHORT_DESCRIPTION_LIMIT);
}

function isValidImageFile(file: File): boolean {
  const ext = getExtension(file.name);

  const hasValidMime = !file.type || file.type.startsWith("image/");
  const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.has(ext);

  return hasValidMime && hasValidExtension;
}

function isAllowedBookFile(file: File): boolean {
  const ext = getExtension(file.name);

  const hasValidExtension = ALLOWED_BOOK_EXTENSIONS.has(ext);
  const hasValidMime =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "application/epub+zip" ||
    file.type === "application/octet-stream";

  return hasValidExtension && hasValidMime;
}

function isEpubFile(file: File): boolean {
  const ext = getExtension(file.name);

  return (
    ext === "epub" ||
    file.type === "application/epub+zip" ||
    file.type === "application/octet-stream"
  );
}

function resolveErrorStatus(message: string): number {
  if (message === "No autorizado") return 401;

  if (
    message.includes("autor") ||
    message.includes("permiso") ||
    message.includes("publicar")
  ) {
    return 403;
  }

  const isBadRequest =
    message.includes("obligatorio") ||
    message.includes("obligatoria") ||
    message.includes("válida") ||
    message.includes("válido") ||
    message.includes("seleccionar") ||
    message.includes("mínimo") ||
    message.includes("no existe") ||
    message.includes("no es válido") ||
    message.includes("no debe superar");

  return isBadRequest ? 400 : 500;
}

function getPublicUrl(bucket: string, storagePath: string): string {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

function getMissingColumnFromError(errorMessage: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /column "([^"]+)" does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function insertWithColumnFallback<T = unknown>(params: {
  table: string;
  payload: Record<string, unknown>;
  select?: string;
  maxRetries?: number;
}): Promise<T> {
  let payload = { ...params.payload };
  const maxRetries = params.maxRetries ?? 40;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const query = supabaseAdmin.from(params.table).insert(payload);

    const { data, error } = params.select
      ? await query.select(params.select).single()
      : await query.select("*").single();

    if (!error) {
      return data as T;
    }

    const missingColumn = getMissingColumnFromError(error.message);

    if (!missingColumn || !(missingColumn in payload)) {
      throw new Error(`Error insertando en ${params.table}: ${error.message}`);
    }

    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  throw new Error(`No se pudo insertar en ${params.table}`);
}

async function getEffectiveUser(): Promise<EffectiveUser> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const devBypassUser: EffectiveUser | null =
    DEV_MODE && !user && DEV_TEST_USER_ID
      ? {
          id: DEV_TEST_USER_ID,
          email: null,
          user_metadata: null,
        }
      : null;

  const effectiveUser = (user as EffectiveUser | null) ?? devBypassUser;

  if (error && !effectiveUser) {
    throw new Error("No autorizado");
  }

  if (!effectiveUser) {
    throw new Error("No autorizado");
  }

  return effectiveUser;
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = slugify(title) || `libro-${randomUUID().slice(0, 8)}`;

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) {
      throw new Error(`Error validando slug: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function uploadFile(params: {
  bucket: string;
  storagePath: string;
  file: File;
  upsert?: boolean;
}): Promise<void> {
  const buffer = Buffer.from(await params.file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(params.bucket)
    .upload(params.storagePath, buffer, {
      contentType: params.file.type || undefined,
      upsert: params.upsert ?? false,
    });

  if (error) {
    throw new Error(
      `Error subiendo archivo a ${params.bucket}: ${error.message}`
    );
  }
}

async function rollback(state: RollbackState): Promise<void> {
  try {
    if (state.bookId) {
      await supabaseAdmin
        .from("book_preview_pages")
        .delete()
        .eq("book_id", state.bookId);

      await supabaseAdmin
        .from("book_assets")
        .delete()
        .eq("book_id", state.bookId);
    }

    if (state.editionId) {
      await supabaseAdmin
        .from("book_editions")
        .delete()
        .eq("id", state.editionId);
    }

    if (state.bookId) {
      await supabaseAdmin.from("books").delete().eq("id", state.bookId);
    }

    if (state.coverPath) {
      await supabaseAdmin.storage.from(COVER_BUCKET).remove([state.coverPath]);
    }

    if (state.filePath) {
      await supabaseAdmin.storage.from(FILE_BUCKET).remove([state.filePath]);
    }

    if (state.previewPath) {
      await supabaseAdmin.storage.from(FILE_BUCKET).remove([state.previewPath]);
    }
  } catch (rollbackError) {
    console.error("ROLLBACK ERROR:", rollbackError);
  }
}

function parseAndValidateForm(formData: FormData): UploadBookForm {
  const title = readTextField(formData, "title");
  const subtitle = readNullableTextField(formData, "subtitle");
  const publisherName = readNullableTextField(formData, "publisher_name");

  const descriptionShortInput = readNullableTextField(
    formData,
    "description_short"
  );
  const descriptionInput = readTextField(formData, "description");
  const introductionInput = readNullableTextField(formData, "introduction");
  const chapterOneInput = readNullableTextField(
    formData,
    "chapter_one_excerpt"
  );
  const sampleUrlInput = readNullableTextField(formData, "sample_url");

  const primaryNiche = readTextField(formData, "primary_niche");
  const primaryCategory = readTextField(formData, "primary_category");
  const secondaryCategory = readNullableTextField(
    formData,
    "secondary_category"
  );
  const keywords = parseKeywords(readTextField(formData, "keywords"));

  const targetAudience = readNullableTextField(formData, "target_audience");
  const readerPromise = readNullableTextField(formData, "reader_promise");
  const salesHook = readNullableTextField(formData, "sales_hook");
  const comparableBooks = readNullableTextField(formData, "comparable_books");

  const metaTitle = readNullableTextField(formData, "meta_title");
  const metaDescription = readNullableTextField(formData, "meta_description");
  const marketingAngle = readNullableTextField(formData, "marketing_angle");

  const languageCode = readTextField(formData, "language_code") || "es";
  const format = readTextField(formData, "format") || "ebook";

  const rawStatus = readTextField(formData, "status") || "under_review";
  const status = ALLOWED_CREATE_STATUSES.has(rawStatus)
    ? (rawStatus as CreateBookStatus)
    : "under_review";

  const price = parseRequiredPrice(readTextField(formData, "price"));
  const currency = readTextField(formData, "currency") || "DOP";
  const paypalPrice = parseNullableNumberField(formData, "paypal_price");
  const paypalCurrency = (
    readTextField(formData, "paypal_currency") || "USD"
  ).toUpperCase();
  const compareAtPrice = parseNullableNumberField(formData, "compare_at_price");
  const pageCount = parseNullableNumberField(formData, "page_count");
  const isbn = readNullableTextField(formData, "isbn");

  const affiliateEnabled = parseBooleanField(formData, "affiliate_enabled");
  const affiliateCommissionPercentage = parseNullableNumberField(
    formData,
    "affiliate_commission_percentage"
  );
  const downloadAllowed = parseBooleanField(formData, "download_allowed");
  const isFeatured = parseBooleanField(formData, "is_featured");
  const displayRating = parseDisplayRating(formData);
  const displaySalesCount = parseDisplaySalesCount(formData);

  const previewMode = parsePreviewMode(formData);
  const previewPageCount = parsePreviewPageCount(formData);
  const previewIncludeCover = parseBooleanField(
    formData,
    "preview_include_cover",
    true
  );
  const previewLayout =
    readTextField(formData, "preview_layout") || "epub_reader";
  const previewProgressEnabled = parseBooleanField(
    formData,
    "preview_progress_enabled",
    true
  );

  const cover = requireFileField(formData, "cover");
  const bookFile =
    requireFileField(formData, "epub_file") ||
    requireFileField(formData, "book_file");
  const previewEpub = requireFileField(formData, "preview_epub");
  if (!title) throw new Error("El título es obligatorio");

  if (paypalPrice !== null && paypalPrice <= 0) {
    throw new Error("El precio PayPal debe ser mayor que cero");
  }

  if (paypalCurrency !== "USD") {
    throw new Error("La moneda PayPal debe ser USD");
  }

  if (!descriptionInput) {
    throw new Error("La descripción comercial es obligatoria");
  }

  if (!primaryNiche || !primaryCategory) {
    throw new Error("Debes seleccionar nicho y categoría principal");
  }

  if (keywords.length < 3) {
    throw new Error("Debes agregar mínimo 3 palabras clave");
  }

  if (!cover) throw new Error("La portada es obligatoria");
  if (!bookFile) throw new Error("El EPUB completo es obligatorio");
  if (!previewEpub) throw new Error("El EPUB de muestra es obligatorio");

  if (cover.size > MAX_COVER_SIZE_BYTES) {
    throw new Error(`La portada no debe superar ${MAX_COVER_SIZE_MB} MB`);
  }

  if (bookFile.size > MAX_BOOK_SIZE_BYTES) {
    throw new Error(
      `El EPUB completo no debe superar ${MAX_BOOK_SIZE_MB} MB`
    );
  }

  if (previewEpub.size > MAX_PREVIEW_SIZE_BYTES) {
    throw new Error(
      `El EPUB de muestra no debe superar ${MAX_PREVIEW_SIZE_MB} MB`
    );
  }

  if (!isValidImageFile(cover)) {
    throw new Error("La portada debe ser JPG, PNG o WebP");
  }

  if (!isAllowedBookFile(bookFile) || !isEpubFile(bookFile)) {
    throw new Error("El archivo completo del libro debe ser EPUB");
  }

  if (!isAllowedBookFile(previewEpub) || !isEpubFile(previewEpub)) {
    throw new Error("El archivo de muestra debe ser EPUB");
  }
  if (
    affiliateCommissionPercentage !== null &&
    affiliateCommissionPercentage > 100
  ) {
    throw new Error("La comisión de afiliado no puede superar 100%");
  }

  return {
    title,
    subtitle,
    publisherName,

    descriptionShortInput,
    descriptionInput,
    introductionInput,
    chapterOneInput,
    sampleUrlInput,

    primaryNiche,
    primaryCategory,
    secondaryCategory,
    keywords,

    targetAudience,
    readerPromise,
    salesHook,
    comparableBooks,

    metaTitle,
    metaDescription,
    marketingAngle,

    languageCode,
    format,
    status,

    price,
    currency,
    paypalPrice,
    paypalCurrency,
    compareAtPrice,
    pageCount,
    isbn,
    affiliateEnabled,
    affiliateCommissionPercentage,
    downloadAllowed,
    isFeatured,
    displayRating,
    displaySalesCount,

    previewMode,
    previewPageCount,
    previewIncludeCover,
    previewLayout,
    previewProgressEnabled,

    cover,
    bookFile,
    previewEpub,
  };
}

async function uploadBookStorage(params: {
  slug: string;
  form: UploadBookForm;
}): Promise<StorageUploadResult> {
  const bookAssetType = getBookAssetType(params.form.bookFile);

  const coverExt = getMimeExtension(params.form.cover, "jpg");
  const bookExt = getMimeExtension(params.form.bookFile, bookAssetType);

  const coverPath = `covers/${params.slug}-${randomUUID()}.${coverExt}`;
  const filePath = `books/${params.slug}-${randomUUID()}.${bookExt}`;

  let previewPath: string | null = null;

  await Promise.all([
    uploadFile({
      bucket: COVER_BUCKET,
      storagePath: coverPath,
      file: params.form.cover,
    }),
    uploadFile({
      bucket: FILE_BUCKET,
      storagePath: filePath,
      file: params.form.bookFile,
    }),
  ]);

  if (params.form.previewEpub) {
    const previewExt = getMimeExtension(params.form.previewEpub, "epub");
    previewPath = `previews/${params.slug}-${randomUUID()}.${previewExt}`;

    await uploadFile({
      bucket: FILE_BUCKET,
      storagePath: previewPath,
      file: params.form.previewEpub,
    });
  }

  return {
    coverPath,
    coverUrl: getPublicUrl(COVER_BUCKET, coverPath),
    filePath,
    previewPath,
    bookAssetType,
  };
}

function getPreviewStatus(params: {
  previewMode: PreviewMode;
  bookAssetType: BookAssetType;
  hasPreviewEpub: boolean;
}): {
  status: PreviewStatus;
  error: string | null;
} {
  if (params.previewMode === "disabled") {
    return {
      status: "disabled",
      error: "La muestra visual está desactivada para este libro.",
    };
  }

  if (params.previewMode === "epub_preview") {
    if (params.hasPreviewEpub) {
      return {
        status: "ready",
        error: null,
      };
    }

    return {
      status: "unsupported",
      error: "Este libro no tiene EPUB de muestra.",
    };
  }

  if (params.bookAssetType === "epub") {
    return {
      status: params.hasPreviewEpub ? "ready" : "unsupported",
      error: params.hasPreviewEpub
        ? null
        : "El EPUB fue guardado, pero falta el EPUB de muestra.",
    };
  }

  return {
    status: "pending",
    error: null,
  };
}

async function createBookRecord(params: {
  ownerUserId: string;
  authorId: string;
  form: UploadBookForm;
  slug: string;
  coverUrl: string;
  bookAssetType: BookAssetType;
  hasPreviewEpub: boolean;
}) {
  const now = new Date().toISOString();

  const preview = getPreviewStatus({
    previewMode: params.form.previewMode,
    bookAssetType: params.bookAssetType,
    hasPreviewEpub: params.hasPreviewEpub,
  });

  const payload: Record<string, unknown> = {
    owner_user_id: params.ownerUserId,
    author_id: params.authorId,

    title: params.form.title,
    subtitle: params.form.subtitle,
    publisher_name: params.form.publisherName,
    slug: params.slug,
    cover_url: params.coverUrl,
    status: params.form.status,
    featured: params.form.isFeatured,

    description_short: getDescriptionShort({
      explicitShort: params.form.descriptionShortInput,
      descriptionLong: params.form.descriptionInput,
    }),
    description_long: params.form.descriptionInput,
    introduction: params.form.introductionInput,
    chapter_one_excerpt: params.form.chapterOneInput,
    sample_url: params.form.sampleUrlInput,

    primary_niche: params.form.primaryNiche,
    primary_category: params.form.primaryCategory,
    secondary_category: params.form.secondaryCategory,
    keywords: params.form.keywords,

    target_audience: params.form.targetAudience,
    reader_promise: params.form.readerPromise,
    sales_hook: params.form.salesHook,
    comparable_books: params.form.comparableBooks,

    meta_title: params.form.metaTitle,
    meta_description: params.form.metaDescription,
    marketing_angle: params.form.marketingAngle,
    language_code: params.form.languageCode,

    preview_mode: params.form.previewMode,
    preview_page_count: params.form.previewPageCount,
    preview_include_cover: params.form.previewIncludeCover,
    preview_layout: params.form.previewLayout,
    preview_progress_enabled: params.form.previewProgressEnabled,
    preview_status: preview.status,
    preview_error: preview.error,
    preview_generated_at: preview.status === "ready" ? now : null,

    metadata: mergeBookSocialProofMetadata(null, {
      rating: params.form.displayRating,
      salesCount: params.form.displaySalesCount,
    }),

    created_at: now,
    updated_at: now,
  };

  return insertWithColumnFallback({
    table: "books",
    payload,
    select: "*",
  });
}

async function createEditionRecord(params: {
  bookId: RecordId;
  form: UploadBookForm;
}) {
  const payload: Record<string, unknown> = {
    book_id: params.bookId,
    format: normalizeEditionFormat(params.form.format),
    edition_name: "Edición digital",
    price: params.form.price,
    currency: params.form.currency,
    paypal_price: params.form.paypalPrice,
    paypal_currency: params.form.paypalCurrency,
    compare_at_price: params.form.compareAtPrice,
    page_count: params.form.pageCount,
    isbn: params.form.isbn,
    affiliate_enabled: params.form.affiliateEnabled,
    affiliate_commission_percentage:
      params.form.affiliateCommissionPercentage,
    download_allowed: params.form.downloadAllowed,
    file_url: null,
    is_active: true,
    sort_order: 0,
  };

  return insertWithColumnFallback<{ id: RecordId }>({
    table: "book_editions",
    payload,
    select: "*",
  });
}

async function createAssetRecords(params: {
  bookId: RecordId;
  editionId: RecordId;
  coverPath: string;
  filePath: string;
  previewPath: string | null;
  coverUrl: string;
  coverMimeType: string | null;
  fileMimeType: string | null;
  previewMimeType: string | null;
  bookAssetType: BookAssetType;
}) {
  const assets: Record<string, unknown>[] = [
    {
      book_id: params.bookId,
      edition_id: null,
      asset_type: "cover",
      storage_bucket: COVER_BUCKET,
      storage_path: params.coverPath,
      file_url: params.coverUrl,
      mime_type: params.coverMimeType,
      is_public: true,
      sort_order: 0,
    },
    {
      book_id: params.bookId,
      edition_id: params.editionId,
      asset_type: params.bookAssetType,
      storage_bucket: FILE_BUCKET,
      storage_path: params.filePath,
      file_url: null,
      mime_type: params.fileMimeType,
      is_public: false,
      sort_order: 1,
    },
  ];

  if (params.previewPath) {
    assets.push({
      book_id: params.bookId,
      edition_id: null,
      asset_type: "epub_preview",
      storage_bucket: FILE_BUCKET,
      storage_path: params.previewPath,
      file_url: null,
      mime_type: params.previewMimeType || "application/epub+zip",
      is_public: false,
      sort_order: 2,
    });
  }

  const { error } = await supabaseAdmin.from("book_assets").insert(assets);

  if (error) {
    throw new Error(`Error guardando assets: ${error.message}`);
  }
}

function buildPreviewCommand(params: {
  slug: string;
  form: UploadBookForm;
  bookAssetType: BookAssetType;
}): string | null {
  if (params.form.previewMode === "disabled") {
    return null;
  }

  if (params.form.previewMode === "epub_preview") {
    return null;
  }

  if (
    params.bookAssetType !== "pdf" &&
    params.bookAssetType !== "manuscript_pdf"
  ) {
    return null;
  }

  return `npm run preview:book -- --slug ${params.slug} --pages ${PREVIEW_PAGE_COUNT} --scale 5200`;
}

export async function POST(request: Request) {
  const rollbackState: RollbackState = {
    bookId: null,
    editionId: null,
    coverPath: null,
    filePath: null,
    previewPath: null,
  };

  try {
    const effectiveUser = await getEffectiveUser();

    const authorAccess = await getAuthorPublishingAccess(effectiveUser.id);

    if (!authorAccess.allowed || !authorAccess.authorId) {
      return jsonError(
        authorAccess.message || "No tienes permiso para publicar libros.",
        403
      );
    }

    const formData = await request.formData();
    const form = parseAndValidateForm(formData);

    const slug = await generateUniqueSlug(form.title);

    const storage = await uploadBookStorage({
      slug,
      form,
    });

    rollbackState.coverPath = storage.coverPath;
    rollbackState.filePath = storage.filePath;
    rollbackState.previewPath = storage.previewPath;

    const insertedBook = await createBookRecord({
      ownerUserId: effectiveUser.id,
      authorId: authorAccess.authorId,
      form,
      slug,
      coverUrl: storage.coverUrl,
      bookAssetType: storage.bookAssetType,
      hasPreviewEpub: Boolean(storage.previewPath),
    });

    const insertedBookId = (insertedBook as { id: RecordId }).id;
    rollbackState.bookId = insertedBookId;

    const insertedEdition = await createEditionRecord({
      bookId: insertedBookId,
      form,
    });

    rollbackState.editionId = insertedEdition.id;

    await createAssetRecords({
      bookId: insertedBookId,
      editionId: insertedEdition.id,
      coverPath: storage.coverPath,
      filePath: storage.filePath,
      previewPath: storage.previewPath,
      coverUrl: storage.coverUrl,
      coverMimeType: form.cover.type || null,
      fileMimeType: form.bookFile.type || null,
      previewMimeType: form.previewEpub?.type || "application/epub+zip",
      bookAssetType: storage.bookAssetType,
    });

    const previewCommand = buildPreviewCommand({
      slug,
      form,
      bookAssetType: storage.bookAssetType,
    });

    const previewStatus = getPreviewStatus({
      previewMode: form.previewMode,
      bookAssetType: storage.bookAssetType,
      hasPreviewEpub: Boolean(storage.previewPath),
    });

    return Response.json(
      {
        message:
          form.status === "draft"
            ? "Libro guardado como borrador."
            : "Libro enviado a evaluación correctamente.",
        book: insertedBook,
        edition: insertedEdition,
        storage: {
          cover_bucket: COVER_BUCKET,
          cover_path: storage.coverPath,
          cover_url: storage.coverUrl,
          file_bucket: FILE_BUCKET,
          file_path: storage.filePath,
          preview_path: storage.previewPath,
          file_is_public: false,
          book_asset_type: storage.bookAssetType,
        },
        preview: {
          status: previewStatus.status,
          error: previewStatus.error,
          mode: form.previewMode,
          page_count: form.previewPageCount,
          include_cover: form.previewIncludeCover,
          layout: form.previewLayout,
          progress_enabled: form.previewProgressEnabled,
          command: previewCommand,
        },
        view_url: `/dashboard/books/${insertedBookId}/edit`,
        catalog_url: `/catalog/${slug}`,
        dev_mode: DEV_MODE,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/books error:", error);

    await rollback(rollbackState);

    const message = getErrorMessage(error);

    return jsonError(message, resolveErrorStatus(message));
  }
}


