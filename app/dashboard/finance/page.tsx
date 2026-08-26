import {
  BadgeDollarSign,
  ChartNoAxesCombined,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import PayoutRequestForm from "@/components/dashboard/finance/PayoutRequestForm";
import { getCurrentFinanceData } from "@/lib/finance/server";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const data = await getCurrentFinanceData({ limit: 100 });

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[linear-gradient(135deg,#020617_0%,#0f172a_48%,#063747_100%)] p-6 text-white shadow-[0_30px_80px_-45px_rgba(2,6,23,0.82)] sm:p-8">
        <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.17em] text-emerald-300">
                <BadgeDollarSign className="h-3.5 w-3.5" />
                Centro financiero
              </span>

              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
                Ledger auditable
              </span>
            </div>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Tu dinero.
              <span className="block bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent">
                Más claro que nunca.
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Controla beneficios, ganancias pendientes, regalías, comisiones y
              retiros sin perder de vista ningún movimiento.
            </p>
          </div>

          <div className="grid min-w-[220px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Vista
              </p>
              <p className="mt-1 text-sm font-black">Consolidada</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
              <ChartNoAxesCombined className="h-4 w-4 text-cyan-300" />
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Historial
              </p>
              <p className="mt-1 text-sm font-black">
                {data.ledger.length} mov.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FinanceSummaryCards summaries={data.summaries} />

      <PayoutRequestForm allowRoleSelection />

      <section>
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Timeline
          </p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            Historial financiero
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Entradas, salidas y estados de todos tus movimientos.
          </p>
        </div>

        <FinanceHistory rows={data.ledger} />
      </section>
    </div>
  );
}
