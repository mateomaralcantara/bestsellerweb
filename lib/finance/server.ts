import { createClient } from "@/lib/supabase/server";
import type {
  AffiliateMetrics,
  FinanceLedgerRow,
  FinanceRoleContext,
  FinanceSummary,
} from "@/lib/finance/types";

const SUMMARY_SELECT = `
  user_id,
  currency,
  benefits_total,
  author_earnings_total,
  affiliate_earnings_total,
  available_to_withdraw,
  pending_earnings,
  author_available,
  author_pending,
  affiliate_available,
  affiliate_pending,
  paid_out_total,
  buyer_net_spend,
  buyer_benefits_total,
  refunds_total,
  credits_discounts_total,
  transactions_count
`;

const LEDGER_SELECT = `
  id,
  user_id,
  role_context,
  account_bucket,
  event_type,
  direction,
  currency,
  amount,
  gross_amount,
  fee_amount,
  net_amount,
  status,
  effective_status,
  signed_amount,
  source_type,
  source_id,
  description,
  reference,
  book_id,
  purchase_id,
  paypal_order_id,
  paypal_capture_id,
  available_at,
  settled_at,
  metadata,
  created_at
`;

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeSummary(row: Record<string, unknown>): FinanceSummary {
  return {
    user_id: String(row.user_id ?? ""),
    currency: String(row.currency ?? "USD"),
    benefits_total: toNumber(row.benefits_total),
    author_earnings_total: toNumber(row.author_earnings_total),
    affiliate_earnings_total: toNumber(row.affiliate_earnings_total),
    available_to_withdraw: toNumber(row.available_to_withdraw),
    pending_earnings: toNumber(row.pending_earnings),
    author_available: toNumber(row.author_available),
    author_pending: toNumber(row.author_pending),
    affiliate_available: toNumber(row.affiliate_available),
    affiliate_pending: toNumber(row.affiliate_pending),
    paid_out_total: toNumber(row.paid_out_total),
    buyer_net_spend: toNumber(row.buyer_net_spend),
    buyer_benefits_total: toNumber(row.buyer_benefits_total),
    refunds_total: toNumber(row.refunds_total),
    credits_discounts_total: toNumber(row.credits_discounts_total),
    transactions_count: toNumber(row.transactions_count),
  };
}

function normalizeLedger(row: Record<string, unknown>): FinanceLedgerRow {
  return {
    ...(row as unknown as FinanceLedgerRow),
    amount: toNumber(row.amount),
    gross_amount:
      row.gross_amount === null || row.gross_amount === undefined
        ? null
        : toNumber(row.gross_amount),
    fee_amount: toNumber(row.fee_amount),
    net_amount: toNumber(row.net_amount),
    signed_amount: toNumber(row.signed_amount),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

export async function getCurrentFinanceData(input?: {
  limit?: number;
  role?: Exclude<FinanceRoleContext, "platform">;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  let ledgerQuery = supabase
    .from("financial_ledger_effective")
    .select(LEDGER_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input?.limit ?? 50, 1), 250));

  if (input?.role) {
    ledgerQuery = ledgerQuery.eq("role_context", input.role);
  }

  const [summaryResult, ledgerResult] = await Promise.all([
    supabase
      .from("financial_user_summary")
      .select(SUMMARY_SELECT)
      .eq("user_id", user.id)
      .order("currency", { ascending: true }),
    ledgerQuery,
  ]);

  if (summaryResult.error) {
    throw new Error(`FINANCE_SUMMARY: ${summaryResult.error.message}`);
  }

  if (ledgerResult.error) {
    throw new Error(`FINANCE_LEDGER: ${ledgerResult.error.message}`);
  }

  return {
    user,
    summaries: (summaryResult.data ?? []).map((row) =>
      normalizeSummary(row as Record<string, unknown>)
    ),
    ledger: (ledgerResult.data ?? []).map((row) =>
      normalizeLedger(row as Record<string, unknown>)
    ),
  };
}

type AffiliateProfileRow = {
  referral_code: string;
  status: string;
};

export async function getCurrentAffiliateMetrics(): Promise<AffiliateMetrics> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  const [profileResult, clicksResult, conversionsResult] = await Promise.all([
    supabase
      .from("affiliate_profiles")
      .select("referral_code,status")
      .eq("id", user.id)
      .maybeSingle<AffiliateProfileRow>(),

    supabase
      .from("finance_affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", user.id),

    supabase
      .from("financial_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role_context", "affiliate")
      .eq("event_type", "affiliate_commission")
      .eq("direction", "credit"),
  ]);

  if (profileResult.error) {
    throw new Error(`AFFILIATE_PROFILE: ${profileResult.error.message}`);
  }

  if (clicksResult.error) {
    throw new Error(`AFFILIATE_CLICKS: ${clicksResult.error.message}`);
  }

  if (conversionsResult.error) {
    throw new Error(
      `AFFILIATE_CONVERSIONS: ${conversionsResult.error.message}`
    );
  }

  return {
    enabled: Boolean(profileResult.data),
    code: profileResult.data?.referral_code ?? null,
    status: profileResult.data?.status ?? null,
    clicks: clicksResult.count ?? 0,
    conversions: conversionsResult.count ?? 0,
  };
}