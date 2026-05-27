import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Globe2,
  Layers3,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  LookInsidePreview,
  type LookInsidePreviewPage,
} from "@/components/books/LookInsidePreview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    slug: string;
  };
};

type BookRecord = {
  id: string;
  author_id: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  status: string;

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

  preview_status: string | null;
  preview_generated_at: string | null;
};

type AuthorRecord = {
  id: string;
  pen_name: string | null;
  display_name: string | null;
  slug: string | null;
  email: string | null;
};

type EditionRecord = {
  id: string;
  edition_name: string | null;
  price: number | null;
  currency: string | null;
  format: string | null;
  compare_at_price: number | null;
  page_count: number | null;
  isbn: string | null;
  affiliate_enabled: boolean | null;
  affiliate_commission_percentage: number | null;
  download_allowed: boolean | null;
};

type CoverAssetRecord = {
  asset_type: string;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  is_public: boolean | null;
};

type PreviewPageRecord = {
  id: string;
  page_index: number;
  source_page_number: number | null;
  kind: string | null;
  image_url: string | null;
  image_path: string | null;
  width: number | null;
  height: number | null;
};

const PREVIEW_BUCKET = "book-previews";

const BOOK_SELECT = `
  id,
  author_id,
  title,
  slug,
  subtitle,
  publisher_name,
  cover_url,
  status,
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
  preview_status,
  preview_generated_at
`;

const EDITION_SELECT = `
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
`;

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function getStoragePublicUrl(bucket: string, storagePath: string) {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl || null;
}

function formatMoney(price: number | null, currencyCode: string | null) {
  if (typeof price !== "number") return null;

  const safeCurrency = currencyCode?.trim() || "DOP";

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${safeCurrency} ${price}`;
  }
}

function getLanguageLabel(languageCode: string | null) {
  const code = languageCode?.trim().toLowerCase();

  if (code === "es") return "Español";
  if (code === "en") return "Inglés";
  if (code === "pt") return "Portugués";
  if (code === "fr") return "Francés";

  return languageCode || "No especificado";
}

function getFormatLabel(format: string | null) {
  const value = format?.trim().toLowerCase();

  if (value === "ebook") return "Ebook";
  if (value === "paperback") return "Impreso tapa blanda";
  if (value === "hardcover") return "Impreso tapa dura";
  if (value === "audiobook") return "Audiolibro";
  if (value === "bundle") return "Bundle";
  if (value === "print") return "Impreso";
  if (value === "kindle_external") return "Kindle externo";

  return format || "Digital";
}

function getAuthorName(author: AuthorRecord | null) {
  return (
    cleanText(author?.pen_name) ||
    cleanText(author?.display_name) ||
    cleanText(author?.email) ||
    "Autor independiente"
  );
}

function getSummary(book: BookRecord) {
  return (
    cleanText(book.description_short) ||
    cleanText(book.sales_hook) ||
    cleanText(book.description_long) ||
    "Este libro todavía no tiene resumen disponible."
  );
}

function getMainDescription(book: BookRecord) {
  const shortText = cleanText(book.description_short);
  const longText = cleanText(book.description_long);

  if (!longText) return null;
  if (shortText && longText === shortText) return null;

  return longText;
}

function getKeywordList(book: BookRecord) {
  return (book.keywords ?? [])
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getCategoryTrail(book: BookRecord) {
  return [
    cleanText(book.primary_niche),
    cleanText(book.primary_category),
    cleanText(book.secondary_category),
  ].filter(Boolean) as string[];
}

function normalizePreviewKind(kind: string | null): "cover" | "pdf_page" {
  return kind === "cover" ? "cover" : "pdf_page";
}

async function getPublishedBookBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select(BOOK_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Error cargando libro: ${error.message}`);
  }

  return (data as BookRecord | null) ?? null;
}

async function getAuthor(authorId: string | null) {
  if (!authorId) return null;

  const { data, error } = await supabaseAdmin
    .from("author_profiles")
    .select("id, pen_name, display_name, slug, email")
    .eq("id", authorId)
    .maybeSingle();

  if (error) {
    console.error("Error cargando autor:", error.message);
    return null;
  }

  return (data as AuthorRecord | null) ?? null;
}

async function getEdition(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_editions")
    .select(EDITION_SELECT)
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error cargando edición:", error.message);
    return null;
  }

  return (data as EditionRecord | null) ?? null;
}

async function getCoverAsset(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select("asset_type, file_url, storage_bucket, storage_path, is_public")
    .eq("book_id", bookId)
    .eq("asset_type", "cover")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error cargando portada:", error.message);
    return null;
  }

  return (data as CoverAssetRecord | null) ?? null;
}

function resolveCoverUrl(book: BookRecord, asset: CoverAssetRecord | null) {
  const bookCoverUrl = cleanText(book.cover_url);

  if (bookCoverUrl) {
    return bookCoverUrl;
  }

  const assetFileUrl = cleanText(asset?.file_url);

  if (assetFileUrl) {
    return assetFileUrl;
  }

  if (asset?.storage_bucket && asset.storage_path) {
    return getStoragePublicUrl(asset.storage_bucket, asset.storage_path);
  }

  return null;
}

async function getPreviewPages(bookId: string): Promise<LookInsidePreviewPage[]> {
  const { data, error } = await supabaseAdmin
    .from("book_preview_pages")
    .select(
      "id, page_index, source_page_number, kind, image_url, image_path, width, height"
    )
    .eq("book_id", bookId)
    .order("page_index", { ascending: true });

  if (error) {
    console.error("Error cargando páginas de muestra:", error.message);
    return [];
  }

  return ((data ?? []) as PreviewPageRecord[])
    .map((page): LookInsidePreviewPage | null => {
      const imageUrl =
        cleanText(page.image_url) ||
        (page.image_path
          ? getStoragePublicUrl(PREVIEW_BUCKET, page.image_path)
          : null);

      if (!imageUrl) return null;

      return {
        pageIndex: page.page_index,
        sourcePageNumber: page.source_page_number,
        kind: normalizePreviewKind(page.kind),
        imageUrl,
        imageWidth: page.width,
        imageHeight: page.height,
      };
    })
    .filter((page): page is LookInsidePreviewPage => Boolean(page));
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TextSection({
  title,
  children,
}: {
  title: string;
  children: string | null;
}) {
  if (!children) return null;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-3 whitespace-pre-line leading-8 text-slate-700">
        {children}
      </p>
    </section>
  );
}

export default async function BookPublicPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug || "").trim();

  if (!slug) {
    notFound();
  }

  const book = await getPublishedBookBySlug(slug);

  if (!book) {
    notFound();
  }

  const [author, edition, coverAsset, previewPages] = await Promise.all([
    getAuthor(book.author_id),
    getEdition(book.id),
    getCoverAsset(book.id),
    getPreviewPages(book.id),
  ]);

  const coverUrl = resolveCoverUrl(book, coverAsset);

  const summary = getSummary(book);
  const longDescription = getMainDescription(book);
  const categoryTrail = getCategoryTrail(book);
  const keywords = getKeywordList(book);
  const authorName = getAuthorName(author);

  const formattedPrice = formatMoney(
    edition?.price ?? null,
    edition?.currency ?? null
  );

  const compareAtPrice = formatMoney(
    edition?.compare_at_price ?? null,
    edition?.currency ?? null
  );

  const checkoutUrl = `/checkout?book=${encodeURIComponent(book.slug)}`;
  const readerUrl = `/reader/${encodeURIComponent(book.slug)}`;

  return (
    <main className="bg-slate-50">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[360px_1fr] lg:items-start">
          <aside className="space-y-5 lg:sticky lg:top-28">
            <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={`Portada de ${book.title}`}
                  className="aspect-[3/4] w-full rounded-[24px] object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-100 text-sm text-slate-500">
                  Sin portada
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Precio
              </p>

              <div className="mt-2 flex flex-wrap items-end gap-3">
                <p className="text-3xl font-black text-slate-950">
                  {formattedPrice ?? "Precio no disponible"}
                </p>

                {compareAtPrice ? (
                  <p className="pb-1 text-sm text-slate-400 line-through">
                    {compareAtPrice}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  href={checkoutUrl}
                  className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:opacity-90"
                >
                  Comprar libro
                </Link>

                <LookInsidePreview
                  title={book.title}
                  subtitle={book.subtitle}
                  authorName={authorName}
                  coverUrl={coverUrl}
                  checkoutUrl={checkoutUrl}
                  pages={previewPages}
                  introduction={book.introduction}
                  chapterOneExcerpt={book.chapter_one_excerpt}
                />

                <Link
                  href={readerUrl}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Leer si ya compraste
                </Link>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                <strong>Acceso protegido:</strong> el libro completo solo se
                abre después de compra aprobada.
              </div>

              {process.env.NODE_ENV !== "production" ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  <p>
                    <strong>Debug:</strong>
                  </p>
                  <p>Cover URL: {coverUrl ? "sí" : "no"}</p>
                  <p>Preview pages: {previewPages.length}</p>
                  <p>Preview status: {book.preview_status ?? "n/a"}</p>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="space-y-6">
            <header className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Publicado
                </span>

                {edition?.format ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {getFormatLabel(edition.format)}
                  </span>
                ) : null}

                {book.language_code ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {getLanguageLabel(book.language_code)}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                {book.title}
              </h1>

              {book.subtitle ? (
                <p className="mt-3 text-xl font-medium leading-8 text-slate-600">
                  {book.subtitle}
                </p>
              ) : null}

              <p className="mt-4 text-sm text-slate-500">
                Por{" "}
                <span className="font-semibold text-slate-800">
                  {authorName}
                </span>
                {book.publisher_name ? (
                  <>
                    {" "}
                    · Sello:{" "}
                    <span className="font-semibold text-slate-800">
                      {book.publisher_name}
                    </span>
                  </>
                ) : null}
              </p>

              {book.sales_hook ? (
                <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                    Gancho de venta
                  </p>
                  <p className="mt-2 text-lg font-semibold leading-8 text-amber-950">
                    {book.sales_hook}
                  </p>
                </div>
              ) : null}

              <section className="mt-6">
                <h2 className="text-xl font-bold text-slate-950">Resumen</h2>
                <p className="mt-3 whitespace-pre-line text-lg leading-8 text-slate-700">
                  {summary}
                </p>
              </section>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard
                icon={Layers3}
                label="Nicho"
                value={book.primary_niche}
              />

              <InfoCard
                icon={Tags}
                label="Categoría"
                value={book.primary_category}
              />

              <InfoCard
                icon={BookOpen}
                label="Páginas"
                value={edition?.page_count ?? null}
              />

              <InfoCard
                icon={Globe2}
                label="Idioma"
                value={getLanguageLabel(book.language_code)}
              />
            </div>

            {categoryTrail.length > 0 ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Clasificación editorial
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {categoryTrail.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {keywords.length > 0 ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Palabras clave
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              {book.target_audience ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Target className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Para quién es
                    </h2>
                  </div>

                  <p className="mt-4 whitespace-pre-line leading-8 text-slate-700">
                    {book.target_audience}
                  </p>
                </section>
              ) : null}

              {book.reader_promise ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Promesa al lector
                    </h2>
                  </div>

                  <p className="mt-4 whitespace-pre-line leading-8 text-slate-700">
                    {book.reader_promise}
                  </p>
                </section>
              ) : null}
            </div>

            <TextSection title="Descripción completa">
              {longDescription}
            </TextSection>

            <TextSection title="Ángulo de marketing">
              {book.marketing_angle}
            </TextSection>

            <TextSection title="Libros comparables">
              {book.comparable_books}
            </TextSection>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Detalles del producto
              </h2>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Formato
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {getFormatLabel(edition?.format ?? null)}
                  </dd>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Edición
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {edition?.edition_name || "Edición digital"}
                  </dd>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    ISBN
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {edition?.isbn || "No especificado"}
                  </dd>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Descarga
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {edition?.download_allowed
                      ? "Disponible según compra"
                      : "Lectura protegida"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-lg font-bold">Compra segura</h2>
                  <p className="mt-2 leading-7">
                    Esta página muestra la ficha pública del libro. El archivo
                    completo no se expone aquí; el acceso completo se valida en
                    el lector privado después de confirmar la compra.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                ¿Qué incluye?
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Ficha editorial completa",
                  "Lectura protegida después de compra",
                  "Acceso desde tu cuenta",
                  "Actualizaciones menores según edición",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-slate-700">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {book.sample_url ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Muestra externa
                </h2>

                <Link
                  href={book.sample_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Ver muestra
                </Link>
              </section>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
