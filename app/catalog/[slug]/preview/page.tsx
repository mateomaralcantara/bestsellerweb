import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BookReaderClient from "@/app/reader/[slug]/BookReaderClient";

export const dynamic = "force-dynamic";

const PREVIEW_PAGE_LIMIT = 25;
const PREVIEW_BUCKET = "book-previews";

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
  image_url: string | null;
  width: number | null;
  height: number | null;
};

function getPreviewImageUrl(page: PreviewPageRow) {
  if (page.image_url) {
    return page.image_url;
  }

  if (!page.image_path) {
    return "";
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage
    .from(PREVIEW_BUCKET)
    .getPublicUrl(page.image_path);

  return publicUrl || "";
}

export default async function CatalogPreviewPage({ params }: PreviewPageProps) {
  const slug = decodeURIComponent((await params).slug || "").trim();

  if (!slug) {
    notFound();
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, cover_url, preview_mode, preview_status, preview_error")
    .eq("slug", slug)
    .maybeSingle<BookRow>();

  if (bookError || !book) {
    notFound();
  }

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("book_preview_pages")
    .select("id, page_index, source_page_number, image_path, image_url, width, height")
    .eq("book_id", book.id)
    .order("page_index", { ascending: true })
    .limit(PREVIEW_PAGE_LIMIT);

  const previewPages = (pages || []).slice(0, PREVIEW_PAGE_LIMIT);

  if (pagesError) {
    console.error("Error cargando la muestra del libro:", pagesError.message);
  }

  const readerPages = previewPages
    .map((page) => ({
      ...page,
      resolvedImageUrl: getPreviewImageUrl(page),
    }))
    .filter((page) => Boolean(page.resolvedImageUrl))
    .slice(0, PREVIEW_PAGE_LIMIT)
    .map((page, index) => ({
      imageUrl: page.resolvedImageUrl,
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
