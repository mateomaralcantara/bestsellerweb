// app/dashboard/books/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import ManuscriptUploader from "@/components/dashboard/ManuscriptUploader";

export const dynamic = "force-dynamic";

export default async function DashboardBookPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div className="p-6">Debes iniciar sesión para ver este libro.</div>;
  }

  const { data: book, error } = await supabase
    .from("books")
    .select("id, slug, title, owner_user_id")
    .eq("id", params.id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error || !book) {
    return <div className="p-6">No se pudo cargar el libro.</div>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{book.title}</h1>
        <p className="text-sm opacity-70">slug: {book.slug}</p>
      </div>

      <ManuscriptUploader bookId={book.id} slug={book.slug} />
    </main>
  );
}