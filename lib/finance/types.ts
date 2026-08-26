export type FinanceRoleContext =
  | "customer"
  | "author"
  | "affiliate"
  | "platform";

export type FinanceEventType =
  | "purchase"
  | "author_royalty"
  | "affiliate_commission"
  | "platform_fee"
  | "payment_fee"
  | "discount"
  | "credit"
  | "refund"
  | "reversal"
  | "payout"
  | "adjustment";

export type FinanceStatus =
  | "pending"
  | "available"
  | "processing"
  | "paid"
  | "reversed"
  | "refunded"
  | "failed"
  | "cancelled";

export type FinanceSummary = {
  user_id: string;
  currency: string;
  benefits_total: number;
  author_earnings_total: number;
  affiliate_earnings_total: number;
  available_to_withdraw: number;
  pending_earnings: number;
  author_available: number;
  author_pending: number;
  affiliate_available: number;
  affiliate_pending: number;
  paid_out_total: number;
  buyer_net_spend: number;
  buyer_benefits_total: number;
  refunds_total: number;
  credits_discounts_total: number;
  transactions_count: number;
};

export type FinanceLedgerRow = {
  id: string;
  user_id: string | null;
  role_context: FinanceRoleContext;
  account_bucket: "spend" | "earnings" | "benefit" | "platform";
  event_type: FinanceEventType;
  direction: "credit" | "debit";
  currency: string;
  amount: number;
  gross_amount: number | null;
  fee_amount: number;
  net_amount: number;
  status: FinanceStatus;
  effective_status: FinanceStatus;
  signed_amount: number;
  source_type: string;
  source_id: string;
  description: string | null;
  reference: string | null;
  book_id: string | null;
  purchase_id: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  available_at: string | null;
  settled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AffiliateMetrics = {
  enabled: boolean;
  code: string | null;
  status: string | null;
  clicks: number;
  conversions: number;
};