export type Role = "customer" | "author" | "affiliate" | "admin";

/**
 * Formatos visibles/comerciales.
 * Incluye reader porque tu data lo usa y porque tienes lector privado.
 */
export type BookFormat =
  | "print"
  | "ebook"
  | "reader"
  | "kindle"
  | "audiobook"
  | "bundle"
  | "paperback"
  | "hardcover"
  | "kindle_external";

/**
 * No incluyo "approved" porque tu enum de Supabase dio error:
 * invalid input value for enum book_status: "approved"
 */
export type BookStatus =
  | "draft"
  | "under_review"
  | "published"
  | "archived"
  | "rejected"
  | "changes_requested"
  | "unlisted";

export type AssetType = "cover" | "pdf" | "epub" | "manuscript";

export type CurrencyCode = "DOP" | "USD" | string;

export type PreviewStatus = "pending" | "generating" | "ready" | "disabled" | "error";

export type PreviewMode = "first_pages" | "manual" | "disabled";

export interface Author {
  id: string;
  name: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface BookBase {
  id: string;
  author_id?: string | null;
  owner_user_id?: string | null;

  slug: string;
  title: string;
  subtitle?: string | null;
  publisher_name?: string | null;

  cover_url?: string | null;
  badge?: string | null;
  status?: BookStatus | string | null;

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
  sales_count?: number | null;
}

export interface BookMetadata {
  page_count?: number | null;
  language?: string | null;
  language_code?: string | null;

  isbn?: string | null;
  isbn_13?: string | null;

  publication_date?: string | null;

  formats?: BookFormat[];
  categories?: string[];

  primary_niche?: string | null;
  primary_category?: string | null;
  secondary_category?: string | null;
  keywords?: string[] | null;

  kindle_url?: string | null;
  is_featured?: boolean | null;
  featured?: boolean | null;
}

export interface BookMarketing {
  target_audience?: string | null;
  reader_promise?: string | null;
  sales_hook?: string | null;
  comparable_books?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  marketing_angle?: string | null;
}

export interface BookPreviewContent {
  short_description?: string | null;
  description?: string | null;
  long_description?: string | null;

  description_short?: string | null;
  description_long?: string | null;

  summary?: string | null;
  excerpt?: string | null;

  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  sample_url?: string | null;
}

export interface BookPreviewConfig {
  preview_status?: PreviewStatus | string | null;
  preview_error?: string | null;
  preview_generated_at?: string | null;
  preview_page_count?: number | null;
  preview_mode?: PreviewMode | string | null;
  preview_include_cover?: boolean | null;
  preview_layout?: string | null;
  preview_progress_enabled?: boolean | null;
}

export interface Book
  extends BookBase,
    BookPricing,
    BookStats,
    BookMetadata,
    BookMarketing,
    BookPreviewContent,
    BookPreviewConfig {
  author?: Author | null;
}

export type DashboardBook = Pick<
  Book,
  "id" | "author_id" | "slug" | "title" | "cover_url" | "status" | "created_at"
>;

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
 * Representan la forma cruda de Supabase/Postgres.
 */

export interface DbBook {
  id: string;

  author_id: string | null;
  owner_user_id?: string | null;

  slug: string;
  title: string;
  subtitle?: string | null;
  publisher_name?: string | null;

  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;

  cover_url?: string | null;
  status?: BookStatus | string | null;

  featured?: boolean | null;
  is_featured?: boolean | null;

  primary_niche?: string | null;
  primary_category?: string | null;
  secondary_category?: string | null;
  keywords?: string[] | null;

  target_audience?: string | null;
  reader_promise?: string | null;
  sales_hook?: string | null;
  comparable_books?: string | null;

  meta_title?: string | null;
  meta_description?: string | null;
  marketing_angle?: string | null;

  language_code?: string | null;
  language?: string | null;

  isbn?: string | null;
  isbn_13?: string | null;

  page_count?: number | null;
  publication_date?: string | null;

  preview_status?: PreviewStatus | string | null;
  preview_error?: string | null;
  preview_generated_at?: string | null;
  preview_page_count?: number | null;
  preview_mode?: PreviewMode | string | null;
  preview_include_cover?: boolean | null;
  preview_layout?: string | null;
  preview_progress_enabled?: boolean | null;

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
  publisher_name?: string | null;

  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;

  cover_url?: string | null;
  status?: BookStatus | string;

  featured?: boolean;
  is_featured?: boolean;

  primary_niche?: string | null;
  primary_category?: string | null;
  secondary_category?: string | null;
  keywords?: string[] | null;

  target_audience?: string | null;
  reader_promise?: string | null;
  sales_hook?: string | null;
  comparable_books?: string | null;

  meta_title?: string | null;
  meta_description?: string | null;
  marketing_angle?: string | null;

  language_code?: string | null;
  language?: string | null;

  isbn?: string | null;
  isbn_13?: string | null;

  page_count?: number | null;
  publication_date?: string | null;

  preview_status?: PreviewStatus | string | null;
  preview_error?: string | null;
  preview_generated_at?: string | null;
  preview_page_count?: number | null;
  preview_mode?: PreviewMode | string | null;
  preview_include_cover?: boolean | null;
  preview_layout?: string | null;
  preview_progress_enabled?: boolean | null;

  metadata?: Record<string, unknown> | null;
}

export interface DbBookEdition {
  id: string;
  book_id: string;

  format: BookFormat | string;
  edition_name: string | null;

  price: number;
  currency: CurrencyCode;

  compare_at_price?: number | null;
  page_count?: number | null;
  isbn?: string | null;

  affiliate_enabled?: boolean | null;
  affiliate_commission_percentage?: number | null;
  download_allowed?: boolean | null;

  file_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface DbBookEditionInsert {
  book_id: string;

  format: BookFormat | string;
  edition_name?: string | null;

  price: number;
  currency: CurrencyCode;

  compare_at_price?: number | null;
  page_count?: number | null;
  isbn?: string | null;

  affiliate_enabled?: boolean | null;
  affiliate_commission_percentage?: number | null;
  download_allowed?: boolean | null;

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

  created_at?: string | null;
  updated_at?: string | null;
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

export interface BookPreviewPage {
  id?: string;
  book_id: string;

  page_index: number;
  source_page_number?: number | null;

  kind: "cover" | "pdf_page";

  image_path?: string | null;
  image_url?: string | null;

  width?: number | null;
  height?: number | null;

  created_at?: string | null;
}

export interface BookPurchase {
  id: string;
  user_id: string;
  book_id: string;
  order_id?: string | null;

  status: "paid" | "refunded" | "revoked" | string;

  payment_provider?: string | null;
  payment_reference?: string | null;

  paid_at?: string | null;
  revoked_at?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}
