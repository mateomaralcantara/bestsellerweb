import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BookReaderClient from "@/app/reader/[slug]/BookReaderClient";

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

  /*
   * IMPORTANTE:
   * Priorizamos image_path y generamos URL firmada.
   *
   * No usamos primero image_url porque las URLs públicas
   * actuales están respondiendo HTTP 400.
   */
  if (imagePath) {
    const { data, error } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .createSignedUrl(
        imagePath,
        SIGNED_URL_SECONDS
      );

    if (error) {
      console.error(
        `[PREVIEW] No se pudo firmar ${imagePath}:`,
        error.message
      );

      return "";
    }

    return data?.signedUrl?.trim() || "";
  }

  /*
   * Fallback únicamente para registros antiguos
   * que no tengan image_path.
   */
  return page.image_url?.trim() || "";
}

export default async function CatalogPreviewPage({
  params,
}: PreviewPageProps) {
  const resolvedParams = await params;

  const slug = decodeURIComponent(
    resolvedParams.slug || ""
  ).trim();

  if (!slug) {
    notFound();
  }

  // ==========================================================
  // 1. CARGAR LIBRO
  // ==========================================================

  const {
    data: book,
    error: bookError,
  } = await supabaseAdmin
    .from("books")
    .select(
      "id, title, slug, cover_url, preview_mode, preview_status, preview_error"
    )
    .eq("slug", slug)
    .maybeSingle<BookRow>();

  if (bookError) {
    console.error(
      "[PREVIEW] Error cargando libro:",
      bookError.message
    );

    notFound();
  }

  if (!book) {
    notFound();
  }

  // ==========================================================
  // 2. OBTENER LAS 25 PAGINAS
  // ==========================================================

  const {
    data: pages,
    error: pagesError,
  } = await supabaseAdmin
    .from("book_preview_pages")
    .select(
      "id, page_index, source_page_number, image_path, image_url, width, height"
    )
    .eq("book_id", book.id)
    .order("page_index", {
      ascending: true,
    })
    .limit(PREVIEW_PAGE_LIMIT)
    .returns<PreviewPageRow[]>();

  if (pagesError) {
    console.error(
      "[PREVIEW] Error cargando páginas:",
      pagesError.message
    );
  }

  const previewPages: PreviewPageRow[] =
    pages?.slice(0, PREVIEW_PAGE_LIMIT) ?? [];

  // ==========================================================
  // 3. GENERAR URLS FIRMADAS
  // ==========================================================

  const resolvedPages = await Promise.all(
    previewPages.map(async (page, index) => {
      const imageUrl =
        await resolvePreviewImageUrl(page);

      return {
        imageUrl,
        sourcePageNumber:
          page.source_page_number ??
          ((page.page_index ?? index) + 1),
        width: page.width,
        height: page.height,
      };
    })
  );

  const readerPages = resolvedPages
    .filter(
      (page) =>
        typeof page.imageUrl === "string" &&
        page.imageUrl.length > 0
    )
    .slice(0, PREVIEW_PAGE_LIMIT);

  // ==========================================================
  // 4. DIAGNOSTICO
  // ==========================================================

  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " LIBROSELLER - PREVIEW FIRMADO"
  );
  console.log(
    "============================================================"
  );

  console.log(
    "[PREVIEW] Libro:",
    book.title
  );

  console.log(
    "[PREVIEW] DB pages:",
    previewPages.length
  );

  console.log(
    "[PREVIEW] Signed pages:",
    readerPages.length
  );

  if (readerPages.length > 0) {
    console.log(
      "[PREVIEW] Primera URL firmada:",
      readerPages[0].imageUrl
    );

    console.log(
      "[PREVIEW] Última URL firmada:",
      readerPages[
        readerPages.length - 1
      ].imageUrl
    );
  }

  if (readerPages.length !== previewPages.length) {
    console.error(
      `[PREVIEW] Solo se pudieron firmar ${readerPages.length} de ${previewPages.length} páginas.`
    );
  }

  console.log(
    "============================================================"
  );
  console.log("");

  // ==========================================================
  // 5. LECTOR
  // ==========================================================

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ececea]">
      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        previewPages={readerPages}
        progressKey={`preview:${book.slug}`}
        exitUrl={`/catalog/${encodeURIComponent(
          book.slug
        )}`}
        exitLabel="Volver al libro"
        purchaseUrl={`/checkout/paypal?bookId=${encodeURIComponent(
          book.id
        )}`}
        mode="preview"
      />
    </div>
  );
}