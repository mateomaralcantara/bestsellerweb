import { createClient } from "@/lib/supabase/client";
import { slugify } from "../utils/slugify";

const supabase = createClient();

const BUCKETS = {
  covers: "book-covers",
  files: "book-files",
  previews: "book-previews",
} as const;

export type BookPreviewKind = "cover" | "pdf_page";
export type BookPreviewStatus = "pending" | "generating" | "ready" | "error";

export type BookPreviewPage = {
  id: string;
  book_id: string;
  page_index: number;
  source_page_number: number | null;
  kind: BookPreviewKind;
  image_path: string;
  "width": number | null;
  "height": number | null;
};

type InsertBookPreviewPageParams = {
  bookId: string;
  pageIndex: number;
  sourcePageNumber: number | null;
  kind: BookPreviewKind;
  imagePath: string;
  width?: number;
  height?: number;
};

type UploadPreviewImageParams = {
  userId: string;
  bookId: string;
  pageIndex: number;
  blob: Blob;
};

type CreateAuthorProfileParams = {
  userId: string;
  name: string;
  bio?: string;
};

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

  return "Error desconocido.";
}

function throwWithContext(context: string, error: unknown): never {
  throw new Error(`${context}: ${getErrorMessage(error)}`);
}

function assertRequired(value: string, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }
}

function getFileExtension(file: File, fallback = "bin") {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && fromName !== file.name.toLowerCase()) {
    return fromName;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "application/epub+zip") return "epub";

  return fallback;
}

function buildBookBasePath(userId: string, bookId: string) {
  assertRequired(userId, "userId");
  assertRequired(bookId, "bookId");

  return `${userId}/${bookId}`;
}

export async function uploadBookCover(
  userId: string,
  bookId: string,
  file: File
) {
  const ext = getFileExtension(file, "jpg");
  const path = `${buildBookBasePath(userId, bookId)}/cover.${ext}`;

  const { error } = await supabase.storage.from(BUCKETS.covers).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) throwWithContext("No se pudo subir la portada", error);

  return path;
}

export async function uploadBookFile(
  userId: string,
  bookId: string,
  file: File
) {
  const ext = getFileExtension(file, "pdf");
  const path = `${buildBookBasePath(userId, bookId)}/book.${ext}`;

  const { error } = await supabase.storage.from(BUCKETS.files).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });

  if (error) throwWithContext("No se pudo subir el archivo del libro", error);

  return path;
}

export async function uploadPreviewImage({
  userId,
  bookId,
  pageIndex,
  blob,
}: UploadPreviewImageParams) {
  const path = `${buildBookBasePath(userId, bookId)}/preview/page-${String(
    pageIndex
  ).padStart(3, "0")}.webp`;

  const { error } = await supabase.storage
    .from(BUCKETS.previews)
    .upload(path, blob, {
      upsert: true,
      contentType: "image/webp",
    });

  if (error) throwWithContext("No se pudo subir la imagen de muestra", error);

  return path;
}

export async function clearBookPreviewPages(bookId: string) {
  assertRequired(bookId, "bookId");

  const { error } = await supabase
    .from("book_preview_pages")
    .delete()
    .eq("book_id", bookId);

  if (error) throwWithContext("No se pudieron limpiar las páginas de muestra", error);
}

export async function insertBookPreviewPage(params: InsertBookPreviewPageParams) {
  assertRequired(params.bookId, "bookId");
  assertRequired(params.imagePath, "imagePath");

  const { error } = await supabase.from("book_preview_pages").upsert(
    {
      book_id: params.bookId,
      page_index: params.pageIndex,
      source_page_number: params.sourcePageNumber,
      kind: params.kind,
      image_path: params.imagePath,
      ["width"]: params.width ?? null,
      ["height"]: params.height ?? null,
    },
    {
      onConflict: "book_id,page_index",
    }
  );

  if (error) throwWithContext("No se pudo insertar página de muestra", error);
}

export async function updateBookPreviewStatus(
  bookId: string,
  status: BookPreviewStatus,
  errorMessage?: string
) {
  assertRequired(bookId, "bookId");

  const patch: Record<string, string | null> = {
    preview_status: status,
    preview_error: status === "error" ? errorMessage ?? "Error generando muestra." : null,
  };

  if (status === "ready") {
    patch.preview_generated_at = new Date().toISOString();
  }

  const { error } = await supabase.from("books").update(patch).eq("id", bookId);

  if (error) throwWithContext("No se pudo actualizar el estado de la muestra", error);
}

export async function getBookPreviewPages(bookId: string) {
  assertRequired(bookId, "bookId");

  const { data, error } = await supabase
    .from("book_preview_pages")
    .select("*")
    .eq("book_id", bookId)
    .order("page_index", { ascending: true });

  if (error) throwWithContext("No se pudieron cargar las páginas de muestra", error);

  return (data ?? []) as BookPreviewPage[];
}

export function getPublicPreviewUrl(path: string) {
  assertRequired(path, "path");

  const { data } = supabase.storage.from(BUCKETS.previews).getPublicUrl(path);

  return data.publicUrl;
}

export function getPublicCoverUrl(path: string) {
  assertRequired(path, "path");

  const { data } = supabase.storage.from(BUCKETS.covers).getPublicUrl(path);

  return data.publicUrl;
}

export async function createAuthorProfileIfMissing({
  userId,
  name,
  bio,
}: CreateAuthorProfileParams) {
  assertRequired(userId, "userId");
  assertRequired(name, "name");

  const authorSlug = slugify(name) || "autor";

  const { data: existing, error: existingError } = await supabase
    .from("author_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", authorSlug)
    .maybeSingle();

  if (existingError) {
    throwWithContext("No se pudo verificar el perfil de autor", existingError);
  }

  if (existing) return existing;

  const { data, error } = await supabase
    .from("author_profiles")
    .insert({
      user_id: userId,
      name,
      slug: authorSlug,
      bio: bio ?? null,
    })
    .select("*")
    .single();

  if (error) throwWithContext("No se pudo crear el perfil de autor", error);

  return data;
}