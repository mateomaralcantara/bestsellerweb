import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Filter,
  Search,
  ShoppingCart,
  Star,
} from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { getBookCategories, getBooks } from "@/lib/queries";
import type { Book } from "@/lib/types";

type CatalogPageProps = {
  searchParams?: {
    category?: string;
    q?: string;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function getAuthorName(book: Book) {
  return (
    book.author?.name ||
    book.author?.headline ||
    book.publisher_name ||
    "Autor independiente"
  );
}

function getDescription(book: Book) {
  return (
    book.short_description ||
    book.description_short ||
    book.description ||
    book.long_description ||
    book.description_long ||
    book.subtitle ||
    "Libro disponible en BestSeller."
  );
}

function getCover(book: Book) {
  return book.cover_url || "/og-image.png";
}

function getMainCategory(book: Book) {
  return (
    book.categories?.[0] ||
    book.primary_category ||
    book.primary_niche ||
    book.secondary_category ||
    "General"
  );
}

function getCategoryText(book: Book) {
  const categories = book.categories ?? [];

  if (categories.length > 0) {
    return categories.join(" · ");
  }

  return (
    book.primary_category ||
    book.primary_niche ||
    book.secondary_category ||
    "Catálogo general"
  );
}

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (typeof price !== "number") {
    return "Precio no disponible";
  }

  const safeCurrency = currency || "USD";

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

function matchesCategory(book: Book, selectedCategory: string) {
  if (!selectedCategory) return true;

  const bookCategories = [
    ...(book.categories ?? []),
    book.primary_category,
    book.primary_niche,
    book.secondary_category,
  ]
    .filter(Boolean)
    .map((item) => normalize(String(item)));

  return bookCategories.includes(normalize(selectedCategory));
}

function matchesSearch(book: Book, query: string) {
  if (!query) return true;

  const searchable = [
    book.title,
    book.subtitle,
    getAuthorName(book),
    getDescription(book),
    book.primary_niche,
    book.primary_category,
    book.secondary_category,
    ...(book.categories ?? []),
    ...(book.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(normalize(query));
}

function filterBooks({
  books,
  selectedCategory,
  query,
}: {
  books: Book[];
  selectedCategory: string;
  query: string;
}) {
  return books.filter((book) => {
    return matchesCategory(book, selectedCategory) && matchesSearch(book, query);
  });
}

/* =========================================================
   TARJETA SUPERIOR: 5 LIBROS HORIZONTALES
========================================================= */

function FeaturedBookCard({ book }: { book: Book }) {
  const price = formatPrice(book.price, book.currency);

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <Link
        href={`/catalog/${book.slug}`}
        className="flex h-64 items-center justify-center bg-slate-100 p-4"
      >
        <img
          src={getCover(book)}
          alt={book.title}
          className="h-full max-h-56 w-auto rounded-lg object-cover shadow-xl ring-1 ring-black/10 transition group-hover:scale-[1.03]"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700">
          {getMainCategory(book)}
        </p>

        <Link href={`/catalog/${book.slug}`} className="mt-2 block">
          <h2 className="line-clamp-2 text-base font-black leading-tight text-slate-950 transition group-hover:text-brand-700">
            {book.title}
          </h2>
        </Link>

        <p className="mt-2 line-clamp-1 text-xs text-slate-500">
          por{" "}
          <span className="font-semibold text-slate-700">
            {getAuthorName(book)}
          </span>
        </p>

        <div className="mt-3 flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className="h-3.5 w-3.5 fill-current" />
          ))}

          <span className="ml-1 text-xs font-semibold text-slate-500">
            Nuevo
          </span>
        </div>

        <p className="mt-3 text-lg font-black text-slate-950">{price}</p>

        <Link
          href={`/catalog/${book.slug}`}
          className="mt-auto inline-flex items-center justify-center rounded-xl bg-[#ffd814] px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-[#f7ca00]"
        >
          Ver libro
        </Link>
      </div>
    </article>
  );
}

/* =========================================================
   TARJETA VERTICAL TIPO AMAZON
========================================================= */

function AmazonStyleBookRow({ book }: { book: Book }) {
  const price = formatPrice(book.price, book.currency);
  const compareAtPrice = formatPrice(book.compare_at_price, book.currency);

  const hasCompareAtPrice =
    typeof book.compare_at_price === "number" &&
    typeof book.price === "number" &&
    book.compare_at_price > book.price;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="grid gap-0 md:grid-cols-[190px_1fr_230px]">
        <Link
          href={`/catalog/${book.slug}`}
          className="flex items-center justify-center bg-slate-100 p-5"
        >
          <img
            src={getCover(book)}
            alt={book.title}
            className="aspect-[2/3] w-full max-w-[145px] rounded-lg object-cover shadow-xl ring-1 ring-black/10"
          />
        </Link>

        <div className="space-y-3 p-5">
          <Link href={`/catalog/${book.slug}`}>
            <h2 className="line-clamp-2 text-xl font-black leading-tight text-slate-950 hover:text-brand-700">
              {book.title}
            </h2>
          </Link>

          {book.subtitle ? (
            <p className="line-clamp-2 text-sm leading-6 text-slate-600">
              {book.subtitle}
            </p>
          ) : null}

          <p className="text-sm text-slate-500">
            por{" "}
            <span className="font-semibold text-slate-800">
              {getAuthorName(book)}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              <Star className="mr-1 h-3.5 w-3.5 fill-current" />
              Disponible
            </span>

            <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              {getCategoryText(book)}
            </span>

            {book.formats?.[0] ? (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {book.formats[0]}
              </span>
            ) : null}
          </div>

          <p className="line-clamp-3 text-sm leading-7 text-slate-700">
            {getDescription(book)}
          </p>

          {book.keywords && book.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
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

        <aside className="flex flex-col justify-between border-t border-slate-200 p-5 md:border-l md:border-t-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Precio
            </p>

            <p className="mt-2 text-2xl font-black text-slate-950">{price}</p>

            {hasCompareAtPrice ? (
              <p className="mt-1 text-sm text-slate-400 line-through">
                {compareAtPrice}
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Compra segura, fragmento disponible y lectura digital cuando el
              libro tenga muestra generada.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffd814] px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-[#f7ca00]"
            >
              <ShoppingCart className="h-4 w-4" />
              Comprar / leer
            </Link>

            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Ver detalles
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

/* =========================================================
   PÁGINA PRINCIPAL
========================================================= */

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [books, categories] = await Promise.all([
    getBooks(),
    getBookCategories(),
  ]);

  const selectedCategory = searchParams?.category?.trim() || "";
  const query = searchParams?.q?.trim() || "";

  const filteredBooks = filterBooks({
    books,
    selectedCategory,
    query,
  });

  const featuredBooks = filteredBooks.slice(0, 5);
  const remainingBooks = filteredBooks.slice(5);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Catálogo"
            title="Libros listos para vender en serio"
            description="Explora libros como en un marketplace: destacados arriba, resultados ordenados debajo y filtros simples para encontrar rápido lo que buscas."
          />

          <form className="mt-8 grid gap-3 lg:grid-cols-[1fr_260px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar por título, autor, categoría o palabra clave..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
              />
            </label>

            <select
              name="category"
              defaultValue={selectedCategory}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
            >
              <option value="">Todas las categorías</option>

              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
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

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                !selectedCategory
                  ? "border-accent-200 bg-accent-50 text-accent-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              Todo
            </Link>

            {categories.slice(0, 12).map((category) => {
              const active = selectedCategory === category;

              return (
                <Link
                  key={category}
                  href={`/catalog?category=${encodeURIComponent(category)}`}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-accent-200 bg-accent-50 text-accent-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  }`}
                >
                  {category}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {filteredBooks.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-panel">
            <BookOpen className="mx-auto h-12 w-12 text-slate-400" />

            <h2 className="mt-4 text-xl font-black text-slate-950">
              No hay libros para mostrar
            </h2>

            <p className="mt-2 text-slate-600">
              {selectedCategory
                ? `No hay libros en la categoría "${selectedCategory}".`
                : "Todavía no hay libros publicados en el catálogo."}
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-panel">
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                    Destacados
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    Cinco libros en vitrina horizontal
                  </h2>
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  {featuredBooks.length} destacados
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                {featuredBooks.map((book) => (
                  <FeaturedBookCard key={book.id} book={book} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                    Resultados
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    Más libros para explorar
                  </h2>
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  {remainingBooks.length} libros debajo
                </p>
              </div>

              {remainingBooks.length > 0 ? (
                <div className="space-y-5">
                  {remainingBooks.map((book) => (
                    <AmazonStyleBookRow key={book.id} book={book} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-panel">
                  No hay más libros debajo de la vitrina principal.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}