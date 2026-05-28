import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COVER_BUCKET = "book-covers";
const FILE_BUCKET = "book-files";

const SHORT_DESCRIPTION_LIMIT = 180;
const DEFAULT_PREVIEW_PAGE_COUNT = 16;
const MAX_PREVIEW_PAGE_COUNT = 50;

const ALLOWED_BOOK_EXTENSIONS = new Set(["pdf", "epub"]);
const ALLOWED_CREATE_STATUSES = new Set([
  "draft",
  "under_review",
  "approved",
  "published",
]);

const DEV_MODE = process.env.NODE_ENV !== "production";
const DEV_TEST_USER_ID = process.env.DEV_TEST_USER_ID?.trim() || "";

type BookAssetType = "pdf" | "epub";
type CreateBookStatus = "draft" | "under_review" | "approved" | "published";
type PreviewMode = "first_pages" | "manual" | "disabled";
type RecordId = string | number;

type EffectiveUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
  } | null;
};

type AuthorProfileRow = {
  id: string;
  user_id: string | null;
  slug: string | null;
  pen_name: string | null;
  display_name: string | null;
  email: string | null;
};

type RollbackState = {
  bookId: RecordId | null;
  editionId: RecordId | null;
  coverPath: string | null;
  filePath: string | null;
};

type UploadBookForm = {
  title: string;
  subtitle: string | null;
  publisherName: string | null;

  descriptionShortInput: string | null;
  descriptionInput: string;
  introductionInput: string;
  chapterOneInput: string;
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
  compareAtPrice: number | null;
  pageCount: number | null;
  isbn: string | null;
  affiliateEnabled: boolean;
  affiliateCommissionPercentage: number | null;
  downloadAllowed: boolean;
  isFeatured: boolean;

  previewMode: PreviewMode;
  previewPageCount: number;
  previewIncludeCover: boolean;
  previewLayout: string;
  previewProgressEnabled: boolean;

  cover: File;
  bookFile: File;
};

type StorageUploadResult = {
  coverPath: string;
  coverUrl: string;
  filePath: string;
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

function parsePositivePrice(value: string): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
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

function parsePreviewPageCount(formData: FormData): number {
  const raw = readTextField(formData, "preview_page_count");
  const parsed = raw ? Number(raw) : DEFAULT_PREVIEW_PAGE_COUNT;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PREVIEW_PAGE_COUNT;
  }

  return Math.min(Math.floor(parsed), MAX_PREVIEW_PAGE_COUNT);
}

function parsePreviewMode(formData: FormData): PreviewMode {
  const raw = readTextField(formData, "preview_mode");

  if (raw === "manual" || raw === "disabled") {
    return raw;
  }

  return "first_pages";
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

function getBookAssetType(fileName: string): BookAssetType {
  return getExtension(fileName) === "epub" ? "epub" : "pdf";
}

function normalizeEditionFormat(format: string) {
  const value = format.trim().toLowerCase();

  if (value === "audiobook") return "audiobook";
  if (value === "paperback" || value === "hardcover" || value === "print") {
    return "print";
  }

  if (value === "kindle_external") return "kindle_external";

  return "ebook";
}

function getDescriptionShort(params: {
  explicitShort: string | null;
  descriptionLong: string | null;
}): string | null {
  const explicit = params.explicitShort?.trim();

  if (explicit) {
    return explicit.slice(0, SHORT_DESCRIPTION_LIMIT);
  }

  const description = params.descriptionLong?.trim();

  if (!description) {
    return null;
  }

  return description.slice(0, SHORT_DESCRIPTION_LIMIT);
}

function isValidImageFile(file: File): boolean {
  return !file.type || file.type.startsWith("image/");
}

function isAllowedBookExtension(fileName: string): boolean {
  return ALLOWED_BOOK_EXTENSIONS.has(getExtension(fileName));
}

function resolveErrorStatus(message: string): number {
  if (message === "No autorizado") return 401;

  const isBadRequest =
    message.includes("obligatorio") ||
    message.includes("obligatoria") ||
    message.includes("válida") ||
    message.includes("válido") ||
    message.includes("seleccionar") ||
    message.includes("mínimo") ||
    message.includes("no existe") ||
    message.includes("no es válido");

  return isBadRequest ? 400 : 500;
}

function getUserDisplayName(user: EffectiveUser) {
  return (
    user.user_metadata?.full_name?.trim() ||
    user.user_metadata?.name?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Autor"
  );
}

function getSafeEmail(user: EffectiveUser) {
  return user.email?.trim() || `${user.id}@no-email.local`;
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
  const maxRetries = params.maxRetries ?? 12;

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

async function updateWithColumnFallback(params: {
  table: string;
  patch: Record<string, unknown>;
  matchColumn: string;
  matchValue: string;
  maxRetries?: number;
}): Promise<void> {
  let patch = { ...params.patch };
  const maxRetries = params.maxRetries ?? 8;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { error } = await supabaseAdmin
      .from(params.table)
      .update(patch)
      .eq(params.matchColumn, params.matchValue);

    if (!error) {
      return;
    }

    const missingColumn = getMissingColumnFromError(error.message);

    if (!missingColumn || !(missingColumn in patch)) {
      throw new Error(`Error actualizando ${params.table}: ${error.message}`);
    }

    const nextPatch = { ...patch };
    delete nextPatch[missingColumn];
    patch = nextPatch;

    if (Object.keys(patch).length === 0) {
      return;
    }
  }

  throw new Error(`No se pudo actualizar ${params.table}`);
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

async function generateUniqueAuthorSlug(
  displayName: string,
  excludeAuthorId?: string
) {
  const baseSlug = slugify(displayName) || `autor-${randomUUID().slice(0, 8)}`;

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let query = supabaseAdmin
      .from("author_profiles")
      .select("id")
      .eq("slug", slug);

    if (excludeAuthorId) {
      query = query.neq("id", excludeAuthorId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      throw new Error(`Error validando slug de autor: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function findExistingAuthorProfile(userId: string) {
  const byId = await supabaseAdmin
    .from("author_profiles")
    .select("id, user_id, slug, pen_name, display_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (byId.error) {
    throw new Error(`Error buscando perfil de autor: ${byId.error.message}`);
  }

  if (byId.data) {
    return byId.data as AuthorProfileRow;
  }

  const byUserId = await supabaseAdmin
    .from("author_profiles")
    .select("id, user_id, slug, pen_name, display_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId.error) {
    throw new Error(`Error buscando perfil de autor: ${byUserId.error.message}`);
  }

  return (byUserId.data as AuthorProfileRow | null) ?? null;
}

async function repairExistingAuthorProfile(params: {
  author: AuthorProfileRow;
  user: EffectiveUser;
  displayName: string;
  safeEmail: string;
}) {
  const { author, user, displayName, safeEmail } = params;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (!author.user_id) updates.user_id = user.id;
  if (!author.display_name) updates.display_name = displayName;
  if (!author.pen_name) updates.pen_name = displayName;
  if (!author.email) updates.email = safeEmail;

  if (!author.slug) {
    updates.slug = await generateUniqueAuthorSlug(displayName, author.id);
  }

  if (Object.keys(updates).length === 1 && "updated_at" in updates) {
    return;
  }

  await updateWithColumnFallback({
    table: "author_profiles",
    patch: updates,
    matchColumn: "id",
    matchValue: author.id,
  });
}

async function getOrCreateAuthorProfile(user: EffectiveUser): Promise<string> {
  const displayName = getUserDisplayName(user);
  const safeEmail = getSafeEmail(user);

  const existingAuthor = await findExistingAuthorProfile(user.id);

  if (existingAuthor?.id) {
    await repairExistingAuthorProfile({
      author: existingAuthor,
      user,
      displayName,
      safeEmail,
    });

    return existingAuthor.id;
  }

  const authorSlug = await generateUniqueAuthorSlug(displayName, user.id);
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    id: user.id,
    user_id: user.id,
    display_name: displayName,
    pen_name: displayName,
    slug: authorSlug,
    email: safeEmail,
    created_at: now,
    updated_at: now,
  };

  try {
    const insertedAuthor = await insertWithColumnFallback<{ id: string }>({
      table: "author_profiles",
      payload,
      select: "id",
    });

    return insertedAuthor.id;
  } catch (error) {
    const message = getErrorMessage(error);
    const isDuplicate =
      message.includes("23505") || message.toLowerCase().includes("duplicate");

    if (isDuplicate) {
      const recoveredAuthor = await findExistingAuthorProfile(user.id);

      if (recoveredAuthor?.id) {
        return recoveredAuthor.id;
      }
    }

    throw error;
  }
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
  const introductionInput = readTextField(formData, "introduction");
  const chapterOneInput = readTextField(formData, "chapter_one_excerpt");
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

  const price = parsePositivePrice(readTextField(formData, "price"));
  const currency = readTextField(formData, "currency") || "DOP";
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

  const previewMode = parsePreviewMode(formData);
  const previewPageCount = parsePreviewPageCount(formData);
  const previewIncludeCover = parseBooleanField(
    formData,
    "preview_include_cover",
    true
  );
  const previewLayout =
    readTextField(formData, "preview_layout") || "two_page_horizontal";
  const previewProgressEnabled = parseBooleanField(
    formData,
    "preview_progress_enabled",
    true
  );

  const cover = requireFileField(formData, "cover");
  const bookFile = requireFileField(formData, "book_file");

  if (!title) throw new Error("El título es obligatorio");

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
  if (!bookFile) throw new Error("El archivo del libro es obligatorio");

  if (!isValidImageFile(cover)) {
    throw new Error("La portada debe ser una imagen válida");
  }

  if (!isAllowedBookExtension(bookFile.name)) {
    throw new Error("El archivo del libro debe ser PDF o EPUB");
  }

  if (price === null) {
    throw new Error("El precio no es válido");
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
    compareAtPrice,
    pageCount,
    isbn,
    affiliateEnabled,
    affiliateCommissionPercentage,
    downloadAllowed,
    isFeatured,

    previewMode,
    previewPageCount,
    previewIncludeCover,
    previewLayout,
    previewProgressEnabled,

    cover,
    bookFile,
  };
}

async function uploadBookStorage(params: {
  slug: string;
  form: UploadBookForm;
}): Promise<StorageUploadResult> {
  const coverExt = getMimeExtension(params.form.cover, "jpg");
  const bookExt = getMimeExtension(params.form.bookFile, "pdf");
  const bookAssetType = getBookAssetType(params.form.bookFile.name);

  const coverPath = `covers/${params.slug}-${randomUUID()}.${coverExt}`;
  const filePath = `books/${params.slug}-${randomUUID()}.${bookExt}`;

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

  return {
    coverPath,
    coverUrl: getPublicUrl(COVER_BUCKET, coverPath),
    filePath,
    bookAssetType,
  };
}

async function createBookRecord(params: {
  ownerUserId: string;
  authorId: string;
  form: UploadBookForm;
  slug: string;
  coverUrl: string;
}) {
  const now = new Date().toISOString();
  const previewDisabled = params.form.previewMode === "disabled";

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
    introduction: params.form.introductionInput || null,
    chapter_one_excerpt: params.form.chapterOneInput || null,
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
    preview_status: previewDisabled ? "disabled" : "pending",
    preview_error: previewDisabled
      ? "La muestra visual está desactivada para este libro."
      : null,
    preview_generated_at: null,

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
  coverUrl: string;
  coverMimeType: string | null;
  fileMimeType: string | null;
  bookAssetType: BookAssetType;
}) {
  const { error } = await supabaseAdmin.from("book_assets").insert([
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
  ]);

  if (error) {
    throw new Error(`Error guardando assets: ${error.message}`);
  }
}

function buildPreviewCommand(params: {
  slug: string;
  form: UploadBookForm;
}): string | null {
  if (params.form.previewMode === "disabled") {
    return null;
  }

  return `npm run preview:book -- --slug ${params.slug} --pages ${Math.min(
    params.form.previewPageCount || DEFAULT_PREVIEW_PAGE_COUNT,
    MAX_PREVIEW_PAGE_COUNT
  )} --scale 5200`;
}

export async function POST(request: Request) {
  const rollbackState: RollbackState = {
    bookId: null,
    editionId: null,
    coverPath: null,
    filePath: null,
  };

  try {
    const effectiveUser = await getEffectiveUser();

const authorAccess = await getAuthorPublishingAccess(effectiveUser.id);

if (!authorAccess.allowed || !authorAccess.authorId) {
  return jsonError(authorAccess.message, 403);
}

const authorId = authorAccess.authorId;

    const formData = await request.formData();
    const form = parseAndValidateForm(formData);

    const slug = await generateUniqueSlug(form.title);

    const storage = await uploadBookStorage({
      slug,
      form,
    });

    rollbackState.coverPath = storage.coverPath;
    rollbackState.filePath = storage.filePath;

    const insertedBook = await createBookRecord({
      ownerUserId: effectiveUser.id,
      authorId,
      form,
      slug,
      coverUrl: storage.coverUrl,
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
      coverUrl: storage.coverUrl,
      coverMimeType: form.cover.type || null,
      fileMimeType: form.bookFile.type || null,
      bookAssetType: storage.bookAssetType,
    });

    const previewCommand = buildPreviewCommand({
      slug,
      form,
    });

    return Response.json(
      {
        message:
          form.status === "draft"
            ? "Libro guardado como borrador"
            : "Libro guardado correctamente",
        book: insertedBook,
        edition: insertedEdition,
        storage: {
          cover_bucket: COVER_BUCKET,
          cover_path: storage.coverPath,
          cover_url: storage.coverUrl,
          file_bucket: FILE_BUCKET,
          file_path: storage.filePath,
          file_is_public: false,
        },
        preview: {
          status: form.previewMode === "disabled" ? "disabled" : "pending",
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