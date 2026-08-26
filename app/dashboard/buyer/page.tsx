import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import { getCurrentFinanceData } from "@/lib/finance/server";

export const dynamic = "force-dynamic";
export default async function BuyerFinancePage() {
  const data = await getCurrentFinanceData({limit:100,role:"customer"});
  return <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Comprador</p><h2 className="mt-2 text-3xl font-black text-slate-950">Compras y beneficios</h2><div className="mt-7"><FinanceSummaryCards summaries={data.summaries} mode="buyer" /></div><section className="mt-8"><h3 className="mb-4 text-xl font-black text-slate-950">Historial de compras y créditos</h3><FinanceHistory rows={data.ledger} /></section></div>;
}