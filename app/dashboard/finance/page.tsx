import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import PayoutRequestForm from "@/components/dashboard/finance/PayoutRequestForm";
import { getCurrentFinanceData } from "@/lib/finance/server";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const data = await getCurrentFinanceData({ limit: 100 });

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        Centro financiero
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Beneficios y movimientos
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Consolidado de comprador, autor y afiliado-vendedor.
      </p>

      <div className="mt-7">
        <FinanceSummaryCards summaries={data.summaries} />
      </div>

      <div className="mt-7">
        <PayoutRequestForm allowRoleSelection />
      </div>

      <section className="mt-8">
        <h3 className="mb-4 text-xl font-black text-slate-950">
          Historial financiero
        </h3>
        <FinanceHistory rows={data.ledger} />
      </section>
    </div>
  );
}