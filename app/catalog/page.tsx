import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Filter,
  Search,
  ShoppingBag,
  Star,
  Tags,
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CatalogPageProps = {
  searchParams?: {
    q?: string;
    category?: string;
  };
};

type BookRecord = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  status: string | null;
  description_short: string | null;
  description_long: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
  author_id: string | null;
  publisher_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EditionRecord = {
  book_id: string;
  price: number | null;
  compare_at_price: number | null;
  currency: string | null;
  format: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type AuthorRecord = {
  id: string;
  display_name: string | null;
  pen_name: string | null;
  slug: string | null;
};

type CatalogBook = BookRecord & {
  edition: EditionRecord | null;
  author: AuthorRecord | null;
};

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (typeof price !== "number") return "Precio no disponible";

  const safeCurrency = currency || "DOP";

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${safeCurrency} ${price.toFixed(2)}`;
  }
}

function getAuthorName(book: CatalogBook) {
  return (
    book.author?.display_name ||
    book.author?.pen_name ||
    book.publisher_name ||
    "Autor independiente"
  );
}

function getDescription(book: CatalogBook) {
  return (
    book.description_short ||
    book.description_long ||
    book.subtitle ||
    "Libro disponible en BestSeller."
  );
}

function getBookCover(book: CatalogBook) {
  return book.cover_url || "/og-image.png";
}

function filterBooks({
  books,
  query,
  category,
}: {
  books: CatalogBook[];
  query: string;
  category: string;
}) {
  const cleanQuery = normalize(query);
  const cleanCategory = normalize(category);

  return books.filter((book) => {
    const searchable = [
      book.title,
      book.subtitle,
      book.description_short,
      book.description_long,
      book.primary_niche,
      book.primary_category,
      book.secondary_category,
      book.publisher_name,
      getAuthorName(book),
      ...(book.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = cleanQuery ? searchable.includes(cleanQuery) : true;

    const matchesCategory = cleanCategory
      ? normalize(book.primary_category) === cleanCategory ||
        normalize(book.primary_niche) === cleanCategory ||
        normalize(book.secondary_category) === cleanCategory
      : true;

    return matchesQuery && matchesCategory;
  });
}

async function getCatalogBooks(): Promise<CatalogBook[]> {
  const { data: books, error: booksError } = await supabaseAdmin
    .from("books")
    .select(
      `
        id,
        slug,
        title,
        subtitle,
        cover_url,
        status,
        description_short,
        description_long,
        primary_niche,
        primary_category,
        secondary_category,
        keywords,
        author_id,
        publisher_name,
        created_at,
        updated_at
      `
    )
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .range(0, 499);

  if (booksError) {
    throw new Error(`Error cargando catálogo: ${booksError.message}`);
  }

  const safeBooks = (books ?? []) as BookRecord[];

  if (safeBooks.length === 0) {
    return [];
  }

  const bookIds = safeBooks.map((book) => book.id);
  const authorIds = safeBooks
    .map((book) => book.author_id)
    .filter((id): id is string => Boolean(id));

  const { data: editions } = await supabaseAdmin
    .from("book_editions")
    .select(
      `
        book_id,
        price,
        compare_at_price,
        currency,
        format,
        is_active,
        sort_order
      `
    )
    .in("book_id", bookIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: authors } =
    authorIds.length > 0
      ? await supabaseAdmin
          .from("author_profiles")
          .select("id, display_name, pen_name, slug")
          .in("id", authorIds)
      : { data: [] };

  const editionsByBookId = new Map<string, EditionRecord>();
  const authorsById = new Map<string, AuthorRecord>();

  for (const edition of (editions ?? []) as EditionRecord[]) {
    if (!editionsByBookId.has(edition.book_id)) {
      editionsByBookId.set(edition.book_id, edition);
    }
  }

  for (const author of (authors ?? []) as AuthorRecord[]) {
    authorsById.set(author.id, author);
  }

  return safeBooks.map((book) => ({
    ...book,
    edition: editionsByBookId.get(book.id) ?? null,
    author: book.author_id ? authorsById.get(book.author_id) ?? null : null,
  }));
}

function getCategories(books: CatalogBook[]) {
  const categories = new Set<string>();

  for (const book of books) {
    if (book.primary_niche) categories.add(book.primary_niche);
    if (book.primary_category) categories.add(book.primary_category);
    if (book.secondary_category) categories.add(book.secondary_category);
  }

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

function FeaturedBookCard({ book }: { book: CatalogBook }) {
  const price = formatPrice(book.edition?.price, book.edition?.currency);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <Link
        href={`/catalog/${book.slug}`}
        className="block bg-slate-100 p-4"
      >
        <img
          src={getBookCover(book)}
          alt={book.title}
          className="mx-auto aspect-[2/3] w-full max-w-[150px] rounded-xl object-cover shadow-xl ring-1 ring-black/10 transition group-hover:scale-[1.03]"
        />
      </Link>

      <div className="space-y-3 p-4">
        <Link href={`/catalog/${book.slug}`}>
          <h2 className="line-clamp-2 text-base font-black leading-tight text-slate-950 transition group-hover:text-brand-700">
            {book.title}
          </h2>
        </Link>

        <p className="line-clamp-1 text-xs text-slate-500">
          por{" "}
          <span className="font-semibold text-slate-700">
            {getAuthorName(book)}
          </span>
        </p>

        {book.primary_category ? (
          <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
            {book.primary_category}
          </span>
        ) : null}

        <p className="text-lg font-black text-slate-950">{price}</p>

        <Link
          href={`/catalog/${book.slug}`}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Ver libro
        </Link>
      </div>
    </article>
  );
}

function VerticalBookCard({ book }: { book: CatalogBook }) {
  const price = formatPrice(book.edition?.price, book.edition?.currency);

  const compareAtPrice = formatPrice(
    book.edition?.compare_at_price,
    book.edition?.currency
  );

  const hasCompareAtPrice =
    typeof book.edition?.compare_at_price === "number" &&
    typeof book.edition?.price === "number" &&
    book.edition.compare_at_price > book.edition.price;

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="grid gap-0 md:grid-cols-[190px_1fr_210px]">
        <Link
          href={`/catalog/${book.slug}`}
          className="flex items-center justify-center bg-slate-100 p-5"
        >
          <img
            src={getBookCover(book)}
            alt={book.title}
            className="aspect-[2/3] w-full max-w-[150px] rounded-xl object-cover shadow-xl ring-1 ring-black/10 transition group-hover:scale-[1.02]"
          />
        </Link>

        <div className="space-y-4 p-5">
          <div>
            <Link href={`/catalog/${book.slug}`}>
              <h2 className="line-clamp-2 text-xl font-black leading-tight text-slate-950 transition group-hover:text-brand-700">
                {book.title}
              </h2>
            </Link>

            {book.subtitle ? (
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                {book.subtitle}
              </p>
            ) : null}

            <p className="mt-2 text-sm text-slate-500">
              por{" "}
              <span className="font-semibold text-slate-700">
                {getAuthorName(book)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              <Star className="mr-1 h-3.5 w-3.5 fill-current" />
              Disponible
            </span>

            {book.primary_category ? (
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                {book.primary_category}
              </span>
            ) : null}

            {book.edition?.format ? (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {book.edition.format}
              </span>
            ) : null}
          </div>

          <p className="line-clamp-3 text-sm leading-7 text-slate-700">
            {getDescription(book)}
          </p>

          {book.keywords && book.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {book.keywords.slice(0, 6).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between border-t border-slate-200 p-5 md:border-l md:border-t-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Precio
            </p>

            <p className="mt-2 text-2xl font-black text-slate-950">{price}</p>

            {hasCompareAtPrice ? (
              <p className="mt-1 text-sm text-slate-400 line-through">
                {compareAtPrice}
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Compra segura, lectura digital y fragmento disponible cuando el
              libro tenga muestra generada.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              Ver detalle
              <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <ShoppingBag className="h-4 w-4" />
              Comprar / leer
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = searchParams?.q ?? "";
  const category = searchParams?.category ?? "";

  const books = await getCatalogBooks();
  const filteredBooks = filterBooks({
    books,
    query,
    category,
  });

  const featuredBooks = filteredBooks.slice(0, 5);
  const remainingBooks = filteredBooks.slice(5);
  const categories = getCategories(books);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                Catálogo
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-900 md:text-5xl">
                Todos los libros
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Cinco libros destacados arriba y el resto en lista vertical para
                explorar bajando como en un marketplace tipo Amazon.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
              <strong className="text-slate-950">{filteredBooks.length}</strong>{" "}
              libros visibles
            </div>
          </div>

          <form className="mt-8 grid gap-3 md:grid-cols-[1fr_260px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar por título, autor, categoría o palabra clave..."
                className="h-13 w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
              />
            </label>

            <select
              name="category"
              defaultValue={category}
              className="h-13 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
            >
              <option value="">Todas las categorías</option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-4 text-sm font-bold text-white transition hover:opacity-90"
            >
              <Filter className="h-4 w-4" />
              Filtrar
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        {filteredBooks.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-xl font-black text-slate-950">
              No hay libros disponibles
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Prueba limpiar el filtro o publicar libros con estado{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                published
              </code>
              .
            </p>
          </div>
        ) : (
          <>
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                    Destacados
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    Los primeros 5 libros
                  </h2>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                {featuredBooks.map((book) => (
                  <FeaturedBookCard key={book.id} book={book} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                    Catálogo completo
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    Más libros para explorar
                  </h2>
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  {remainingBooks.length} adicionales
                </p>
              </div>

              {remainingBooks.length > 0 ? (
                <div className="space-y-5">
                  {remainingBooks.map((book) => (
                    <VerticalBookCard key={book.id} book={book} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
                  No hay más libros debajo de los 5 destacados.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}