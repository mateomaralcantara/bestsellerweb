import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import PayoutRequestForm from "@/components/dashboard/finance/PayoutRequestForm";
import { getCurrentFinanceData } from "@/lib/finance/server";

export const dynamic = "force-dynamic";

export default async function AuthorFinancePage() {
  const data = await getCurrentFinanceData({ limit: 100, role: "author" });

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">
        Autor
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        RegalÃ­as y ventas
      </h2>

      <div className="mt-7">
        <FinanceSummaryCards summaries={data.summaries} mode="author" />
      </div>

      <div className="mt-7">
        <PayoutRequestForm roleContext="author" />
      </div>

      <section className="mt-8">
        <h3 className="mb-4 text-xl font-black text-slate-950">
          HistÃ³rico de regalÃ­as
        </h3>
        <FinanceHistory rows={data.ledger} />
      </section>
    </div>
  );
}