import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { SectionHeading } from "@/components/section-heading";
import { getBookCategories, getBooks } from "@/lib/queries";

type CatalogPageProps = {
  searchParams?: {
    category?: string;
  };
};

export default async function CatalogPage({
  searchParams,
}: CatalogPageProps) {
  const [books, categories] = await Promise.all([
    getBooks(),
    getBookCategories(),
  ]);

  const selectedCategory = searchParams?.category?.trim() || "";

  const filteredBooks = selectedCategory
    ? books.filter((book) => (book.categories ?? []).includes(selectedCategory))
    : books;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Catálogo"
        title="Libros listos para vender en serio"
        description="Página de colección con filtros base, cards premium y espacio para bundles, preventas y promociones por campaña."
      />

      <div className="mt-8 flex flex-wrap gap-3">
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

        {categories.map((category) => {
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

      {filteredBooks.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-panel">
          <h2 className="text-xl font-semibold text-slate-900">
            No hay libros para mostrar
          </h2>
          <p className="mt-2 text-slate-600">
            {selectedCategory
              ? `No hay libros en la categoría "${selectedCategory}".`
              : "Todavía no hay libros publicados en el catálogo."}
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}