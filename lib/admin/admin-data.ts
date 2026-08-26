import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActivePurchaseRows } from "@/lib/admin-purchases";

async function countRows(
  table: string,
  configure?: (query: any) => any
): Promise<number> {
  let query: any = supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (configure) query = configure(query);

  const { count, error } = await query;

  if (error) {
    throw new Error(`No se pudo contar ${table}: ${error.message}`);
  }

  return count ?? 0;
}

export type AdminCurrencyTotals = {
  currency: string;
  grossSales: number;
  authorRoyalties: number;
  affiliateCommissions: number;
  platformRevenue: number;
  refunds: number;
};

export async function getAdminDashboard() {
  const activePurchaseStatuses = [
    "paid",
    "completed",
    "approved",
    "succeeded",
  ];

  const [
    users,
    authors,
    affiliates,
    books,
    publishedBooks,
    purchases,
    pendingPayouts,
    ledgerResult,
  ] = await Promise.all([
    countRows("profiles"),
    countRows("author_profiles"),
    countRows("affiliate_profiles"),
    countRows("books"),
    countRows("books", (q) => q.eq("status", "published")),
    countRows("book_purchases", (q) =>
      q.in("status", activePurchaseStatuses)
    ),
    countRows("financial_payouts", (q) =>
      q.in("status", ["requested", "processing"])
    ),
    supabaseAdmin
      .from("financial_ledger")
      .select("currency,amount,direction,event_type,status,role_context")
      .not("status", "in", '("failed","cancelled")')
      .limit(10000),
  ]);

  if (ledgerResult.error) {
    throw new Error(`No se pudo cargar el ledger: ${ledgerResult.error.message}`);
  }

  const totals = new Map<string, AdminCurrencyTotals>();

  for (const row of ledgerResult.data ?? []) {
    const currency = String(row.currency || "USD").toUpperCase();
    const current =
      totals.get(currency) ??
      {
        currency,
        grossSales: 0,
        authorRoyalties: 0,
        affiliateCommissions: 0,
        platformRevenue: 0,
        refunds: 0,
      };

    const amount = Number(row.amount || 0);

    if (row.event_type === "purchase" && row.direction === "debit") {
      current.grossSales += amount;
    }
    if (row.event_type === "author_royalty" && row.direction === "credit") {
      current.authorRoyalties += amount;
    }
    if (
      row.event_type === "affiliate_commission" &&
      row.direction === "credit"
    ) {
      current.affiliateCommissions += amount;
    }
    if (row.event_type === "platform_fee" && row.direction === "credit") {
      current.platformRevenue += amount;
    }
    if (row.event_type === "refund" && row.direction === "credit") {
      current.refunds += amount;
    }

    totals.set(currency, current);
  }

  return {
    users,
    authors,
    affiliates,
    books,
    publishedBooks,
    purchases,
    pendingPayouts,
    totals: [...totals.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
  };
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  banned: boolean;
  roles: string[];
  purchaseBlocked: boolean;
  payoutBlocked: boolean;
  notes: string | null;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const authResult = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authResult.error) {
    throw new Error(`No se pudieron cargar usuarios: ${authResult.error.message}`);
  }

  const users = authResult.data.users ?? [];
  const userIds = users.map((user) => user.id);

  if (userIds.length === 0) return [];

  const [profilesResult, rolesResult, controlsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds),
    supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", userIds),
    supabaseAdmin
      .from("admin_user_controls")
      .select("user_id,purchase_blocked,payout_blocked,notes")
      .in("user_id", userIds),
  ]);

  if (profilesResult.error) {
    throw new Error(`No se pudieron cargar perfiles: ${profilesResult.error.message}`);
  }
  if (rolesResult.error) {
    throw new Error(`No se pudieron cargar roles: ${rolesResult.error.message}`);
  }
  if (controlsResult.error && controlsResult.error.code !== "42P01") {
    throw new Error(`No se pudieron cargar controles: ${controlsResult.error.message}`);
  }

  const profiles = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row.full_name ?? null])
  );

  const roles = new Map<string, string[]>();
  for (const row of rolesResult.data ?? []) {
    const list = roles.get(row.user_id) ?? [];
    list.push(String(row.role));
    roles.set(row.user_id, list);
  }

  const controls = new Map(
    (controlsResult.data ?? []).map((row) => [row.user_id, row])
  );

  const now = Date.now();

  return users
    .map((user) => {
      const control = controls.get(user.id);
      const bannedUntil = user.banned_until ?? null;
      const banned =
        Boolean(bannedUntil) &&
        new Date(String(bannedUntil)).getTime() > now;

      return {
        id: user.id,
        email: user.email ?? null,
        fullName: profiles.get(user.id) ?? null,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        bannedUntil,
        banned,
        roles: (roles.get(user.id) ?? []).sort(),
        purchaseBlocked: Boolean(control?.purchase_blocked),
        payoutBlocked: Boolean(control?.payout_blocked),
        notes: control?.notes ?? null,
      };
    })
    .sort((a, b) =>
      (a.email || a.fullName || a.id).localeCompare(
        b.email || b.fullName || b.id
      )
    );
}

export async function getAdminFinanceConfig() {
  const { data, error } = await supabaseAdmin
    .from("finance_config")
    .select(
      "singleton,default_author_rate,default_affiliate_rate,earnings_hold_days,minimum_payout,updated_at"
    )
    .eq("singleton", true)
    .single();

  if (error) {
    throw new Error(`No se pudo cargar finance_config: ${error.message}`);
  }

  return {
    defaultAuthorRate: Number(data.default_author_rate),
    defaultAffiliateRate: Number(data.default_affiliate_rate),
    earningsHoldDays: Number(data.earnings_hold_days),
    minimumPayout: Number(data.minimum_payout),
    updatedAt: data.updated_at,
  };
}

export async function getAdminAffiliates() {
  const { data, error } = await supabaseAdmin
    .from("affiliate_profiles")
    .select(
      "id,display_name,handle,referral_code,code,commission_rate,commission_rate_override,status,approved_at,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`No se pudieron cargar afiliados: ${error.message}`);
  }

  return data ?? [];
}

export async function getAdminAuthors() {
  const { data, error } = await supabaseAdmin
    .from("author_profiles")
    .select(
      "id,user_id,slug,display_name,pen_name,approval_status,rejection_reason"
    )
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (error) {
    throw new Error(`No se pudieron cargar autores: ${error.message}`);
  }

  return data ?? [];
}

export async function getAdminPayouts() {
  const { data, error } = await supabaseAdmin
    .from("financial_payouts")
    .select(
      "id,user_id,role_context,currency,requested_amount,fee_amount,net_amount,method,status,payout_reference,failure_reason,requested_at,processed_at,updated_at"
    )
    .order("requested_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`No se pudieron cargar retiros: ${error.message}`);
  }

  return data ?? [];
}

export async function getAdminLedger() {
  const { data, error } = await supabaseAdmin
    .from("financial_ledger_effective")
    .select(
      "id,user_id,role_context,account_bucket,event_type,direction,currency,amount,signed_amount,status,effective_status,description,reference,book_id,purchase_id,paypal_order_id,paypal_capture_id,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`No se pudo cargar el ledger: ${error.message}`);
  }

  return data ?? [];
}

export async function getAdminBooks() {
  const [booksResult, rulesResult] = await Promise.all([
    supabaseAdmin
      .from("books")
      .select(
        "id,title,slug,status,owner_user_id,cover_url,paypal_price,paypal_currency"
      )
      .order("title", { ascending: true })
      .limit(2000),
    supabaseAdmin
      .from("book_finance_rules")
      .select("book_id,author_rate,affiliate_rate,hold_days"),
  ]);

  if (booksResult.error) {
    throw new Error(`No se pudieron cargar libros: ${booksResult.error.message}`);
  }
  if (rulesResult.error) {
    throw new Error(`No se pudieron cargar reglas financieras: ${rulesResult.error.message}`);
  }

  const rules = new Map(
    (rulesResult.data ?? []).map((row) => [row.book_id, row])
  );

  return (booksResult.data ?? []).map((book) => ({
    ...book,
    financeRule: rules.get(book.id) ?? null,
  }));
}

export async function getAdminAudit() {
  const { data, error } = await supabaseAdmin
    .from("admin_audit_log")
    .select(
      "id,admin_user_id,action,module,target_type,target_id,reason,before_data,after_data,request_id,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`No se pudo cargar la auditoría: ${error.message}`);
  }

  return data ?? [];
}

export async function getAdminSecurity() {
  const [usersResult, rolesResult, permissionsResult] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .eq("role", "admin"),
    supabaseAdmin
      .from("admin_permissions")
      .select("admin_user_id,permission")
      .order("permission"),
  ]);

  if (usersResult.error) {
    throw new Error(`No se pudieron cargar usuarios: ${usersResult.error.message}`);
  }
  if (rolesResult.error) {
    throw new Error(`No se pudieron cargar administradores: ${rolesResult.error.message}`);
  }
  if (permissionsResult.error) {
    throw new Error(`No se pudieron cargar permisos: ${permissionsResult.error.message}`);
  }

  const usersById = new Map(
    usersResult.data.users.map((user) => [user.id, user])
  );

  const permissions = new Map<string, string[]>();
  for (const row of permissionsResult.data ?? []) {
    const list = permissions.get(row.admin_user_id) ?? [];
    list.push(row.permission);
    permissions.set(row.admin_user_id, list);
  }

  return (rolesResult.data ?? []).map((row) => {
    const user = usersById.get(row.user_id);
    return {
      userId: row.user_id,
      email: user?.email ?? null,
      permissions: permissions.get(row.user_id) ?? [],
    };
  });
}

export async function getAdminPurchases() {
  return getActivePurchaseRows();
}
