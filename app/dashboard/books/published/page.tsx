// ============================================
// ARCHIVO: app/dashboard/books/published/page.tsx
// ============================================

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublishedBook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  status: string | null;
  description_short: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  language_code: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getAuthorName(book: PublishedBook) {
  return book.author_name || book.publisher_name || "Autor independiente";
}

function getStatusLabel(status: string | null) {
  if (!status) return "Sin estado";

  const labels: Record<string, string> = {
    draft: "Borrador",
    under_review: "En evaluación",
    changes_requested: "Cambios solicitados",
    approved: "Aprobado",
    published: "Publicado",
    unlisted: "Oculto",
    archived: "Archivado",
    rejected: "Rechazado",
  };

  return labels[status] || status;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-DO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Sin fecha";
  }
}

function PublishedBookCard({ book }: { book: PublishedBook }) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            width={600}
            height={900}
            sizes="(max-width: 768px) 50vw, 240px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Sin portada
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
            {getStatusLabel(book.status)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold text-slate-900">
            {book.title}
          </h3>

          {book.subtitle ? (
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
              {book.subtitle}
            </p>
          ) : null}

          <p className="mt-2 text-sm font-semibold text-slate-700">
            {getAuthorName(book)}
          </p>

          {book.primary_niche || book.primary_category || book.secondary_category ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {book.primary_niche ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#155eef]">
                  {book.primary_niche}
                </span>
              ) : null}
              {book.primary_category ? (
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                  {book.primary_category}
                </span>
              ) : null}
              {book.secondary_category ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {book.secondary_category}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs font-bold text-amber-700">
              Sin clasificación editorial
            </p>
          )}

          <p className="mt-3 line-clamp-2 text-sm text-slate-500">
            {book.description_short ||
              "Publicado y listo para gestión desde tu panel."}
          </p>

          <p className="mt-3 text-xs text-slate-400">
            Actualizado: {formatDate(book.updated_at || book.created_at)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href={`/dashboard/books/${book.id}/edit`}
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            Editar datos
          </Link>

          <Link
            href={`/dashboard/books/${book.id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver panel
          </Link>

          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver público
          </Link>

          <Link
            href={`/catalog/${book.slug}/preview`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Preview
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function PublishedBooksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth?next=${encodeURIComponent("/dashboard/books/published")}`
    );
  }

  const { data: books, error } = await supabaseAdmin
    .from("books")
    .select(
      `
      id,
      slug,
      title,
      subtitle,
      author_name,
      publisher_name,
      cover_url,
      status,
      description_short,
      primary_niche,
      primary_category,
      secondary_category,
      language_code,
      created_at,
      updated_at
    `
    )
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Error cargando libros publicados: ${error.message}`);
  }

  const publishedBooks = (books ?? []) as PublishedBook[];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Dashboard editorial
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Mis libros
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Desde aquí puedes ver, previsualizar y editar los datos de
            publicación de cada libro: título, nicho, categoría, precio, SEO,
            portada y EPUB.
          </p>
        </div>

        <Link
          href="/dashboard/books/new"
          className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Subir nuevo libro
        </Link>
      </header>

      {publishedBooks.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-2xl font-black text-slate-950">
            Todavía no tienes libros
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Cuando subas tu primer libro, aquí aparecerá la opción de editar los
            datos de publicación.
          </p>

          <Link
            href="/dashboard/books/new"
            className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Subir libro
          </Link>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {publishedBooks.map((book) => (
            <PublishedBookCard key={book.id} book={book} />
          ))}
        </section>
      )}
    </main>
  );
}