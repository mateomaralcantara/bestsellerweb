import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublishedBookCard from "@/components/dashboard/PublishedBookCard";

export const dynamic = "force-dynamic";

type PublishedBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  created_at: string | null;
};

export default async function PublishedBooksPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Libros publicados</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Debes iniciar sesión para ver tus libros publicados.
        </p>
      </main>
    );
  }

  const { data: booksData, error: booksError } = await supabase
    .from("books")
    .select("id, title, slug, cover_url, status, created_at")
    .eq("status", "published")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (booksError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Libros publicados</h1>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error cargando libros: {booksError.message}
        </p>
      </main>
    );
  }

  const books: PublishedBook[] = booksData ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tus libros publicados</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aquí ves únicamente los libros publicados de tu cuenta.
          </p>
        </div>

        <Link
          href="/dashboard/books/new"
          className="rounded-xl bg-black px-4 py-2 text-white"
        >
          Subir nuevo libro
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          No tienes libros publicados todavía.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <PublishedBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}