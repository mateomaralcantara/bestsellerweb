import Link from "next/link";
import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import { getCurrentFinanceData } from "@/lib/finance/server";
export default async function DashboardFinanceStrip() {
  let data: Awaited<ReturnType<typeof getCurrentFinanceData>> | null = null;

  try {
    data = await getCurrentFinanceData({ limit: 6 });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        El Centro Financiero estar&aacute; disponible cuando se aplique la migraci&oacute;n financiera en Supabase.
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Centro financiero
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Beneficios e hist&oacute;rico
          </h2>
        </div>

        <Link
          href="/dashboard/finance"
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
        >
          Ver finanzas
        </Link>
      </div>

      <FinanceSummaryCards summaries={data.summaries} />

      <div className="mt-6">
        <FinanceHistory rows={data.ledger} />
      </div>
    </section>
  );
}