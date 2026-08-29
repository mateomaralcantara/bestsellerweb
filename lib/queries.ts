import { cache } from "react";
import { Book, BookFormat, BookStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getBookSocialProof } from "@/lib/book-social-proof";

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
  metadata,
  created_at,
  updated_at
`;

const EDITION_SELECT_WITH_PAYPAL = `
  id,
  book_id,
  format,
  price,
  compare_at_price,
  currency,
  paypal_price,
  paypal_currency,
  is_active,
  sort_order
`;

const EDITION_SELECT_BASE = `
  id,
  book_id,
  format,
  price,
  compare_at_price,
  currency,
  is_active,
  sort_order
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
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditionRow = {
  id: string;
  book_id: string;
  format?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  currency?: string | null;
  paypal_price?: number | string | null;
  paypal_currency?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

type VerifiedMetricRow = {
  book_id: string;
  verified_rating?: number | string | null;
  verified_sales_count?: number | string | null;
  review_count?: number | string | null;
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

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCurrency(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeFormat(value: unknown): BookFormat | null {
  const normalized = normalizeText(value)?.toLowerCase();

  if (
    normalized === "print" ||
    normalized === "ebook" ||
    normalized === "reader" ||
    normalized === "kindle" ||
    normalized === "audiobook" ||
    normalized === "bundle" ||
    normalized === "paperback" ||
    normalized === "hardcover" ||
    normalized === "kindle_external"
  ) {
    return normalized;
  }

  return null;
}

function resolveEditionPrice(edition: EditionRow | null) {
  const localPrice = normalizeNumber(edition?.price);
  const paypalPrice = normalizeNumber(edition?.paypal_price);
  const localCurrency = normalizeCurrency(edition?.currency);
  const paypalCurrency =
    normalizeCurrency(edition?.paypal_currency) || "USD";

  if (localPrice !== null && localPrice > 0) {
    return {
      price: localPrice,
      compareAtPrice: normalizeNumber(edition?.compare_at_price),
      currency: localCurrency || "DOP",
    };
  }

  if (paypalPrice !== null && paypalPrice > 0) {
    return {
      price: paypalPrice,
      compareAtPrice: null,
      currency: paypalCurrency,
    };
  }

  return {
    price: localPrice ?? paypalPrice,
    compareAtPrice: normalizeNumber(edition?.compare_at_price),
    currency: localCurrency || (paypalPrice !== null ? paypalCurrency : null),
  };
}

function normalizeBook(
  row: BookRow,
  edition: EditionRow | null = null,
  verifiedMetrics: VerifiedMetricRow | null = null
): Book {
  const longDescription = normalizeText(row.description_long);
  const pricing = resolveEditionPrice(edition);
  const format = normalizeFormat(edition?.format);
  const metadataProof = getBookSocialProof(row.metadata);
  const verifiedRating = normalizeNumber(verifiedMetrics?.verified_rating);
  const verifiedSales = normalizeNumber(verifiedMetrics?.verified_sales_count);
  const verifiedReviews = normalizeNumber(verifiedMetrics?.review_count);

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

    price: pricing.price,
    compare_at_price: pricing.compareAtPrice,
    currency: pricing.currency,
    rating: verifiedRating ?? metadataProof.rating,
    review_count: verifiedReviews ?? 0,
    sales_count: verifiedSales ?? metadataProof.salesCount,
    formats: format ? [format] : [],
    categories: [],
    badge: null,
    kindle_url: null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,

    author: null,
  };
}

async function getActiveEditionMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookIds: string[]
) {
  const editionsByBook = new Map<string, EditionRow>();

  if (bookIds.length === 0) {
    return editionsByBook;
  }

  const paypalResult = await supabase
    .from("book_editions")
    .select(EDITION_SELECT_WITH_PAYPAL)
    .in("book_id", bookIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  let editions = (paypalResult.data ?? []) as EditionRow[];
  let editionError = paypalResult.error;

  if (editionError) {
    console.warn(
      "GETBOOKS: reintentando precios sin columnas PayPal:",
      editionError.message
    );

    const baseResult = await supabase
      .from("book_editions")
      .select(EDITION_SELECT_BASE)
      .in("book_id", bookIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    editions = (baseResult.data ?? []) as EditionRow[];
    editionError = baseResult.error;
  }

  if (editionError) {
    console.error("GETBOOKS PRICES ERROR:", editionError.message);
    return editionsByBook;
  }

  for (const edition of editions) {
    if (!editionsByBook.has(edition.book_id)) {
      editionsByBook.set(edition.book_id, edition);
    }
  }

  return editionsByBook;
}

async function getVerifiedMetricsMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookIds: string[]
) {
  const metricsByBook = new Map<string, VerifiedMetricRow>();
  if (bookIds.length === 0) return metricsByBook;

  const { data, error } = await supabase
    .from("book_verified_metrics")
    .select("book_id, verified_rating, verified_sales_count, review_count")
    .in("book_id", bookIds);

  if (error) {
    // Compatibilidad durante el despliegue previo a aplicar la migración 9.x.
    console.warn("GETBOOKS VERIFIED METRICS:", error.message);
    return metricsByBook;
  }

  for (const row of (data ?? []) as VerifiedMetricRow[]) {
    metricsByBook.set(row.book_id, row);
  }

  return metricsByBook;
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

  const rows = (data ?? []) as BookRow[];
  const ids = rows.map((book) => book.id);
  const [editionsByBook, metricsByBook] = await Promise.all([
    getActiveEditionMap(supabase, ids),
    getVerifiedMetricsMap(supabase, ids),
  ]);

  return rows.map((book) =>
    normalizeBook(
      book,
      editionsByBook.get(book.id) ?? null,
      metricsByBook.get(book.id) ?? null
    )
  );
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

  const row = data as BookRow;
  const [editionsByBook, metricsByBook] = await Promise.all([
    getActiveEditionMap(supabase, [row.id]),
    getVerifiedMetricsMap(supabase, [row.id]),
  ]);

  return normalizeBook(
    row,
    editionsByBook.get(row.id) ?? null,
    metricsByBook.get(row.id) ?? null
  );
});

export const getBookCategories = cache(async (): Promise<string[]> => {
  return [];
});
