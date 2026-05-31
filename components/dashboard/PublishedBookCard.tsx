import Link from "next/link";
import { BookOpen, Tags } from "lucide-react";

type PublishedBookCardProps = {
  book: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    status: string;

    primary_niche?: string | null;
    primary_category?: string | null;
    secondary_category?: string | null;
    keywords?: string[] | null;
  };
};

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    published: "Publicado",
    approved: "Aprobado",
    under_review: "En evaluación",
    draft: "Borrador",
    rejected: "Rechazado",
  };

  return labels[status] || status;
}

function getStatusClassName(status: string) {
  const classes: Record<string, string> = {
    published: "bg-emerald-600 text-white",
    approved: "bg-blue-600 text-white",
    under_review: "bg-amber-500 text-white",
    draft: "bg-slate-700 text-white",
    rejected: "bg-red-600 text-white",
  };

  return classes[status] || "bg-slate-700 text-white";
}

export default function PublishedBookCard({ book }: PublishedBookCardProps) {
  const hasCategory = Boolean(book.primary_niche || book.primary_category);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <BookOpen className="h-8 w-8" />
            Sin portada
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow ${getStatusClassName(
              book.status
            )}`}
          >
            {getStatusLabel(book.status)}
          </span>
        </div>

        {book.primary_category ? (
          <div className="absolute bottom-3 left-3 right-3">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              <Tags className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{book.primary_category}</span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold text-slate-900">
            {book.title}
          </h3>

          {hasCategory ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {book.primary_niche ? (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                  {book.primary_niche}
                </span>
              ) : null}

              {book.primary_category ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  {book.primary_category}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              Sin categoría visible
            </p>
          )}

          {book.secondary_category ? (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
              <strong>Subcategoría:</strong> {book.secondary_category}
            </p>
          ) : null}

          {book.keywords && book.keywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {book.keywords.slice(0, 4).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-sm text-slate-500">
            Publicado y listo para gestión desde tu panel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Ver libro
          </Link>

          <Link
            href={`/dashboard/books/${book.id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Administrar
          </Link>
        </div>
      </div>
    </article>
  );
}