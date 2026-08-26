import Link from "next/link";
import DashboardFinanceStrip from "@/components/dashboard/finance/DashboardFinanceStrip";
import { BookText, LibraryBig, Tags, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublishedBookCard from "@/components/dashboard/PublishedBookCard";
import PurchasedBookCard from "@/components/dashboard/PurchasedBookCard";
import {
  getActivePurchaseRows,
  type ActivePurchaseRow,
} from "@/lib/admin-purchases";

export const dynamic = "force-dynamic";

type ProfileWithRoles = {
  id: string;
  full_name: string | null;
  roles: string[] | null;
};

type PublishedBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  created_at: string | null;

  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
};

function getProfileName(params: {
  profile: ProfileWithRoles | null;
  userEmail?: string | null;
  userMetadataName?: unknown;
}) {
  const metadataName =
    typeof params.userMetadataName === "string"
      ? params.userMetadataName.trim()
      : "";

  return (
    params.profile?.full_name?.trim() ||
    metadataName ||
    params.userEmail ||
    "Usuario"
  );
}

function getProfileRole(profile: ProfileWithRoles | null) {
  return profile?.roles?.[0] || "customer";
}

function ErrorBox({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h1 className="font-bold">{title}</h1>
        <p className="mt-2 text-sm">{message}</p>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        {icon}
      </div>

      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

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

  const purchasesPromise: Promise<{
    data: ActivePurchaseRow[];
    error: string | null;
  }> = getActivePurchaseRows({ userId: user.id })
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: [],
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los libros comprados.",
    }));

  const [profileResult, booksResult, purchasesResult] = await Promise.all([
    supabase
      .from("profiles_with_roles")
      .select("id, full_name, roles")
      .eq("id", user.id)
      .maybeSingle<ProfileWithRoles>(),

    supabase
      .from("books")
      .select(`
        id,
        title,
        slug,
        cover_url,
        status,
        created_at,
        primary_niche,
        primary_category,
        secondary_category,
        keywords
      `)
      .eq("status", "published")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<PublishedBook[]>(),

    purchasesPromise,
  ]);

  if (profileResult.error) {
    return (
      <ErrorBox
        title="No se pudo cargar tu perfil"
        message={profileResult.error.message}
      />
    );
  }

  if (booksResult.error) {
    return (
      <ErrorBox
        title="No se pudieron cargar tus libros"
        message={booksResult.error.message}
      />
    );
  }

  const profileData = profileResult.data ?? null;
  const books = booksResult.data ?? [];
  const purchasedBooks = purchasesResult.data;

  const profile = {
    id: user.id,
    full_name: getProfileName({
      profile: profileData,
      userEmail: user.email,
      userMetadataName: user.user_metadata?.full_name,
    }),
    role: getProfileRole(profileData),
  };

  const booksWithCategory = books.filter(
    (book) => book.primary_niche && book.primary_category
  ).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-accent-700">
            Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-black text-brand-800">
            {profile.full_name}
          </h1>

          <p className="mt-3 text-slate-700">
            Tus publicaciones y tus libros comprados, juntos y listos para
            gestionar o leer.
          </p>
        </div>

        <div className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700">
          Rol: {profile.role}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BookText className="h-5 w-5" />}
          label="Libros publicados"
          value={books.length}
        />

        <StatCard
          icon={<LibraryBig className="h-5 w-5" />}
          label="Libros comprados"
          value={purchasedBooks.length}
        />

        <StatCard
          icon={<Tags className="h-5 w-5" />}
          label="Con categoría"
          value={booksWithCategory}
        />

        <StatCard
          icon={<UserRound className="h-5 w-5" />}
          label="Usuario"
          value={profile.full_name}
        />
      </div>
      <DashboardFinanceStrip />



      {purchasesResult.error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <strong>No se pudo cargar tu biblioteca:</strong>{" "}
          {purchasesResult.error}
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Tus libros publicados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Libros que publicaste y administras como autor.
              </p>
            </div>

            <Link
              href="/dashboard/books/published"
              className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              Ver publicados
            </Link>
          </div>

          {books.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
              No tienes libros publicados todavía.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {books.slice(0, 4).map((book) => (
                <PublishedBookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                Tus libros comprados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Pagos confirmados disponibles para lectura completa.
              </p>
            </div>

            <Link
              href="/dashboard/books/purchased"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Ver comprados
            </Link>
          </div>

          {!purchasesResult.error && purchasedBooks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
              No hay compras activas asociadas a esta cuenta.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {purchasedBooks.slice(0, 4).map((purchase) => (
                <PurchasedBookCard
                  key={purchase.id}
                  purchase={purchase}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
