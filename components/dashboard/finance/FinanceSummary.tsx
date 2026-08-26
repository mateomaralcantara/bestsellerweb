import type { FinanceSummary } from "@/lib/finance/types";

type Mode = "all" | "author" | "affiliate" | "buyer";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

const zero: FinanceSummary = {
  user_id: "", currency: "USD", benefits_total: 0, author_earnings_total: 0,
  affiliate_earnings_total: 0, available_to_withdraw: 0, pending_earnings: 0,
  author_available: 0, author_pending: 0, affiliate_available: 0,
  affiliate_pending: 0, paid_out_total: 0, buyer_net_spend: 0,
  buyer_benefits_total: 0, refunds_total: 0, credits_discounts_total: 0,
  transactions_count: 0,
};

export default function FinanceSummaryCards({ summaries, mode="all" }: {
  summaries: FinanceSummary[];
  mode?: Mode;
}) {
  const rows = summaries.length > 0 ? summaries : [zero];

  return <div className="space-y-5">{rows.map((s) => {
    const c = s.currency;
    if (mode === "author") return (
      <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Regalías generadas" value={money(s.author_earnings_total,c)} />
        <Card label="Disponible" value={money(s.author_available,c)} />
        <Card label="Pendiente" value={money(s.author_pending,c)} />
        <Card label="Total retirado" value={money(s.paid_out_total,c)} />
      </div>
    );
    if (mode === "affiliate") return (
      <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Comisiones generadas" value={money(s.affiliate_earnings_total,c)} />
        <Card label="Disponible" value={money(s.affiliate_available,c)} />
        <Card label="Pendiente" value={money(s.affiliate_pending,c)} />
        <Card label="Total retirado" value={money(s.paid_out_total,c)} />
      </div>
    );
    if (mode === "buyer") return (
      <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Compras netas" value={money(s.buyer_net_spend,c)} />
        <Card label="Beneficios del comprador" value={money(s.buyer_benefits_total,c)} />
        <Card label="Reembolsos" value={money(s.refunds_total,c)} />
        <Card label="Créditos y descuentos" value={money(s.credits_discounts_total,c)} />
      </div>
    );
    return (
      <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card label="Beneficios acumulados" value={money(s.benefits_total,c)} note="Regalías + comisiones + créditos + reembolsos." />
        <Card label="Disponible para retirar" value={money(s.available_to_withdraw,c)} />
        <Card label="Ganancias pendientes" value={money(s.pending_earnings,c)} />
        <Card label="Regalías de autor" value={money(s.author_earnings_total,c)} />
        <Card label="Comisiones de afiliado" value={money(s.affiliate_earnings_total,c)} />
        <Card label="Total retirado" value={money(s.paid_out_total,c)} />
      </div>
    );
  })}</div>;
}