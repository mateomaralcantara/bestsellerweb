import { supabaseAdmin } from "@/lib/supabase/admin";

export function normalizeAffiliateCode(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 64);
}

type AffiliateLookupRow = {
  id: string;
  status: string;
};

export async function resolveAffiliateUserByCode(
  code: string | null | undefined,
  buyerUserId?: string | null
) {
  const normalized = normalizeAffiliateCode(code);

  if (!normalized) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("affiliate_profiles")
    .select("id,status")
    .ilike("referral_code", normalized)
    .eq("status", "approved")
    .maybeSingle<AffiliateLookupRow>();

  if (error) {
    throw new Error(`Error resolviendo afiliado: ${error.message}`);
  }

  const affiliateUserId = data?.id ? String(data.id) : null;

  if (!affiliateUserId || affiliateUserId === buyerUserId) {
    return null;
  }

  return affiliateUserId;
}

export async function recordBookSaleFinancials(input: {
  purchaseId: string;
  buyerUserId: string;
  bookId: string;
  amount: string | number;
  currency: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  affiliateUserId?: string | null;
}) {
  const { error } = await supabaseAdmin.rpc("finance_record_book_sale", {
    p_purchase_id: input.purchaseId,
    p_buyer_user_id: input.buyerUserId,
    p_book_id: input.bookId,
    p_amount: Number(input.amount),
    p_currency: input.currency,
    p_paypal_order_id: input.paypalOrderId,
    p_paypal_capture_id: input.paypalCaptureId,
    p_affiliate_user_id: input.affiliateUserId ?? null,
  });

  if (error) {
    throw new Error(`Error registrando finanzas: ${error.message}`);
  }
}