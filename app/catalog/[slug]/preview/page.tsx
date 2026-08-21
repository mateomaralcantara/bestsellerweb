import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BookReaderClient from "@/app/reader/[slug]/BookReaderClient";

export const dynamic = "force-dynamic";

const PREVIEW_PAGE_LIMIT = 25;
const SAFE_SLUG = /^[a-z0-9-]{1,160}$/i;

type PreviewPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type BookRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  preview_mode: string | null;
  preview_status: string | null;
  preview_error: string | null;
};

type PreviewPageRow = {
  id: string;
  page_index: number | null;
  source_page_number: number | null;
  image_path: string | null;
  width: number | null;
  height: number | null;
};

export default async function CatalogPreviewPage({ params }: PreviewPageProps) {
  const { slug: rawSlug } = await params;
  let slug = "";

  try {
    const candidate = decodeURIComponent(rawSlug || "").trim();
    slug = SAFE_SLUG.test(candidate) ? candidate : "";
  } catch {
    slug = "";
  }

  if (!slug) {
    notFound();
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, cover_url, preview_mode, preview_status, preview_error")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<BookRow>();

  if (bookError || !book) {
    notFound();
  }

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("book_preview_pages")
    .select("id, page_index, source_page_number, image_path, width, height")
    .eq("book_id", book.id)
    .order("page_index", { ascending: true })
    .limit(PREVIEW_PAGE_LIMIT);

  const previewPages = (pages || []).slice(0, PREVIEW_PAGE_LIMIT);

  if (pagesError) {
    console.error("Error cargando la muestra del libro:", pagesError.message);
  }

  const readerPages = previewPages
    .filter(
      (page) =>
        Boolean(page.image_path) &&
        Number.isInteger(page.page_index) &&
        Number(page.page_index) >= 0 &&
        Number(page.page_index) < PREVIEW_PAGE_LIMIT
    )
    .slice(0, PREVIEW_PAGE_LIMIT)
    .map((page, index) => ({
      imageUrl: `/api/books/${encodeURIComponent(book.slug)}/preview/${page.page_index}`,
      sourcePageNumber:
        page.source_page_number ?? (page.page_index ?? index) + 1,
      width: page.width,
      height: page.height,
    }));

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ececea]">
      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        previewPages={readerPages}
        progressKey={`preview:${book.slug}`}
        exitUrl={`/catalog/${encodeURIComponent(book.slug)}`}
        exitLabel="Volver al libro"
        purchaseUrl={`/checkout/paypal?bookId=${encodeURIComponent(book.id)}`}
        mode="preview"
      />
    </div>
  );
}
