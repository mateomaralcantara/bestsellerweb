import Link from "next/link";
import {
  BookOpenCheck,
  BookText,
  LibraryBig,
  Sparkles,
  Tags,
  TrendingUp,
  UserRound,
} from "lucide-react";
import DashboardFinanceStrip from "@/components/dashboard/finance/DashboardFinanceStrip";
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
    <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
      <h1 className="font-black">{title}</h1>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

type StatTone = "emerald" | "sky" | "violet" | "amber";

const statStyles: Record<
  StatTone,
  { wrap: string; icon: string; glow: string }
> = {
  emerald: {
    wrap: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-white",
    icon: "bg-emerald-100 text-emerald-700",
    glow: "bg-emerald-400/15",
  },
  sky: {
    wrap: "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-white",
    icon: "bg-sky-100 text-sky-700",
    glow: "bg-sky-400/15",
  },
  violet: {
    wrap: "border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-white",
    icon: "bg-violet-100 text-violet-700",
    glow: "bg-violet-400/15",
  },
  amber: {
    wrap: "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white",
    icon: "bg-amber-100 text-amber-700",
    glow: "bg-amber-400/15",
  },
};

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: StatTone;
}) {
  const style = statStyles[tone];

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-[26px] border p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-35px_rgba(15,23,42,0.55)]",
        style.wrap,
      ].join(" ")}
    >
      <div
        className={[
          "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
          style.glow,
        ].join(" ")}
      />

      <div className="relative">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            style.icon,
          ].join(" ")}
        >
          {icon}
        </div>

        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>

        <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">
          {value}
        </p>
      </div>
    </article>
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
      <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-900">
        No hay sesión activa. Inicia sesión para entrar al dashboard.
      </div>
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
    <div>
      <section className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b2942_100%)] p-6 text-white shadow-[0_30px_80px_-42px_rgba(2,6,23,0.8)] sm:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Dashboard premium
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                Rol · {profile.role}
              </span>
            </div>

            <p className="mt-5 text-sm font-bold text-slate-400">
              Bienvenido de nuevo
            </p>

            <h2 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">
              {profile.full_name}
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Tu ecosistema editorial en una sola vista: publicaciones,
              biblioteca, ganancias, regalías, comisiones y retiros.
            </p>
          </div>

          <Link
            href="/dashboard/finance"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/15 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20"
          >
            <TrendingUp className="h-4 w-4" />
            Ver mis ganancias
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BookText className="h-5 w-5" />}
          label="Libros publicados"
          value={books.length}
          tone="emerald"
        />

        <StatCard
          icon={<LibraryBig className="h-5 w-5" />}
          label="Libros comprados"
          value={purchasedBooks.length}
          tone="sky"
        />

        <StatCard
          icon={<Tags className="h-5 w-5" />}
          label="Con categoría"
          value={booksWithCategory}
          tone="violet"
        />

        <StatCard
          icon={<UserRound className="h-5 w-5" />}
          label="Cuenta"
          value={profile.full_name}
          tone="amber"
        />
      </div>

      <DashboardFinanceStrip />

      {purchasesResult.error ? (
        <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <strong>No se pudo cargar tu biblioteca:</strong>{" "}
          {purchasesResult.error}
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <BookOpenCheck className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.17em]">
                  Mi catálogo
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Tus libros publicados
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Libros que publicaste y administras como autor.
              </p>
            </div>

            <Link
              href="/dashboard/books/published"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Ver publicados
            </Link>
          </div>

          {books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
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

        <section className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sky-700">
                <LibraryBig className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.17em]">
                  Mi biblioteca
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Tus libros comprados
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pagos confirmados disponibles para lectura completa.
              </p>
            </div>

            <Link
              href="/dashboard/books/purchased"
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-800"
            >
              Ver comprados
            </Link>
          </div>

          {!purchasesResult.error && purchasedBooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
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
    </div>
  );
}
