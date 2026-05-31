import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Search,
  ShoppingCart,
  Star,
  Tags,
  X,
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

type CatalogAuthor = {
  name?: string | null;
  headline?: string | null;
  display_name?: string | null;
  pen_name?: string | null;
};

type CatalogBook = Book & {
  subtitle?: string | null;
  short_description?: string | null;
  description_short?: string | null;
  description?: string | null;
  long_description?: string | null;
  description_long?: string | null;
  primary_niche?: string | null;
  primary_category?: string | null;
  secondary_category?: string | null;
  categories?: string[] | null;
  keywords?: string[] | null;
  publisher_name?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  currency?: string | null;
  format?: string | null;
  formats?: string[] | null;
  cover_url?: string | null;
  author?: CatalogAuthor | null;
};

type CategoryOption = {
  label: string;
  count: number;
};

const DEFAULT_MARKETPLACE_CATEGORIES = [
  "Negocios y emprendimiento",
  "Marketing y ventas",
  "Finanzas personales",
  "Desarrollo personal",
  "Tecnología",
  "Inteligencia artificial",
  "Educación",
  "Salud y bienestar",
  "Espiritualidad",
  "Cristiano / Fe",
  "Biografía / Memorias",
  "Historia",
  "Política y sociedad",
  "Romance",
  "Ficción",
  "Misterio / Thriller",
  "Infantil / Juvenil",
  "Académico / Profesional",
  "Periodismo",
  "Derecho",
  "Migración",
  "Psicología",
  "Autoayuda",
  "Literatura dominicana",
];

/* =========================================================
   HELPERS
========================================================= */

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAuthorName(book: CatalogBook) {
  const author = book.author as CatalogAuthor | null | undefined;

  return (
    author?.display_name ||
    author?.pen_name ||
    author?.name ||
    author?.headline ||
    book.publisher_name ||
    "Autor independiente"
  );
}

function getDescription(book: CatalogBook) {
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

function getCover(book: CatalogBook) {
  return book.cover_url || "/og-image.png";
}

function getBookFormat(book: CatalogBook) {
  return book.formats?.[0] || book.format || "Ebook";
}

function getBookCategoryValues(book: CatalogBook) {
  return [
    ...(book.categories ?? []),
    book.primary_category,
    book.primary_niche,
    book.secondary_category,
  ]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function getMainCategory(book: CatalogBook) {
  return getBookCategoryValues(book)[0] || "General";
}

function getCategoryText(book: CatalogBook) {
  const categories = getBookCategoryValues(book);

  if (categories.length > 0) {
    return categories.slice(0, 3).join(" · ");
  }

  return "Catálogo general";
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

function getCatalogHref({
  category,
  query,
}: {
  category?: string;
  query?: string;
}) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (category?.trim()) {
    params.set("category", category.trim());
  }

  const queryString = params.toString();

  return queryString ? `/catalog?${queryString}` : "/catalog";
}

function matchesCategory(book: CatalogBook, selectedCategory: string) {
  if (!selectedCategory) return true;

  const selected = normalize(selectedCategory);

  return getBookCategoryValues(book).some((category) => {
    return normalize(category) === selected;
  });
}

function matchesSearch(book: CatalogBook, query: string) {
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

  return normalize(searchable).includes(normalize(query));
}

function filterBooks({
  books,
  selectedCategory,
  query,
}: {
  books: CatalogBook[];
  selectedCategory: string;
  query: string;
}) {
  return books.filter((book) => {
    return matchesCategory(book, selectedCategory) && matchesSearch(book, query);
  });
}

function getSidebarCategories({
  books,
  baseCategories,
}: {
  books: CatalogBook[];
  baseCategories: string[];
}) {
  const categoriesByKey = new Map<string, CategoryOption>();

  function addCategory(label: string, count = 0) {
    const cleanLabel = label.trim();
    const key = normalize(cleanLabel);

    if (!key) return;

    const current = categoriesByKey.get(key);

    categoriesByKey.set(key, {
      label: current?.label || cleanLabel,
      count: (current?.count ?? 0) + count,
    });
  }

  for (const category of DEFAULT_MARKETPLACE_CATEGORIES) {
    addCategory(category, 0);
  }

  for (const category of baseCategories) {
    addCategory(category, 0);
  }

  for (const book of books) {
    const seenInBook = new Set<string>();

    for (const category of getBookCategoryValues(book)) {
      const key = normalize(category);

      if (!key || seenInBook.has(key)) continue;

      seenInBook.add(key);
      addCategory(category, 1);
    }
  }

  return Array.from(categoriesByKey.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, "es");
  });
}

/* =========================================================
   SIDEBAR IZQUIERDA TIPO AMAZON
========================================================= */

function CategorySidebar({
  categories,
  selectedCategory,
  query,
  totalBooks,
  filteredBooks,
}: {
  categories: CategoryOption[];
  selectedCategory: string;
  query: string;
  totalBooks: number;
  filteredBooks: number;
}) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-brand-700" />
          <h2 className="font-black text-slate-950">Categorías</h2>
        </div>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Filtra el catálogo por departamento editorial, estilo Amazon.
        </p>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <Link
            href={getCatalogHref({ query })}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition ${
              !selectedCategory
                ? "bg-[#ffd814] text-slate-950"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Todos los libros</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">
              {totalBooks}
            </span>
          </Link>

          <div className="mt-2 max-h-[620px] space-y-1 overflow-auto pr-1">
            {categories.map((category) => {
              const active =
                normalize(selectedCategory) === normalize(category.label);

              return (
                <Link
                  key={category.label}
                  href={getCatalogHref({
                    category: category.label,
                    query,
                  })}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    active
                      ? "bg-brand-50 font-black text-brand-800"
                      : "font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-700"
                  }`}
                >
                  <span className="line-clamp-1">{category.label}</span>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white text-brand-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {category.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {selectedCategory ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Filtro activo
            </p>

            <p className="mt-1 text-sm font-black text-slate-950">
              {selectedCategory}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              {filteredBooks} libros encontrados.
            </p>

            <Link
              href={getCatalogHref({ query })}
              className="mt-3 inline-flex items-center gap-2 text-xs font-black text-amber-800 hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Quitar categoría
            </Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/* =========================================================
   FILA DE LIBRO TIPO AMAZON
========================================================= */

function AmazonBookRow({ book }: { book: CatalogBook }) {
  const price = formatPrice(book.price, book.currency);
  const compareAtPrice = formatPrice(book.compare_at_price, book.currency);

  const hasCompareAtPrice =
    typeof book.compare_at_price === "number" &&
    typeof book.price === "number" &&
    book.compare_at_price > book.price;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)_220px]">
        <Link
          href={`/catalog/${book.slug}`}
          className="flex items-center justify-center bg-slate-100 p-5"
        >
          <img
            src={getCover(book)}
            alt={book.title}
            className="aspect-[2/3] w-full max-w-[140px] rounded-lg object-cover shadow-xl ring-1 ring-black/10"
          />
        </Link>

        <div className="space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-700">
            {getMainCategory(book)}
          </p>

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

            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {getBookFormat(book)}
            </span>
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
              Compra segura, fragmento disponible y lectura digital desde el
              catálogo.
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
  const [rawBooks, rawCategories] = await Promise.all([
    getBooks(),
    getBookCategories(),
  ]);

  const books = rawBooks as CatalogBook[];
  const baseCategories = rawCategories as string[];

  const selectedCategory = searchParams?.category?.trim() || "";
  const query = searchParams?.q?.trim() || "";

  const sidebarCategories = getSidebarCategories({
    books,
    baseCategories,
  });

  const filteredBooks = filterBooks({
    books,
    selectedCategory,
    query,
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Catálogo"
            title="Libros listos para vender en serio"
            description="Explora libros por categoría, búsqueda y resultados tipo marketplace."
          />

          <form className="mt-8 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar por título, autor, categoría o palabra clave..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
              />
            </label>

            {selectedCategory ? (
              <input type="hidden" name="category" value={selectedCategory} />
            ) : null}

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-4 text-sm font-bold text-white transition hover:opacity-90"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
              {filteredBooks.length} resultados
            </span>

            {selectedCategory ? (
              <Link
                href={getCatalogHref({ query })}
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 font-bold text-amber-800"
              >
                <X className="h-4 w-4" />
                {selectedCategory}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[285px_minmax(0,1fr)] lg:px-8">
        <CategorySidebar
          categories={sidebarCategories}
          selectedCategory={selectedCategory}
          query={query}
          totalBooks={books.length}
          filteredBooks={filteredBooks.length}
        />

        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent-700">
                Resultados
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedCategory
                  ? `Libros en ${selectedCategory}`
                  : "Todos los libros"}
              </h2>
            </div>

            <p className="text-sm font-semibold text-slate-500">
              {filteredBooks.length} libros visibles
            </p>
          </div>

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

              <Link
                href="/catalog"
                className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white"
              >
                Ver todo el catálogo
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredBooks.map((book) => (
                <AmazonBookRow key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}