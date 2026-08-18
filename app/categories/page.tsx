import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Layers3,
  LibraryBig,
  Sparkles,
  Tags,
} from "lucide-react";
import { getBooks } from "@/lib/queries";

type CategoryStat = {
  name: string;
  count: number;
  featuredCount: number;
  latestBookTitle: string | null;
  latestBookSlug: string | null;
  books: {
    id: string;
    title: string;
    slug: string;
    cover_url?: string | null;
  }[];
};

function normalizeCategory(value: string) {
  return value.trim();
}

function buildCategoryStats(books: Awaited<ReturnType<typeof getBooks>>) {
  const map = new Map<string, CategoryStat>();

  for (const book of books) {
    const categories = book.categories?.length
      ? book.categories.map(normalizeCategory).filter(Boolean)
      : ["Sin categoría"];

    for (const category of categories) {
      const current =
        map.get(category) ??
        ({
          name: category,
          count: 0,
          featuredCount: 0,
          latestBookTitle: null,
          latestBookSlug: null,
          books: [],
        } satisfies CategoryStat);

      current.count += 1;

      if (book.is_featured) {
        current.featuredCount += 1;
      }

      if (!current.latestBookTitle) {
        current.latestBookTitle = book.title;
        current.latestBookSlug = book.slug;
      }

      if (current.books.length < 4) {
        current.books.push({
          id: book.id,
          title: book.title,
          slug: book.slug,
          cover_url: book.cover_url,
        });
      }

      map.set(category, current);
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
}

export default async function CategoriesPage() {
  const books = await getBooks();
  const categories = buildCategoryStats(books);

  const totalBooks = books.length;
  const totalCategories = categories.length;
  const topCategory = categories[0] ?? null;

  return (
    <main>
      <section className="commercial-dark commercial-grid commercial-shine relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
            <Tags className="h-4 w-4" />
            Categorías
          </p>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Una lectura para cada interés.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Explora el catálogo por temas y descubre rápidamente los libros que
            mejor conectan contigo.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8 lg:py-20">
        <aside className="space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">
              Panorama editorial
            </p>
            <h2 className="mt-3 text-balance text-3xl font-black tracking-[-0.035em] text-[#07111f] sm:text-4xl">
              Explora por nicho, tema y estilo.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Cada categoría te lleva directamente a los títulos disponibles y
              a sus fichas de compra.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="commercial-card rounded-[26px] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <LibraryBig className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-950">
                    {totalBooks}
                  </p>
                  <p className="text-sm text-slate-500">Libros publicados</p>
                </div>
              </div>
            </div>

            <div className="commercial-card rounded-[26px] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-950">
                    {totalCategories}
                  </p>
                  <p className="text-sm text-slate-500">Categorías activas</p>
                </div>
              </div>
            </div>

            <div className="editorial-special rounded-[26px] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="line-clamp-1 text-lg font-bold text-slate-950">
                    {topCategory?.name ?? "Sin datos"}
                  </p>
                  <p className="text-sm text-slate-500">Categoría principal</p>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/catalog"
            className="premium-button bg-[#155eef] text-white"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>

        <section className="space-y-5">
          {categories.length === 0 ? (
            <div className="commercial-card rounded-[32px] border-dashed p-10 text-center">
              <Layers3 className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold text-slate-950">
                Todavía no hay categorías
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Cuando tus libros tengan categorías en la metadata, aparecerán
                aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {categories.map((category) => (
                <article
                  key={category.name}
                  className="group commercial-card rounded-[32px] p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_75px_rgba(21,94,239,0.13)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Categoría
                      </p>

                      <h2 className="mt-2 text-2xl font-bold text-slate-950">
                        {category.name}
                      </h2>

                      <p className="mt-2 text-sm text-slate-600">
                        {category.count}{" "}
                        {category.count === 1 ? "libro" : "libros"} disponibles
                        {category.featuredCount > 0
                          ? ` · ${category.featuredCount} destacado${
                              category.featuredCount === 1 ? "" : "s"
                            }`
                          : ""}
                      </p>
                    </div>

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#155eef] transition group-hover:bg-[#155eef] group-hover:text-white">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  </div>

                  {category.latestBookTitle ? (
                    <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Último libro:{" "}
                      <span className="font-semibold text-slate-950">
                        {category.latestBookTitle}
                      </span>
                    </p>
                  ) : null}

                  {category.books.length > 0 ? (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {category.books.map((book) => (
                        <Link
                          key={book.id}
                          href={`/catalog/${book.slug}`}
                          className="group/book overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                          title={book.title}
                        >
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              className="aspect-[3/4] w-full object-cover transition group-hover/book:scale-105"
                            />
                          ) : (
                            <div className="flex aspect-[3/4] items-center justify-center px-2 text-center text-[10px] text-slate-400">
                              Sin portada
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/catalog?category=${encodeURIComponent(
                        category.name
                      )}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#2b78ff]"
                    >
                      Ver libros
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    {category.latestBookSlug ? (
                      <Link
                        href={`/catalog/${category.latestBookSlug}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Último publicado
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
