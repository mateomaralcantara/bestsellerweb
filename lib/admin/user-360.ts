import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminAffiliates,
  getAdminAuthors,
  getAdminBooks,
  getAdminPayouts,
  getAdminUsers,
} from "@/lib/admin/admin-data";
import { getActivePurchaseRows } from "@/lib/admin-purchases";

export async function getAdminUser360(userId: string) {
  const authResult = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authResult.error || !authResult.data.user) return null;

  const [users, authors, affiliates, books, payouts, activePurchases, purchasesResult, summaryResult, ledgerResult, auditResult] = await Promise.all([
    getAdminUsers(),
    getAdminAuthors(),
    getAdminAffiliates(),
    getAdminBooks(),
    getAdminPayouts(),
    getActivePurchaseRows({ userId }),
    supabaseAdmin.from("book_purchases").select("id,book_id,status,payment_provider,payment_reference,provider_order_id,amount_paid,currency,paid_at,created_at,revoked_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("financial_user_summary").select("currency,benefits_total,author_earnings_total,affiliate_earnings_total,available_to_withdraw,pending_earnings,paid_out_total,buyer_net_spend,refunds_total,transactions_count").eq("user_id", userId).order("currency"),
    supabaseAdmin.from("financial_ledger_effective").select("id,role_context,event_type,currency,signed_amount,effective_status,description,reference,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(250),
    supabaseAdmin.from("admin_audit_log").select("id,admin_user_id,action,module,reason,created_at").eq("target_id", userId).order("created_at", { ascending: false }).limit(250),
  ]);

  const user = users.find((row) => row.id === userId);
  if (!user) return null;
  if (purchasesResult.error) throw new Error(purchasesResult.error.message);
  if (summaryResult.error) throw new Error(summaryResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (auditResult.error) throw new Error(auditResult.error.message);

  const rawPurchases = purchasesResult.data ?? [];
  const bookIds = [...new Set(rawPurchases.map((row) => String(row.book_id)))];
  const purchaseBooks = new Map<string, { title: string; slug: string | null }>();

  if (bookIds.length) {
    const result = await supabaseAdmin.from("books").select("id,title,slug").in("id", bookIds);
    if (result.error) throw new Error(result.error.message);
    for (const row of result.data ?? []) {
      purchaseBooks.set(String(row.id), {
        title: String(row.title || "Libro"),
        slug: row.slug ? String(row.slug) : null,
      });
    }
  }

  const purchases = rawPurchases.map((row) => {
    const book = purchaseBooks.get(String(row.book_id));
    return {
      id: String(row.id),
      bookId: String(row.book_id),
      bookTitle: book?.title ?? "Libro no encontrado",
      bookSlug: book?.slug ?? null,
      status: String(row.status || ""),
      paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
      paymentReference: row.payment_reference ? String(row.payment_reference) : null,
      amountPaid: Number(row.amount_paid || 0),
      currency: String(row.currency || "USD").toUpperCase(),
      revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    };
  });

  const summaries = (summaryResult.data ?? []).map((row) => ({
    currency: String(row.currency || "USD").toUpperCase(),
    benefitsTotal: Number(row.benefits_total || 0),
    authorEarningsTotal: Number(row.author_earnings_total || 0),
    affiliateEarningsTotal: Number(row.affiliate_earnings_total || 0),
    availableToWithdraw: Number(row.available_to_withdraw || 0),
    pendingEarnings: Number(row.pending_earnings || 0),
    paidOutTotal: Number(row.paid_out_total || 0),
    buyerNetSpend: Number(row.buyer_net_spend || 0),
    refundsTotal: Number(row.refunds_total || 0),
    transactionsCount: Number(row.transactions_count || 0),
  }));

  const ledger = (ledgerResult.data ?? []).map((row) => ({
    id: String(row.id),
    roleContext: String(row.role_context || ""),
    eventType: String(row.event_type || ""),
    currency: String(row.currency || "USD").toUpperCase(),
    signedAmount: Number(row.signed_amount || 0),
    effectiveStatus: String(row.effective_status || ""),
    description: row.description ? String(row.description) : null,
    reference: row.reference ? String(row.reference) : null,
    createdAt: String(row.created_at || ""),
  }));

  const audit = (auditResult.data ?? []).map((row) => ({
    id: String(row.id),
    adminUserId: row.admin_user_id ? String(row.admin_user_id) : null,
    action: String(row.action || ""),
    module: String(row.module || ""),
    reason: row.reason ? String(row.reason) : null,
    createdAt: String(row.created_at || ""),
  }));

  return {
    user,
    userMetadata: authResult.data.user.user_metadata ?? {},
    appMetadata: authResult.data.user.app_metadata ?? {},
    author: authors.find((row) => row.id === userId || row.user_id === userId) ?? null,
    affiliate: affiliates.find((row) => row.id === userId) ?? null,
    books: books.filter((row) => row.owner_user_id === userId),
    payouts: payouts.filter((row) => row.user_id === userId),
    activePurchases,
    purchases,
    summaries,
    ledger,
    audit,
  };
}