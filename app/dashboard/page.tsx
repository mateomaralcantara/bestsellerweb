import Link from "next/link";
import { BookText, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublishedBookCard from "@/components/dashboard/PublishedBookCard";

export const dynamic = "force-dynamic";

type SimpleProfile = {
  id: string;
  full_name: string;
  role: string;
};

type PublishedBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  created_at: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          No hay sesión activa. Inicia sesión para entrar al dashboard.
        </div>
      </main>
    );
  }

  const [profileResult, booksResult] = await Promise.all([
    supabase
      .from("profiles_with_roles")
      .select("id, full_name, roles")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("books")
      .select("id, title, slug, cover_url, status, created_at")
      .eq("status", "published")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const { data: profileData } = profileResult;
  const { data: booksData, error: booksError } = booksResult;

  if (booksError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          No se pudieron cargar tus libros: {booksError.message}
        </div>
      </main>
    );
  }

  const profile: SimpleProfile = {
    id: user.id,
    full_name:
      profileData?.full_name ||
      (user.user_metadata?.full_name as string) ||
      user.email ||
      "Usuario",
    role: profileData?.roles?.[0] || "customer",
  };

  const books: PublishedBook[] = booksData ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent-700">
            Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-bold text-brand-800">
            {profile.full_name}
          </h1>

          <p className="mt-3 text-slate-700">
            Estos son tus libros publicados.
          </p>
        </div>

        <div className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
          Rol: {profile.role}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <BookText className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-500">
            Libros publicados
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {books.length}
          </p>
        </div>

        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <UserRound className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-500">
            Usuario
          </p>
          <p className="mt-2 text-lg font-bold text-slate-950">
            {profile.full_name}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-950">
            Tus libros publicados
          </h2>

          <Link
            href="/dashboard/books/new"
            className="rounded-xl bg-black px-4 py-2 text-sm text-white"
          >
            Subir nuevo libro
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            No tienes libros publicados todavía.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <PublishedBookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}