import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, LibraryBig, ShieldCheck } from "lucide-react";
import PurchasedBookCard from "@/components/dashboard/PurchasedBookCard";
import { getActivePurchaseRows } from "@/lib/admin-purchases";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PurchasedBooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth?next=${encodeURIComponent("/dashboard/books/purchased")}`
    );
  }

  let purchases = [] as Awaited<ReturnType<typeof getActivePurchaseRows>>;
  let loadError: string | null = null;

  try {
    purchases = await getActivePurchaseRows({ userId: user.id });
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "No se pudo cargar tu biblioteca.";
  }

  return (
    <main className="space-y-8">
      <header className="rounded-[32px] border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-slate-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-emerald-700">
              <LibraryBig className="h-4 w-4" />
              Tu biblioteca
            </p>
            <h1 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">
              Libros comprados
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Aquí aparecen automáticamente los libros cuyo pago está activo y
              confirmado. Pulsa “Empezar a leer” para abrir el contenido completo.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-700 px-5 py-3 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
              Disponibles
            </p>
            <p className="mt-1 text-3xl font-black">{purchases.length}</p>
          </div>
        </div>
      </header>

      {loadError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-black">No se pudo cargar tu biblioteca</h2>
              <p className="mt-2 text-sm">{loadError}</p>
            </div>
          </div>
        </section>
      ) : null}

      {!loadError && purchases.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Aún no hay libros comprados en esta cuenta
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Las compras se muestran según el usuario que tenía la sesión abierta
            cuando PayPal confirmó el pago.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Explorar catálogo
          </Link>
        </section>
      ) : null}

      {purchases.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {purchases.map((purchase) => (
            <PurchasedBookCard key={purchase.id} purchase={purchase} />
          ))}
        </section>
      ) : null}
    </main>
  );
}
