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
      <div className="commercial-card overflow-hidden rounded-[30px] p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#155eef]">
            <Tags className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#155eef]">
              Explorar por tema
            </p>
            <h2 className="font-black text-[#07111f]">Categorías</h2>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Encuentra rápidamente el tipo de lectura que estás buscando.
        </p>

        <div className="mt-5 border-t border-slate-200/70 pt-4">
          <Link
            href={getCatalogHref({ query })}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition ${
              !selectedCategory
                ? "bg-[#07111f] text-white shadow-[0_12px_28px_rgba(7,17,31,0.16)]"
                : "text-slate-700 hover:bg-blue-50 hover:text-[#155eef]"
            }`}
          >
            <span>Todos los libros</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              !selectedCategory
                ? "bg-white/15 text-white"
                : "bg-slate-100 text-slate-500"
            }`}>
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
                      ? "bg-blue-50 font-black text-[#155eef] ring-1 ring-blue-100"
                      : "font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#155eef]"
                  }`}
                >
                  <span className="line-clamp-1">{category.label}</span>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white text-[#155eef]"
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
          <div className="mt-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#155eef]">
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
              className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#155eef] hover:underline"
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
    <article className="group commercial-card overflow-hidden rounded-[30px] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_32px_76px_rgba(21,94,239,0.13)]">
      <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)_220px]">
        <Link
          href={`/catalog/${book.slug}`}
          className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e7f0ff] via-white to-[#e8fbff] p-6"
        >
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-300/25 blur-2xl" />
          <img
            src={getCover(book)}
            alt={book.title}
            className="book-cover-shadow relative aspect-[2/3] w-full max-w-[140px] rounded-r-lg rounded-l-sm object-cover transition duration-500 group-hover:-translate-y-1 group-hover:rotate-1 group-hover:scale-[1.025]"
          />
        </Link>

        <div className="space-y-3 p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#155eef]">
            {getMainCategory(book)}
          </p>

          <Link href={`/catalog/${book.slug}`}>
            <h2 className="line-clamp-2 text-2xl font-black leading-tight tracking-[-0.025em] text-[#07111f] hover:text-[#155eef]">
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
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <Star className="mr-1 h-3.5 w-3.5" />
              Disponible
            </span>

            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#155eef]">
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

        <aside className="flex flex-col justify-between border-t border-slate-200/80 bg-slate-50/60 p-6 md:border-l md:border-t-0">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Precio
            </p>

            <p className="mt-2 text-2xl font-black text-[#07111f]">{price}</p>

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
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-4 py-3.5 text-sm font-black text-white shadow-[0_12px_26px_rgba(21,94,239,0.25)] transition hover:-translate-y-0.5 hover:bg-[#2b78ff]"
            >
              <ShoppingCart className="h-4 w-4" />
              Comprar / leer
            </Link>

            <Link
              href={`/catalog/${book.slug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-[#155eef]"
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
    <main className="min-h-screen">
      <section className="commercial-dark commercial-grid commercial-shine relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <BookOpen className="h-3.5 w-3.5" />
              Catálogo editorial
            </p>
            <h1 className="mt-5 text-balance text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Encuentra tu próxima gran lectura.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Explora títulos independientes, revisa su muestra y compra con
              seguridad desde una sola plataforma.
            </p>
          </div>

          <form className="mt-9 grid max-w-4xl gap-3 rounded-[26px] border border-white/15 bg-white/10 p-2 backdrop-blur-xl sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar por título, autor, categoría o palabra clave..."
                className="w-full rounded-[20px] border border-white/20 bg-white py-4 pl-12 pr-4 text-sm text-[#07111f] shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-300/20"
              />
            </label>

            {selectedCategory ? (
              <input type="hidden" name="category" value={selectedCategory} />
            ) : null}

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#ffbf3f] px-7 py-4 text-sm font-black text-[#07111f] transition hover:-translate-y-0.5 hover:bg-[#ffcf68]"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-slate-200">
              {filteredBooks.length} resultados
            </span>

            {selectedCategory ? (
              <Link
                href={getCatalogHref({ query })}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 font-bold text-cyan-100"
              >
                <X className="h-4 w-4" />
                {selectedCategory}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[285px_minmax(0,1fr)] lg:px-8 lg:py-16">
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
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#155eef]">
                Resultados
              </p>

              <h2 className="mt-1 text-3xl font-black tracking-tight text-[#07111f]">
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
            <div className="commercial-card rounded-[32px] p-10 text-center">
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
                className="premium-button mt-5 bg-[#155eef] text-sm text-white"
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
