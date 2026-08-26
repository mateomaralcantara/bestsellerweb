import Link from "next/link";
import FinanceHistory from "@/components/dashboard/finance/FinanceHistory";
import FinanceSummaryCards from "@/components/dashboard/finance/FinanceSummary";
import PayoutRequestForm from "@/components/dashboard/finance/PayoutRequestForm";
import {
  getCurrentAffiliateMetrics,
  getCurrentFinanceData,
} from "@/lib/finance/server";

export const dynamic = "force-dynamic";

export default async function AffiliateFinancePage() {
  const [data, affiliate] = await Promise.all([
    getCurrentFinanceData({ limit: 100, role: "affiliate" }),
    getCurrentAffiliateMetrics(),
  ]);

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.libroseller.com";

  const approved = affiliate.status === "approved";
  const pending = affiliate.status === "pending";
  const rejected = affiliate.status === "rejected";

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
        Afiliado-vendedor
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Comisiones y conversiones
      </h2>

      {approved ? (
        <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-black text-emerald-950">
            CÃ³digo: {affiliate.code}
          </p>
          <p className="mt-2 break-all text-sm text-emerald-900">
            Enlace: {origin}/r/{affiliate.code}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Clicks
              </p>
              <p className="mt-1 text-2xl font-black">{affiliate.clicks}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">
                Ventas
              </p>
              <p className="mt-1 text-2xl font-black">
                {affiliate.conversions}
              </p>
            </div>
          </div>
        </div>
      ) : pending ? (
        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-black">Solicitud de afiliaciÃ³n pendiente</p>
          <p className="mt-2">
            Tu cuenta debe ser aprobada antes de generar comisiones o solicitar
            retiros como afiliado.
          </p>
        </div>
      ) : rejected ? (
        <div className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <p className="font-black">Solicitud de afiliaciÃ³n no aprobada</p>
          <p className="mt-2">
            Puedes revisar el programa de afiliados y presentar una nueva
            solicitud cuando corresponda.
          </p>
          <Link
            href="/affiliates"
            className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"
          >
            Ver programa de afiliados
          </Link>
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
          <p className="font-black">Solicita acceso al programa de afiliados</p>
          <p className="mt-2">
            Las cuentas de afiliado requieren revisiÃ³n y aprobaciÃ³n antes de
            habilitar cÃ³digos, comisiones y retiros.
          </p>
          <Link
            href="/affiliates"
            className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 font-bold text-white"
          >
            Solicitar afiliaciÃ³n
          </Link>
        </div>
      )}

      <div className="mt-7">
        <FinanceSummaryCards summaries={data.summaries} mode="affiliate" />
      </div>

      {approved ? (
        <div className="mt-7">
          <PayoutRequestForm roleContext="affiliate" />
        </div>
      ) : null}

      <section className="mt-8">
        <h3 className="mb-4 text-xl font-black text-slate-950">
          HistÃ³rico de comisiones
        </h3>
        <FinanceHistory rows={data.ledger} />
      </section>
    </div>
  );
}