import Link from "next/link";
import {
  ArrowUpRight,
  BadgeDollarSign,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
      <section className="mt-10 rounded-[26px] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-sm text-amber-900">
        El Centro Financiero estará disponible cuando se aplique la migración
        financiera en Supabase.
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="relative mb-5 overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,#020617_0%,#0f172a_55%,#063244_100%)] p-5 text-white shadow-[0_24px_70px_-40px_rgba(2,6,23,0.8)] sm:p-6">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 shadow-lg shadow-emerald-500/20">
              <BadgeDollarSign className="h-6 w-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                  Centro financiero
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  <ShieldCheck className="h-3 w-3" />
                  Ledger protegido
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Tu dinero, claro y en movimiento
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Beneficios, saldo disponible, ganancias pendientes, regalías y
                comisiones en una sola vista.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/finance"
            className="group inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.13]"
          >
            <Sparkles className="h-4 w-4 text-emerald-300" />
            Ver finanzas
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      <FinanceSummaryCards summaries={data.summaries} />

      <div className="mt-6">
        <FinanceHistory rows={data.ledger} />
      </div>
    </section>
  );
}
