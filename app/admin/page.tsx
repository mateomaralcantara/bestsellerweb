import AdminMetric from "@/components/admin/AdminMetric";
import { getAdminDashboard } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
  }).format(value);
}

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireAdminPage("admin.dashboard");
  const data = await getAdminDashboard();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
        Vista ejecutiva
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Centro de mando
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Usuarios" value={data.users} />
        <AdminMetric label="Autores" value={data.authors} />
        <AdminMetric label="Afiliados" value={data.affiliates} />
        <AdminMetric
          label="Libros"
          value={data.books}
          note={`${data.publishedBooks} publicados`}
        />
        <AdminMetric label="Compras activas" value={data.purchases} />
        <AdminMetric label="Retiros pendientes" value={data.pendingPayouts} />
      </div>

      <section className="mt-8">
        <h3 className="text-xl font-black text-slate-950">
          Panorama financiero
        </h3>
        <div className="mt-4 space-y-4">
          {data.totals.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Todavía no hay movimientos en el ledger.
            </div>
          ) : (
            data.totals.map((row) => (
              <div
                key={row.currency}
                className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-5"
              >
                <AdminMetric
                  label={`Ventas ${row.currency}`}
                  value={money(row.grossSales, row.currency)}
                />
                <AdminMetric
                  label="Regalías"
                  value={money(row.authorRoyalties, row.currency)}
                />
                <AdminMetric
                  label="Afiliados"
                  value={money(row.affiliateCommissions, row.currency)}
                />
                <AdminMetric
                  label="Plataforma"
                  value={money(row.platformRevenue, row.currency)}
                />
                <AdminMetric
                  label="Reembolsos"
                  value={money(row.refunds, row.currency)}
                />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
