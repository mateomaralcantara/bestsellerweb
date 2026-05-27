export type Role = "customer" | "author" | "affiliate" | "admin";

export type BookFormat =
  | "print"
  | "ebook"
  | "audiobook"
  | "kindle_external";

export type BookStatus = "draft" | "published" | "archived";

export type AssetType = "cover" | "pdf" | "epub";

export type CurrencyCode = "DOP" | "USD" | string;

export interface Author {
  id: string;
  name: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface BookBase {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  cover_url?: string | null;
  badge?: string | null;
  status?: BookStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BookPricing {
  price?: number | null;
  compare_at_price?: number | null;
  currency?: CurrencyCode | null;
}

export interface BookStats {
  rating?: number | null;
  review_count?: number | null;
}

export interface BookMetadata {
  page_count?: number | null;
  language?: string | null;
  isbn?: string | null;
  publication_date?: string | null;
  formats?: BookFormat[];
  categories?: string[];
  kindle_url?: string | null;
  is_featured?: boolean | null;
}

export interface BookPreviewContent {
  short_description?: string | null;
  long_description?: string | null;
  excerpt?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  sample_url?: string | null;
}

export interface Book
  extends BookBase,
    BookPricing,
    BookStats,
    BookMetadata,
    BookPreviewContent {
  author_id: string;
  author?: Author | null;
}

export interface DashboardBook
  extends Pick<
    Book,
    "id" | "author_id" | "slug" | "title" | "cover_url" | "status" | "created_at"
  > {}

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  price: number;
  format: BookFormat;
  cover_url?: string | null;
  quantity: number;
}

/**
 * DB MODELS
 * Estos representan la forma cruda de Supabase / Postgres.
 */

export interface DbBook {
  id: string;
  author_id: string | null;
  owner_user_id?: string | null;
  slug: string;
  title: string;
  subtitle?: string | null;
  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: BookStatus | null;
  featured?: boolean | null;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DbBookInsert {
  author_id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: BookStatus;
  featured?: boolean;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DbBookEdition {
  id: string;
  book_id: string;
  format: BookFormat | string;
  edition_name: string;
  price: number;
  currency: CurrencyCode;
  file_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookEditionInsert {
  book_id: string;
  format: BookFormat | string;
  edition_name: string;
  price: number;
  currency: CurrencyCode;
  file_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookAsset {
  id?: string;
  book_id: string;
  edition_id?: string | null;
  asset_type: AssetType;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  is_public?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookAssetInsert {
  book_id: string;
  edition_id?: string | null;
  asset_type: AssetType;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  is_public?: boolean | null;
  sort_order?: number | null;
}