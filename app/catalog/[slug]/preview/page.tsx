import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BookReaderClient from "@/app/reader/[slug]/BookReaderClient";
import EpubReaderClient from "@/app/reader/[slug]/EpubReaderClient";
import EpubHeadingCenter from "@/app/reader/[slug]/EpubHeadingCenter";
import PreviewTelemetry from "./PreviewTelemetry";
import PreviewSubscriberGate from "./PreviewSubscriberGate";

export const dynamic = "force-dynamic";

const PREVIEW_PAGE_LIMIT = 25;
const PREVIEW_BUCKET = "book-previews";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

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

async function resolvePreviewImageUrl(
  page: PreviewPageRow
): Promise<string> {
  const imagePath = page.image_path?.trim();

  if (imagePath) {
    const { data, error } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(imagePath, SIGNED_URL_SECONDS);

    if (error) {
      console.error(
        `[PREVIEW] No se pudo firmar ${imagePath}:`,
        error.message
      );
      return "";
    }

    return data?.signedUrl?.trim() || "";
  }

  return page.image_url?.trim() || "";
}

async function hasFullEpub(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select("id")
    .eq("book_id", bookId)
    .eq("asset_type", "epub")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[PREVIEW] Error buscando EPUB completo:", error.message);
    return false;
  }

  return Boolean(data);
}

export default async function CatalogPreviewPage({
  params,
}: PreviewPageProps) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug || "").trim();

  if (!slug) {
    notFound();
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select(
      "id, title, slug, cover_url, preview_mode, preview_status, preview_error"
    )
    .eq("slug", slug)
    .maybeSingle<BookRow>();

  if (bookError) {
    console.error("[PREVIEW] Error cargando libro:", bookError.message);
    notFound();
  }

  if (!book) {
    notFound();
  }

  if (await hasFullEpub(book.id)) {
    const progressKey = `preview:${book.slug}:epub`;

    return (
      <div
        data-libroseller-epub-reader="true"
        className="h-[100dvh] overflow-hidden bg-[#071018]"
      >
        <EpubReaderClient
          title={book.title}
          epubUrl={`/api/books/${encodeURIComponent(book.slug)}/epub?mode=preview`}
          progressKey={progressKey}
          exitUrl={`/catalog/${encodeURIComponent(book.slug)}`}
          exitLabel="Volver al libro"
          purchaseUrl={`/checkout/paypal?bookId=${encodeURIComponent(book.id)}`}
          mode="preview"
        />
        <EpubHeadingCenter />
        <PreviewTelemetry bookSlug={book.slug} progressKey={progressKey} />
        <PreviewSubscriberGate
          bookSlug={book.slug}
          bookTitle={book.title}
          progressKey={progressKey}
          readerKind="epub"
        />
      </div>
    );
  }

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("book_preview_pages")
    .select(
      "id, page_index, source_page_number, image_path, image_url, width, height"
    )
    .eq("book_id", book.id)
    .order("page_index", { ascending: true })
    .limit(PREVIEW_PAGE_LIMIT)
    .returns<PreviewPageRow[]>();

  if (pagesError) {
    console.error("[PREVIEW] Error cargando paginas:", pagesError.message);
  }

  const previewPages: PreviewPageRow[] =
    pages?.slice(0, PREVIEW_PAGE_LIMIT) ?? [];

  const resolvedPages = await Promise.all(
    previewPages.map(async (page, index) => {
      const imageUrl = await resolvePreviewImageUrl(page);

      return {
        imageUrl,
        sourcePageNumber:
          page.source_page_number ?? ((page.page_index ?? index) + 1),
        width: page.width,
        height: page.height,
      };
    })
  );

  const readerPages = resolvedPages
    .filter(
      (page) =>
        typeof page.imageUrl === "string" && page.imageUrl.length > 0
    )
    .slice(0, PREVIEW_PAGE_LIMIT);
  const progressKey = `preview:${book.slug}`;

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ececea]">
      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        previewPages={readerPages}
        progressKey={progressKey}
        exitUrl={`/catalog/${encodeURIComponent(book.slug)}`}
        exitLabel="Volver al libro"
        purchaseUrl={`/checkout/paypal?bookId=${encodeURIComponent(book.id)}`}
        mode="preview"
      />
      <PreviewTelemetry bookSlug={book.slug} progressKey={progressKey} />
      <PreviewSubscriberGate
        bookSlug={book.slug}
        bookTitle={book.title}
        progressKey={progressKey}
        readerKind="pages"
      />
    </div>
  );
}
