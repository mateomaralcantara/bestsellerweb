import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditBookForm from "./EditBookForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type BookForEdit = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  status: string;
  owner_user_id: string;
  description_short: string | null;
  description_long: string | null;
  introduction: string | null;
  chapter_one_excerpt: string | null;
  sample_url: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
  target_audience: string | null;
  reader_promise: string | null;
  sales_hook: string | null;
  comparable_books: string | null;
  meta_title: string | null;
  meta_description: string | null;
  marketing_angle: string | null;
  language_code: string | null;
  metadata: Record<string, unknown> | null;
};

type EditionForEdit = {
  id: string;
  edition_name: string | null;
  price: number | null;
  currency: string | null;
  paypal_price?: number | null;
  paypal_currency?: string | null;
  format: string | null;
  compare_at_price: number | null;
  page_count: number | null;
  isbn: string | null;
  affiliate_enabled: boolean | null;
  affiliate_commission_percentage: number | null;
  download_allowed: boolean | null;
};

const BOOK_FOR_EDIT_SELECT = `
  id,
  title,
  slug,
  subtitle,
  publisher_name,
  cover_url,
  status,
  owner_user_id,
  description_short,
  description_long,
  introduction,
  chapter_one_excerpt,
  sample_url,
  primary_niche,
  primary_category,
  secondary_category,
  keywords,
  target_audience,
  reader_promise,
  sales_hook,
  comparable_books,
  meta_title,
  meta_description,
  marketing_angle,
  language_code,
  metadata
` as const;

const EDITION_FOR_EDIT_SELECT = `
  id,
  edition_name,
  price,
  currency,
  format,
  compare_at_price,
  page_count,
  isbn,
  affiliate_enabled,
  affiliate_commission_percentage,
  download_allowed
` as const;

function normalizeBookId(value: string | undefined) {
  return decodeURIComponent(value ?? "").trim();
}

function getEditLoginRedirect(bookId: string) {
  return `/auth?next=${encodeURIComponent(`/dashboard/books/${bookId}/edit`)}`;
}

export default async function EditBookPage({ params }: PageProps) {
  const bookId = normalizeBookId((await params).id);

  if (!bookId) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(getEditLoginRedirect(bookId));
  }

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select(BOOK_FOR_EDIT_SELECT)
    .eq("id", bookId)
    .eq("owner_user_id", user.id)
    .returns<BookForEdit[]>()
    .maybeSingle();

  if (bookError || !book) {
    notFound();
  }

  const { data: edition, error: editionError } = await supabase
    .from("book_editions")
    .select(EDITION_FOR_EDIT_SELECT)
    .eq("book_id", book.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .returns<EditionForEdit[]>()
    .maybeSingle();

  if (editionError) {
    console.error("Error cargando edición del libro:", editionError.message);
  }

  let editionWithPayPal: EditionForEdit | null = edition ?? null;

  if (edition?.id) {
    const { data: paypalPricing } = await supabase
      .from("book_editions")
      .select("paypal_price, paypal_currency")
      .eq("id", edition.id)
      .maybeSingle();

    if (paypalPricing) {
      editionWithPayPal = {
        ...edition,
        paypal_price: paypalPricing.paypal_price,
        paypal_currency: paypalPricing.paypal_currency,
      };
    }
  }

  return <EditBookForm book={book} edition={editionWithPayPal} />;
}
