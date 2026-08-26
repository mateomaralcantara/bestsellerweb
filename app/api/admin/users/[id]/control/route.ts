import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AdminAccessError,
  requireAdminApi,
  writeAdminAudit,
} from "@/lib/admin/superadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;
type Context = { params: Promise<{ id: string }> };

function text(body: Body, key: string) {
  return typeof body[key] === "string" ? String(body[key]).trim() : "";
}

function reason(body: Body) {
  const value = text(body, "reason");
  if (value.length < 3) {
    throw new AdminAccessError("Debes indicar un motivo administrativo.", 400);
  }
  return value;
}

function numeric(body: Body, key: string) {
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : null;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ok(extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...(extra ?? {}) });
}

async function userOr404(userId: string) {
  const result = await supabaseAdmin.auth.admin.getUserById(userId);
  if (result.error || !result.data.user) {
    throw new AdminAccessError("Usuario no encontrado.", 404);
  }
  return result.data.user;
}

async function setPassword(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body);
  const password = text(body, "password");

  if (password.length < 10) {
    throw new AdminAccessError(
      "La nueva contrasena debe tener al menos 10 caracteres.",
      400
    );
  }

  await userOr404(userId);

  const result = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });

  if (result.error) throw new Error(result.error.message);

  await writeAdminAudit({
    actor,
    action: "user.password.set",
    module: "users",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: null,
    after: { passwordChanged: true },
  });

  return ok();
}

async function updateMetadata(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body);
  const user = await userOr404(userId);
  const metadata = body.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new AdminAccessError("Metadata invalida.", 400);
  }

  const result = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: metadata as Record<string, unknown>,
  });

  if (result.error) throw new Error(result.error.message);

  await writeAdminAudit({
    actor,
    action: "user.metadata.update",
    module: "users",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: user.user_metadata ?? {},
    after: metadata,
  });

  return ok();
}

async function purchaseAccess(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body);
  const purchaseId = text(body, "purchaseId");
  const grant = body.grant === true;

  const purchase = await supabaseAdmin
    .from("book_purchases")
    .select("id,user_id,amount_paid,revoked_at")
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (purchase.error) throw new Error(purchase.error.message);

  if (!purchase.data) {
    throw new AdminAccessError(
      "Compra no encontrada para este usuario.",
      404
    );
  }

  if (grant) {
    const refunds = await supabaseAdmin
      .from("financial_ledger")
      .select("amount,status,direction")
      .eq("purchase_id", purchaseId)
      .eq("event_type", "refund")
      .eq("direction", "credit")
      .not("status", "in", '("failed","cancelled")');

    if (refunds.error) throw new Error(refunds.error.message);

    const refunded = (refunds.data ?? []).reduce(
      (total, row) => total + Number(row.amount || 0),
      0
    );
    const paid = Number(purchase.data.amount_paid || 0);

    if (paid > 0 && refunded + 0.005 >= paid) {
      throw new AdminAccessError(
        "No se puede reactivar una compra totalmente reembolsada.",
        409
      );
    }
  }

  const revokedAt = grant ? null : new Date().toISOString();

  const update = await supabaseAdmin
    .from("book_purchases")
    .update({ revoked_at: revokedAt })
    .eq("id", purchaseId)
    .eq("user_id", userId);

  if (update.error) throw new Error(update.error.message);

  await writeAdminAudit({
    actor,
    action: grant ? "purchase.access.grant" : "purchase.access.revoke",
    module: "purchases",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: {
      purchaseId,
      revokedAt: purchase.data.revoked_at,
    },
    after: {
      purchaseId,
      revokedAt,
    },
  });

  return ok();
}

type SummarySnapshot = {
  benefitsTotal: number;
  availableToWithdraw: number;
  pendingEarnings: number;
  authorEarningsTotal: number;
  affiliateEarningsTotal: number;
  paidOutTotal: number;
};

function zeroSummary(): SummarySnapshot {
  return {
    benefitsTotal: 0,
    availableToWithdraw: 0,
    pendingEarnings: 0,
    authorEarningsTotal: 0,
    affiliateEarningsTotal: 0,
    paidOutTotal: 0,
  };
}

function parseTargetSummary(body: Body): SummarySnapshot {
  const values = {
    benefitsTotal: numeric(body, "benefitsTotal"),
    availableToWithdraw: numeric(body, "availableToWithdraw"),
    pendingEarnings: numeric(body, "pendingEarnings"),
    authorEarningsTotal: numeric(body, "authorEarningsTotal"),
    affiliateEarningsTotal: numeric(body, "affiliateEarningsTotal"),
    paidOutTotal: numeric(body, "paidOutTotal"),
  };

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value < 0 || value > 1_000_000_000) {
      throw new AdminAccessError(
        `Valor financiero invalido: ${key}.`,
        400
      );
    }
  }

  return {
    benefitsTotal: money(values.benefitsTotal!),
    availableToWithdraw: money(values.availableToWithdraw!),
    pendingEarnings: money(values.pendingEarnings!),
    authorEarningsTotal: money(values.authorEarningsTotal!),
    affiliateEarningsTotal: money(values.affiliateEarningsTotal!),
    paidOutTotal: money(values.paidOutTotal!),
  };
}

async function getCurrentSummary(
  userId: string,
  currency: string
): Promise<SummarySnapshot> {
  const result = await supabaseAdmin
    .from("financial_user_summary")
    .select(
      "benefits_total,available_to_withdraw,pending_earnings,author_earnings_total,affiliate_earnings_total,paid_out_total"
    )
    .eq("user_id", userId)
    .eq("currency", currency)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) return zeroSummary();

  return {
    benefitsTotal: Number(result.data.benefits_total || 0),
    availableToWithdraw: Number(result.data.available_to_withdraw || 0),
    pendingEarnings: Number(result.data.pending_earnings || 0),
    authorEarningsTotal: Number(result.data.author_earnings_total || 0),
    affiliateEarningsTotal: Number(
      result.data.affiliate_earnings_total || 0
    ),
    paidOutTotal: Number(result.data.paid_out_total || 0),
  };
}

type LedgerInsert = {
  user_id: string;
  role_context: "customer" | "author" | "affiliate";
  account_bucket: "benefit" | "earnings";
  event_type: "adjustment" | "payout";
  direction: "credit" | "debit";
  currency: string;
  amount: number;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  status: "pending" | "available" | "paid";
  source_type: string;
  source_id: string;
  idempotency_key: string;
  description: string;
  reference: string;
  available_at: string | null;
  settled_at: string | null;
  metadata: Record<string, unknown>;
};

function makeLedgerRow(input: {
  userId: string;
  adminId: string;
  currency: string;
  metric: string;
  delta: number;
  roleContext: LedgerInsert["role_context"];
  accountBucket: LedgerInsert["account_bucket"];
  eventType: LedgerInsert["event_type"];
  status: LedgerInsert["status"];
  reason: string;
  target: SummarySnapshot;
}): LedgerInsert | null {
  const delta = money(input.delta);
  if (Math.abs(delta) < 0.005) return null;

  const sourceId = randomUUID();
  const amount = money(Math.abs(delta));
  const now = new Date().toISOString();

  let direction: "credit" | "debit";

  if (input.eventType === "payout") {
    direction = delta > 0 ? "debit" : "credit";
  } else {
    direction = delta > 0 ? "credit" : "debit";
  }

  return {
    user_id: input.userId,
    role_context: input.roleContext,
    account_bucket: input.accountBucket,
    event_type: input.eventType,
    direction,
    currency: input.currency,
    amount,
    gross_amount: amount,
    fee_amount: 0,
    net_amount: amount,
    status: input.status,
    source_type: "admin_summary_set",
    source_id: sourceId,
    idempotency_key: `admin-summary-set:${sourceId}`,
    description: `SUPERADMIN ajusto ${input.metric}: ${input.reason}`,
    reference: sourceId,
    available_at: input.status === "pending" ? null : now,
    settled_at: input.status === "pending" ? null : now,
    metadata: {
      admin_user_id: input.adminId,
      reason: input.reason,
      summary_metric: input.metric,
      target_summary: input.target,
    },
  };
}

async function setFinanceSummary(userId: string, body: Body) {
  const actor = await requireAdminApi("finance.adjust");
  const why = reason(body);

  await userOr404(userId);

  const currency = text(body, "currency").toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AdminAccessError("Moneda invalida.", 400);
  }

  const target = parseTargetSummary(body);
  const before = await getCurrentSummary(userId, currency);

  const dAuthor = money(
    target.authorEarningsTotal - before.authorEarningsTotal
  );
  const dAffiliate = money(
    target.affiliateEarningsTotal - before.affiliateEarningsTotal
  );
  const dPaidOut = money(target.paidOutTotal - before.paidOutTotal);

  const benefitsAfterCore = money(
    before.benefitsTotal + dAuthor + dAffiliate
  );

  const availableAfterCore = money(
    before.availableToWithdraw + dAuthor + dAffiliate - dPaidOut
  );

  const dPending = money(
    target.pendingEarnings - before.pendingEarnings
  );

  const dAvailable = money(
    target.availableToWithdraw - availableAfterCore
  );

  const dBenefits = money(
    target.benefitsTotal - benefitsAfterCore
  );

  const candidates: Array<LedgerInsert | null> = [
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "author_earnings_total",
      delta: dAuthor,
      roleContext: "author",
      accountBucket: "earnings",
      eventType: "adjustment",
      status: "available",
      reason: why,
      target,
    }),
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "affiliate_earnings_total",
      delta: dAffiliate,
      roleContext: "affiliate",
      accountBucket: "earnings",
      eventType: "adjustment",
      status: "available",
      reason: why,
      target,
    }),
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "paid_out_total",
      delta: dPaidOut,
      roleContext: "customer",
      accountBucket: "earnings",
      eventType: "payout",
      status: "paid",
      reason: why,
      target,
    }),
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "pending_earnings",
      delta: dPending,
      roleContext: "customer",
      accountBucket: "earnings",
      eventType: "adjustment",
      status: "pending",
      reason: why,
      target,
    }),
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "available_to_withdraw",
      delta: dAvailable,
      roleContext: "customer",
      accountBucket: "earnings",
      eventType: "adjustment",
      status: "available",
      reason: why,
      target,
    }),
    makeLedgerRow({
      userId,
      adminId: actor.id,
      currency,
      metric: "benefits_total",
      delta: dBenefits,
      roleContext: "customer",
      accountBucket: "benefit",
      eventType: "adjustment",
      status: "available",
      reason: why,
      target,
    }),
  ];

  const rows = candidates.filter(
    (row): row is LedgerInsert => Boolean(row)
  );

  if (rows.length > 0) {
    const insert = await supabaseAdmin.from("financial_ledger").insert(rows);
    if (insert.error) throw new Error(insert.error.message);
  }

  const after = await getCurrentSummary(userId, currency);

  const tolerance = 0.011;
  const matches =
    Math.abs(after.benefitsTotal - target.benefitsTotal) < tolerance &&
    Math.abs(
      after.availableToWithdraw - target.availableToWithdraw
    ) < tolerance &&
    Math.abs(after.pendingEarnings - target.pendingEarnings) < tolerance &&
    Math.abs(
      after.authorEarningsTotal - target.authorEarningsTotal
    ) < tolerance &&
    Math.abs(
      after.affiliateEarningsTotal - target.affiliateEarningsTotal
    ) < tolerance &&
    Math.abs(after.paidOutTotal - target.paidOutTotal) < tolerance;

  if (!matches) {
    await writeAdminAudit({
      actor,
      action: "finance.summary.set.reconcile_required",
      module: "finance",
      targetType: "user",
      targetId: userId,
      reason: why,
      before,
      after: {
        target,
        actual: after,
        currency,
      },
    });

    throw new Error(
      "Los asientos fueron registrados, pero el resumen no coincide con el objetivo. Requiere reconciliacion."
    );
  }

  await writeAdminAudit({
    actor,
    action: "finance.summary.set",
    module: "finance",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: {
      ...before,
      currency,
    },
    after: {
      ...after,
      currency,
      ledgerRowsCreated: rows.length,
    },
  });

  return ok({
    currency,
    before,
    after,
    ledgerRowsCreated: rows.length,
  });
}


function normalizeProfileSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeAffiliateCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 64);
}

async function upsertAuthorProfile(userId: string, body: Body) {
  const actor = await requireAdminApi("authors.manage");
  const why = reason(body);

  await userOr404(userId);

  const displayName = text(body, "displayName");
  const penName = text(body, "penName");
  const slug = normalizeProfileSlug(text(body, "slug"));
  const status = text(body, "status");
  const rejectionReason = text(body, "rejectionReason");

  if (!displayName || !slug) {
    throw new AdminAccessError(
      "Nombre publico y slug del autor son obligatorios.",
      400
    );
  }

  if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
    throw new AdminAccessError("Estado de autor invalido.", 400);
  }

  const before = await supabaseAdmin
    .from("author_profiles")
    .select("*")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (before.error) throw new Error(before.error.message);

  const payload = {
    user_id: userId,
    slug,
    display_name: displayName,
    pen_name: penName || null,
    approval_status: status,
    rejection_reason:
      status === "rejected" || status === "suspended"
        ? rejectionReason || null
        : null,
  };

  if (before.data) {
    const update = await supabaseAdmin
      .from("author_profiles")
      .update(payload)
      .eq("id", before.data.id);

    if (update.error) throw new Error(update.error.message);
  } else {
    const insert = await supabaseAdmin.from("author_profiles").insert({
      id: userId,
      ...payload,
    });

    if (insert.error) throw new Error(insert.error.message);
  }

  const roleResult = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        role: "author",
      },
      { onConflict: "user_id,role" }
    );

  if (roleResult.error) throw new Error(roleResult.error.message);

  await writeAdminAudit({
    actor,
    action: "author.profile.upsert",
    module: "authors",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: before.data ?? null,
    after: payload,
  });

  return ok();
}

async function upsertAffiliateProfile(userId: string, body: Body) {
  const actor = await requireAdminApi("affiliates.manage");
  const why = reason(body);

  await userOr404(userId);

  const displayName = text(body, "displayName");
  const handle = text(body, "handle");
  const referralCode = normalizeAffiliateCode(text(body, "referralCode"));
  const commissionRatePct = numeric(body, "commissionRatePct");
  const status = text(body, "status");

  if (referralCode.length < 4) {
    throw new AdminAccessError(
      "El codigo de afiliado debe tener al menos 4 caracteres.",
      400
    );
  }

  if (
    commissionRatePct === null ||
    commissionRatePct < 0 ||
    commissionRatePct > 100
  ) {
    throw new AdminAccessError("Comision de afiliado invalida.", 400);
  }

  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new AdminAccessError("Estado de afiliado invalido.", 400);
  }

  const before = await supabaseAdmin
    .from("affiliate_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (before.error) throw new Error(before.error.message);

  const payload = {
    id: userId,
    display_name: displayName || null,
    handle: handle || null,
    referral_code: referralCode,
    code: referralCode,
    commission_rate: commissionRatePct,
    commission_rate_override: commissionRatePct / 100,
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const upsert = await supabaseAdmin
    .from("affiliate_profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsert.error) throw new Error(upsert.error.message);

  const roleResult = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        role: "affiliate",
      },
      { onConflict: "user_id,role" }
    );

  if (roleResult.error) throw new Error(roleResult.error.message);

  await writeAdminAudit({
    actor,
    action: "affiliate.profile.upsert",
    module: "affiliates",
    targetType: "user",
    targetId: userId,
    reason: why,
    before: before.data ?? null,
    after: payload,
  });

  return ok();
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Body invalido." },
        { status: 400 }
      );
    }

    switch (text(body, "action")) {
      case "password.set":
        return await setPassword(id, body);
      case "metadata.update":
        return await updateMetadata(id, body);
      case "purchase.access":
        return await purchaseAccess(id, body);
      case "author.profile.upsert":
        return await upsertAuthorProfile(id, body);
      case "affiliate.profile.upsert":
        return await upsertAffiliateProfile(id, body);
      case "finance.summary.set":
        return await setFinanceSummary(id, body);
      default:
        throw new AdminAccessError(
          "Accion USER 360 no soportada.",
          400
        );
    }
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("SUPERADMIN USER360:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error administrativo.",
      },
      { status: 500 }
    );
  }
}
