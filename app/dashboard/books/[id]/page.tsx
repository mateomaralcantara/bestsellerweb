// ============================================
// ARCHIVO: app/dashboard/books/[id]/page.tsx
// ============================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    id: string;
  };
};

type BookDetail = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  status: string | null;
  description_short: string | null;
  description_long: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
  language_code: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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

function formatKeywords(keywords: string[] | null) {
  if (!keywords || keywords.length === 0) return "Sin palabras clave";
  return keywords.join(", ");
}

export default async function BookDashboardDetailPage({ params }: PageProps) {
  const bookId = decodeURIComponent(params.id || "").trim();

  if (!bookId) {
    redirect("/dashboard/books/published");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth?next=${encodeURIComponent(`/dashboard/books/${bookId}`)}`
    );
  }

  const { data: bookData, error } = await supabaseAdmin
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
      description_long,
      primary_niche,
      primary_category,
      secondary_category,
      keywords,
      language_code,
      owner_user_id,
      created_at,
      updated_at
    `
    )
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error cargando libro: ${error.message}`);
  }

  if (!bookData) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-xl font-black">Libro no encontrado</h1>

          <p className="mt-2 text-sm">
            No se encontró el libro solicitado en tu dashboard.
          </p>

          <Link
            href="/dashboard/books/published"
            className="mt-5 inline-flex rounded-2xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
          >
            Volver a mis libros
          </Link>
        </div>
      </main>
    );
  }

  const book = bookData as BookDetail;

  if (book.owner_user_id && book.owner_user_id !== user.id) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h1 className="text-xl font-black">Sin permiso</h1>

          <p className="mt-2 text-sm">Este libro no pertenece a tu cuenta.</p>

          <Link
            href="/dashboard/books/published"
            className="mt-5 inline-flex rounded-2xl bg-amber-700 px-4 py-2 text-sm font-bold text-white"
          >
            Volver a mis libros
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="flex flex-col gap-5 rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Panel del libro
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            {book.title}
          </h1>

          {book.subtitle ? (
            <p className="mt-2 text-base text-slate-600">{book.subtitle}</p>
          ) : null}

          <p className="mt-2 text-sm text-slate-500">
            Estado:{" "}
            <span className="font-semibold text-slate-800">
              {getStatusLabel(book.status)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/books/${book.id}/edit`}
            className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Editar datos de publicación
          </Link>

          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Ver público
          </Link>

          <Link
            href="/dashboard/books/published"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full rounded-2xl border border-slate-200"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
              Sin portada
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
              Datos principales
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Autor / sello
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {book.author_name ||
                    book.publisher_name ||
                    "Autor independiente"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Idioma
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {book.language_code || "es"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Nicho
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {book.primary_niche || "Sin nicho"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Categoría
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {book.primary_category || "Sin categoría"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Palabras clave
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatKeywords(book.keywords)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
              Descripción
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              {book.description_short ||
                book.description_long ||
                "Sin descripción registrada."}
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}