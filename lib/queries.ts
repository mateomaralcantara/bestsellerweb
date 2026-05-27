import { cache } from "react";
import { Book, BookStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

const BOOK_SELECT = `
  id,
  author_id,
  title,
  subtitle,
  slug,
  description_short,
  description_long,
  introduction,
  chapter_one_excerpt,
  sample_url,
  cover_url,
  status,
  featured,
  language_code,
  isbn_13,
  page_count,
  publication_date,
  created_at,
  updated_at
`;

type BookRow = {
  id: string;
  author_id: string | null;
  title: string;
  subtitle?: string | null;
  slug: string;
  description_short?: string | null;
  description_long?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: string | null;
  featured?: boolean | null;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeStatus(value: unknown): BookStatus | null {
  const normalized = normalizeText(value);

  if (
    normalized === "draft" ||
    normalized === "published" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return null;
}

function normalizeBook(row: BookRow): Book {
  const longDescription = normalizeText(row.description_long);

  const shortDescription =
    normalizeText(row.description_short) ||
    longDescription ||
    "Sin resumen disponible.";

  return {
    id: row.id,
    author_id: row.author_id ?? "",
    slug: row.slug,
    title: row.title,
    subtitle: normalizeText(row.subtitle),

    short_description: shortDescription,
    long_description: longDescription,
    introduction: normalizeText(row.introduction),
    chapter_one_excerpt: normalizeText(row.chapter_one_excerpt),
    sample_url: normalizeText(row.sample_url),

    cover_url: normalizeText(row.cover_url),
    status: normalizeStatus(row.status),
    is_featured: Boolean(row.featured),

    language: normalizeText(row.language_code),
    isbn: normalizeText(row.isbn_13),
    page_count: typeof row.page_count === "number" ? row.page_count : null,
    publication_date: row.publication_date ?? null,

    price: null,
    compare_at_price: null,
    currency: null,
    rating: null,
    review_count: 0,
    formats: [],
    categories: [],
    badge: null,
    kindle_url: null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,

    author: null,
  };
}

export const getBooks = cache(async (): Promise<Book[]> => {
  const supabase = await createClient();

  if (!supabase) {
    console.error("GETBOOKS: Supabase client no disponible");
    return [];
  }

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GETBOOKS ERROR:", error.message);
    return [];
  }

  return ((data ?? []) as BookRow[]).map(normalizeBook);
});

export const getFeaturedBooks = cache(async (): Promise<Book[]> => {
  const books = await getBooks();
  return books.filter((book) => book.is_featured).slice(0, 3);
});

export const getBookBySlug = cache(async (slug: string): Promise<Book | null> => {
  const supabase = await createClient();

  if (!supabase) {
    console.error("GETBOOKBYSLUG: Supabase client no disponible");
    return null;
  }

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("GETBOOKBYSLUG ERROR:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return normalizeBook(data as BookRow);
});

export const getBookCategories = cache(async (): Promise<string[]> => {
  return [];
});