import Link from "next/link";

type PublishedBookCardProps = {
  book: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    status: string;
  };
};

export default function PublishedBookCard({ book }: PublishedBookCardProps) {
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
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Sin portada
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
            {book.status}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold text-slate-900">
            {book.title}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Publicado y listo para gestión desde tu panel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Ver público
          </Link>

          <Link
            href={`/dashboard/books/${book.id}/edit`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Editar
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