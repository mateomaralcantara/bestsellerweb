import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: {
    slug: string;
  };
};

type BookRow = {
  id: string;
  title: string;
  slug: string;
  preview_mode: string | null;
  preview_status: string | null;
  preview_error: string | null;
};

type PreviewPageRow = {
  id: string;
  page_index: number | null;
  page_number: number | null;
  image_path: string | null;
  image_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  width: number | null;
  height: number | null;
};

async function getSignedImageUrl(page: PreviewPageRow) {
  if (page.image_url) {
    return page.image_url;
  }

  const finalPath = page.storage_path || page.image_path;

  if (!page.storage_bucket || !finalPath) {
    return "";
  }

  const { data, error } = await supabaseAdmin.storage
    .from(page.storage_bucket)
    .createSignedUrl(finalPath, 60 * 10);

  if (error || !data?.signedUrl) {
    return "";
  }

  return data.signedUrl;
}

export default async function CatalogPreviewPage({ params }: PreviewPageProps) {
  const slug = decodeURIComponent(params.slug || "").trim();

  if (!slug) {
    notFound();
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, preview_mode, preview_status, preview_error")
    .eq("slug", slug)
    .maybeSingle<BookRow>();

  if (bookError || !book) {
    notFound();
  }

  const { data: pages, error: pagesError } = await supabaseAdmin
    .from("book_preview_pages")
    .select("id, page_index, page_number, image_path, image_url, storage_bucket, storage_path, width, height")
    .eq("book_id", book.id)
    .order("page_index", { ascending: true });

  const previewPages = pages || [];

  const signedPages = await Promise.all(
    previewPages.map(async (page) => ({
      ...page,
      signed_url: await getSignedImageUrl(page),
    }))
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-yellow-400">
            Fragmento del libro
          </p>

          <h1 className="text-2xl font-black md:text-4xl">
            {book.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-300">
            <span className="rounded-full bg-white/10 px-3 py-1">
              Modo: {book.preview_mode || "sin modo"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1">
              Estado: {book.preview_status || "sin estado"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1">
              Páginas: {signedPages.length}
            </span>
          </div>

          {book.preview_error ? (
            <p className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
              {book.preview_error}
            </p>
          ) : null}

          <div className="mt-5">
            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-yellow-300"
            >
              Volver al libro
            </Link>
          </div>
        </div>

        {pagesError ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
            Error leyendo book_preview_pages: {pagesError.message}
          </div>
        ) : null}

        {!pagesError && signedPages.length === 0 ? (
          <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-yellow-100">
            Todavía no hay páginas guardadas en book_preview_pages para este libro.
          </div>
        ) : null}

        <section className="space-y-6">
          {signedPages.map((page, index) => (
            <article
              key={page.id || index}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl"
            >
              <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700">
                Página {page.page_number ?? (page.page_index ?? index) + 1}
              </div>

              {page.signed_url ? (
                <img
                  src={page.signed_url}
                  alt={`Página ${page.page_number ?? (page.page_index ?? index) + 1} del fragmento`}
                  className="mx-auto h-auto w-full max-w-4xl bg-white object-contain"
                />
              ) : (
                <div className="p-6 text-red-700">
                  Esta fila no tiene image_url ni storage válido.
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

