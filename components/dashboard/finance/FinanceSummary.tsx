import {
  BadgeDollarSign,
  BanknoteArrowDown,
  CircleDollarSign,
  Clock3,
  Coins,
  Gift,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinanceSummary } from "@/lib/finance/types";

type Mode = "all" | "author" | "affiliate" | "buyer";
type Tone =
  | "emerald"
  | "cyan"
  | "amber"
  | "violet"
  | "sky"
  | "slate"
  | "rose";

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

const tones: Record<
  Tone,
  {
    border: string;
    background: string;
    icon: string;
    glow: string;
    value: string;
    chip: string;
  }
> = {
  emerald: {
    border: "border-emerald-200/80",
    background:
      "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30",
    icon: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    glow: "bg-emerald-400/20",
    value: "text-emerald-950",
    chip: "bg-emerald-100 text-emerald-700",
  },
  cyan: {
    border: "border-cyan-200/80",
    background: "bg-gradient-to-br from-cyan-50 via-white to-cyan-50/30",
    icon: "bg-cyan-100 text-cyan-700 ring-cyan-200",
    glow: "bg-cyan-400/20",
    value: "text-cyan-950",
    chip: "bg-cyan-100 text-cyan-700",
  },
  amber: {
    border: "border-amber-200/80",
    background:
      "bg-gradient-to-br from-amber-50 via-white to-amber-50/30",
    icon: "bg-amber-100 text-amber-700 ring-amber-200",
    glow: "bg-amber-400/20",
    value: "text-amber-950",
    chip: "bg-amber-100 text-amber-700",
  },
  violet: {
    border: "border-violet-200/80",
    background:
      "bg-gradient-to-br from-violet-50 via-white to-violet-50/30",
    icon: "bg-violet-100 text-violet-700 ring-violet-200",
    glow: "bg-violet-400/20",
    value: "text-violet-950",
    chip: "bg-violet-100 text-violet-700",
  },
  sky: {
    border: "border-sky-200/80",
    background: "bg-gradient-to-br from-sky-50 via-white to-sky-50/30",
    icon: "bg-sky-100 text-sky-700 ring-sky-200",
    glow: "bg-sky-400/20",
    value: "text-sky-950",
    chip: "bg-sky-100 text-sky-700",
  },
  slate: {
    border: "border-slate-200/90",
    background:
      "bg-gradient-to-br from-slate-50 via-white to-slate-100/40",
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    glow: "bg-slate-400/15",
    value: "text-slate-950",
    chip: "bg-slate-100 text-slate-700",
  },
  rose: {
    border: "border-rose-200/80",
    background: "bg-gradient-to-br from-rose-50 via-white to-rose-50/30",
    icon: "bg-rose-100 text-rose-700 ring-rose-200",
    glow: "bg-rose-400/20",
    value: "text-rose-950",
    chip: "bg-rose-100 text-rose-700",
  },
};

function Card({
  label,
  value,
  currency,
  icon: Icon,
  tone,
  note,
  featured = false,
}: {
  label: string;
  value: string;
  currency: string;
  icon: LucideIcon;
  tone: Tone;
  note?: string;
  featured?: boolean;
}) {
  const style = tones[tone];

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-[26px] border p-5 transition duration-300 hover:-translate-y-1",
        "shadow-[0_18px_50px_-35px_rgba(15,23,42,0.50)] hover:shadow-[0_28px_65px_-38px_rgba(15,23,42,0.58)]",
        style.border,
        style.background,
        featured ? "md:col-span-2 xl:col-span-1" : "",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition duration-500 group-hover:scale-125",
          style.glow,
        ].join(" ")}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <span
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
              style.icon,
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </span>

          <span
            className={[
              "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
              style.chip,
            ].join(" ")}
          >
            {currency}
          </span>
        </div>

        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">
          {label}
        </p>

        <p
          className={[
            "mt-2 break-words text-3xl font-black tracking-[-0.035em]",
            style.value,
          ].join(" ")}
        >
          {value}
        </p>

        {note ? (
          <p className="mt-3 max-w-xs text-xs leading-5 text-slate-500">
            {note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

const zero: FinanceSummary = {
  user_id: "",
  currency: "USD",
  benefits_total: 0,
  author_earnings_total: 0,
  affiliate_earnings_total: 0,
  available_to_withdraw: 0,
  pending_earnings: 0,
  author_available: 0,
  author_pending: 0,
  affiliate_available: 0,
  affiliate_pending: 0,
  paid_out_total: 0,
  buyer_net_spend: 0,
  buyer_benefits_total: 0,
  refunds_total: 0,
  credits_discounts_total: 0,
  transactions_count: 0,
};

export default function FinanceSummaryCards({
  summaries,
  mode = "all",
}: {
  summaries: FinanceSummary[];
  mode?: Mode;
}) {
  const rows = summaries.length > 0 ? summaries : [zero];

  return (
    <div className="space-y-6">
      {rows.map((s) => {
        const c = s.currency;

        if (mode === "author") {
          return (
            <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card
                label="Regalías generadas"
                value={money(s.author_earnings_total, c)}
                currency={c}
                icon={Coins}
                tone="violet"
              />
              <Card
                label="Disponible"
                value={money(s.author_available, c)}
                currency={c}
                icon={WalletCards}
                tone="emerald"
              />
              <Card
                label="Pendiente"
                value={money(s.author_pending, c)}
                currency={c}
                icon={Clock3}
                tone="amber"
              />
              <Card
                label="Total retirado"
                value={money(s.paid_out_total, c)}
                currency={c}
                icon={BanknoteArrowDown}
                tone="slate"
              />
            </div>
          );
        }

        if (mode === "affiliate") {
          return (
            <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card
                label="Comisiones generadas"
                value={money(s.affiliate_earnings_total, c)}
                currency={c}
                icon={TrendingUp}
                tone="cyan"
              />
              <Card
                label="Disponible"
                value={money(s.affiliate_available, c)}
                currency={c}
                icon={WalletCards}
                tone="emerald"
              />
              <Card
                label="Pendiente"
                value={money(s.affiliate_pending, c)}
                currency={c}
                icon={Clock3}
                tone="amber"
              />
              <Card
                label="Total retirado"
                value={money(s.paid_out_total, c)}
                currency={c}
                icon={BanknoteArrowDown}
                tone="slate"
              />
            </div>
          );
        }

        if (mode === "buyer") {
          return (
            <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card
                label="Compras netas"
                value={money(s.buyer_net_spend, c)}
                currency={c}
                icon={ShoppingBag}
                tone="sky"
              />
              <Card
                label="Beneficios del comprador"
                value={money(s.buyer_benefits_total, c)}
                currency={c}
                icon={Gift}
                tone="emerald"
              />
              <Card
                label="Reembolsos"
                value={money(s.refunds_total, c)}
                currency={c}
                icon={RotateCcw}
                tone="rose"
              />
              <Card
                label="Créditos y descuentos"
                value={money(s.credits_discounts_total, c)}
                currency={c}
                icon={ReceiptText}
                tone="violet"
              />
            </div>
          );
        }

        return (
          <div key={c} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card
              label="Beneficios acumulados"
              value={money(s.benefits_total, c)}
              currency={c}
              icon={Sparkles}
              tone="emerald"
              featured
              note="Regalías + comisiones + créditos + reembolsos."
            />
            <Card
              label="Disponible para retirar"
              value={money(s.available_to_withdraw, c)}
              currency={c}
              icon={CircleDollarSign}
              tone="cyan"
              featured
              note="Saldo que ya puede convertirse en retiro."
            />
            <Card
              label="Ganancias pendientes"
              value={money(s.pending_earnings, c)}
              currency={c}
              icon={Clock3}
              tone="amber"
              note="Ganancias aún dentro del período de disponibilidad."
            />
            <Card
              label="Regalías de autor"
              value={money(s.author_earnings_total, c)}
              currency={c}
              icon={Coins}
              tone="violet"
            />
            <Card
              label="Comisiones de afiliado"
              value={money(s.affiliate_earnings_total, c)}
              currency={c}
              icon={BadgeDollarSign}
              tone="sky"
            />
            <Card
              label="Total retirado"
              value={money(s.paid_out_total, c)}
              currency={c}
              icon={PiggyBank}
              tone="slate"
            />
          </div>
        );
      })}
    </div>
  );
}
