import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  BookOpen,
  Download,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getAdminAccess } from "@/lib/admin-access";
import {
  getActivePurchaseRows,
  type ActivePurchaseRow,
} from "@/lib/admin-purchases";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

type UserPurchaseGroup = {
  userId: string;
  userName: string;
  userEmail: string | null;
  purchases: ActivePurchaseRow[];
  latestPurchaseAt: string | null;
};

function readSearch(searchParams?: { q?: string | string[] }) {
  const raw = searchParams?.q;
  return (Array.isArray(raw) ? raw[0] : raw || "").trim().slice(0, 120);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function filterPurchases(rows: ActivePurchaseRow[], search: string) {
  if (!search) return rows;

  const needle = normalizeSearch(search);

  return rows.filter((row) =>
    normalizeSearch(
      [
        row.userName,
        row.userEmail,
        row.userId,
        row.bookTitle,
        row.paymentReference,
        row.providerOrderId,
      ]
        .filter(Boolean)
        .join(" ")
    ).includes(needle)
  );
}

function groupByUser(rows: ActivePurchaseRow[]): UserPurchaseGroup[] {
  const groups = new Map<string, UserPurchaseGroup>();

  for (const row of rows) {
    const existing = groups.get(row.userId);

    if (existing) {
      existing.purchases.push(row);
      continue;
    }

    groups.set(row.userId, {
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      purchases: [row],
      latestPurchaseAt: row.paidAt,
    });
  }

  return [...groups.values()].sort((left, right) => {
    const leftTime = left.latestPurchaseAt
      ? new Date(left.latestPurchaseAt).getTime()
      : 0;
    const rightTime = right.latestPurchaseAt
      ? new Date(right.latestPurchaseAt).getTime()
      : 0;

    return rightTime - leftTime;
  });
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(date);
}

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || !Number.isFinite(amount)) return "No registrado";

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function buildCurrencyTotals(rows: ActivePurchaseRow[]) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.amountPaid === null || !Number.isFinite(row.amountPaid)) continue;
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountPaid);
  }

  if (totals.size === 0) return "Sin montos registrados";

  return [...totals.entries()]
    .map(([currency, amount]) => formatAmount(amount, currency))
    .join(" · ");
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
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        {icon}
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-2xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function AccessDenied() {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950">
      <ShieldCheck className="h-10 w-10" />
      <h1 className="mt-5 text-2xl font-black">Acceso administrativo requerido</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6">
        Tu sesión está activa, pero no tiene asignado el rol de administrador.
        Ningún dato de compras fue cargado.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-xl bg-amber-950 px-4 py-2 text-sm font-bold text-white"
      >
        Volver al dashboard
      </Link>
    </section>
  );
}

export default async function PurchasesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const access = await getAdminAccess();

  if (!access.user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/purchases")}`);
  }

  if (!access.isAdmin) {
    return <AccessDenied />;
  }

  let purchases: ActivePurchaseRow[] = [];
  let loadError: string | null = null;

  try {
    purchases = await getActivePurchaseRows();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "No se pudo cargar el registro.";
  }

  const search = readSearch(resolvedSearchParams);
  const visiblePurchases = filterPurchases(purchases, search);
  const groups = groupByUser(visiblePurchases);
  const uniqueBooks = new Set(visiblePurchases.map((row) => row.bookId)).size;

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            Administración · Acceso protegido
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Compras activas por usuario
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Fuente de acceso: book_purchases. Las compras revocadas, canceladas o
            reembolsadas quedan fuera de este registro.
          </p>
        </div>

        <Link
          href="/api/admin/purchases/export"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Descargar CSV
        </Link>
      </header>

      {loadError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <strong>Error cargando compras:</strong> {loadError}
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Usuarios compradores"
          value={groups.length}
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Accesos activos"
          value={visiblePurchases.length}
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Libros diferentes"
          value={uniqueBooks}
        />
        <StatCard
          icon={<BadgeDollarSign className="h-5 w-5" />}
          label="Ingresos activos"
          value={buildCurrencyTotals(visiblePurchases)}
        />
      </div>

      <form method="get" className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar compras</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar por usuario, correo, libro u orden PayPal"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
        <button
          type="submit"
          className="h-12 rounded-2xl bg-emerald-700 px-6 text-sm font-bold text-white transition hover:bg-emerald-800"
        >
          Buscar
        </button>
        {search ? (
          <Link
            href="/dashboard/purchases"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-bold text-slate-700"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="mt-8 space-y-6">
        {!loadError && groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
            {search
              ? "No hay compras activas que coincidan con la búsqueda."
              : "Todavía no existen compras activas registradas."}
          </div>
        ) : null}

        {groups.map((group) => (
          <article
            key={group.userId}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h2 className="font-black text-slate-950">{group.userName}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {group.userEmail || "Correo no disponible"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  {group.userId}
                </p>
              </div>

              <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">
                {group.purchases.length} {group.purchases.length === 1 ? "libro" : "libros"}
              </div>
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Libro</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Pago</th>
                    <th className="px-5 py-3">Proveedor</th>
                    <th className="px-5 py-3">Referencia</th>
                    <th className="px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.purchases.map((purchase) => (
                    <tr key={purchase.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {purchase.coverUrl ? (
                            <img
                              src={purchase.coverUrl}
                              alt=""
                              className="h-14 w-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-100">
                              <BookOpen className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="max-w-xs font-bold text-slate-900">
                              {purchase.bookTitle}
                            </p>
                            {purchase.bookSlug ? (
                              <Link
                                href={`/catalog/${purchase.bookSlug}`}
                                className="mt-1 inline-flex text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                Ver libro
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(purchase.paidAt)}
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900">
                        {formatAmount(purchase.amountPaid, purchase.currency)}
                      </td>
                      <td className="px-5 py-4 uppercase text-slate-600">
                        {purchase.paymentProvider || "No registrado"}
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[190px] truncate font-mono text-xs text-slate-600" title={purchase.paymentReference || purchase.providerOrderId || undefined}>
                          {purchase.paymentReference ||
                            purchase.providerOrderId ||
                            "No registrada"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">
                          Activa
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
