import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AdminAccessError,
  requireAdminApi,
  writeAdminAudit,
} from "@/lib/admin/superadmin";
import { refundPayPalCapture } from "@/lib/paypal/admin-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

function text(body: Body, key: string) {
  return typeof body[key] === "string" ? String(body[key]).trim() : "";
}

function boolean(body: Body, key: string) {
  return body[key] === true;
}

function number(body: Body, key: string) {
  const value = Number(body[key]);
  return Number.isFinite(value) ? value : null;
}

function nullableNumber(body: Body, key: string) {
  if (body[key] === null || body[key] === "" || typeof body[key] === "undefined") {
    return null;
  }
  return number(body, key);
}

function requireReason(body: Body) {
  const reason = text(body, "reason");
  if (reason.length < 3) {
    throw new AdminAccessError("Debes indicar un motivo administrativo.", 400);
  }
  return reason;
}

function ok(extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...(extra ?? {}) });
}

async function selectOne(table: string, idColumn: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq(idColumn, id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function updateUser(body: Body) {
  const actor = await requireAdminApi("users.manage");
  const userId = text(body, "userId");
  const email = text(body, "email");
  const fullName = text(body, "fullName");
  const reason = requireReason(body);

  if (!userId) throw new AdminAccessError("Falta userId.", 400);

  const beforeAuth = await supabaseAdmin.auth.admin.getUserById(userId);
  if (beforeAuth.error || !beforeAuth.data.user) {
    throw new AdminAccessError("Usuario no encontrado.", 404);
  }

  const beforeProfile = await selectOne("profiles", "id", userId);

  if (email && email !== beforeAuth.data.user.email) {
    const update = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
    });
    if (update.error) throw new Error(update.error.message);
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, full_name: fullName || null }, { onConflict: "id" });

  if (profileError) throw new Error(profileError.message);

  await writeAdminAudit({
    actor,
    action: "user.update",
    module: "users",
    targetType: "user",
    targetId: userId,
    reason,
    before: {
      email: beforeAuth.data.user.email ?? null,
      profile: beforeProfile,
    },
    after: {
      email: email || beforeAuth.data.user.email || null,
      fullName: fullName || null,
    },
  });

  return ok();
}

async function updateControls(body: Body) {
  const actor = await requireAdminApi("users.manage");
  const userId = text(body, "userId");
  const reason = requireReason(body);
  const before = await selectOne("admin_user_controls", "user_id", userId);

  const payload = {
    user_id: userId,
    purchase_blocked: boolean(body, "purchaseBlocked"),
    payout_blocked: boolean(body, "payoutBlocked"),
    notes: text(body, "notes") || null,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("admin_user_controls")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  await writeAdminAudit({
    actor,
    action: "user.controls.update",
    module: "users",
    targetType: "user",
    targetId: userId,
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function banUser(body: Body, banned: boolean) {
  const actor = await requireAdminApi("users.manage");
  const userId = text(body, "userId");
  const reason = requireReason(body);

  if (actor.id === userId && banned) {
    throw new AdminAccessError(
      "No puedes suspender tu propia cuenta administrativa.",
      409
    );
  }

  const before = await supabaseAdmin.auth.admin.getUserById(userId);
  if (before.error || !before.data.user) {
    throw new AdminAccessError("Usuario no encontrado.", 404);
  }

  const update = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none",
  });

  if (update.error) throw new Error(update.error.message);

  await writeAdminAudit({
    actor,
    action: banned ? "user.ban" : "user.unban",
    module: "users",
    targetType: "user",
    targetId: userId,
    reason,
    before: { bannedUntil: before.data.user.banned_until ?? null },
    after: { banned },
  });

  return ok();
}

async function roleChange(body: Body, operation: "add" | "remove") {
  const actor = await requireAdminApi("roles.manage");
  const userId = text(body, "userId");
  const role = text(body, "role");
  const reason = requireReason(body);

  if (!userId || !role) {
    throw new AdminAccessError("Faltan userId o role.", 400);
  }

  if (operation === "remove" && userId === actor.id && role === "admin") {
    throw new AdminAccessError("No puedes quitarte tu propio rol admin.", 409);
  }

  const { data: before } = await supabaseAdmin
    .from("user_roles")
    .select("user_id,role")
    .eq("user_id", userId);

  if (operation === "add") {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

    if (error) throw new Error(error.message);

    if (role === "admin") {
      const { error: permissionError } = await supabaseAdmin
        .from("admin_permissions")
        .upsert(
          {
            admin_user_id: userId,
            permission: "*",
            created_by: actor.id,
          },
          { onConflict: "admin_user_id,permission" }
        );

      if (permissionError) throw new Error(permissionError.message);
    }
  } else {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    if (error) throw new Error(error.message);

    if (role === "admin") {
      const { error: permissionError } = await supabaseAdmin
        .from("admin_permissions")
        .delete()
        .eq("admin_user_id", userId);

      if (permissionError) throw new Error(permissionError.message);
    }
  }

  const { data: after } = await supabaseAdmin
    .from("user_roles")
    .select("user_id,role")
    .eq("user_id", userId);

  await writeAdminAudit({
    actor,
    action: `role.${operation}`,
    module: "security",
    targetType: "user",
    targetId: userId,
    reason,
    before,
    after,
  });

  return ok();
}

async function updateFinanceConfig(body: Body) {
  const actor = await requireAdminApi("finance.configure");
  const reason = requireReason(body);

  const authorPct = number(body, "defaultAuthorRatePct");
  const affiliatePct = number(body, "defaultAffiliateRatePct");
  const holdDays = number(body, "earningsHoldDays");
  const minimumPayout = number(body, "minimumPayout");

  if (
    authorPct === null ||
    affiliatePct === null ||
    holdDays === null ||
    minimumPayout === null
  ) {
    throw new AdminAccessError("Configuración financiera inválida.", 400);
  }

  if (
    authorPct < 0 ||
    affiliatePct < 0 ||
    authorPct > 100 ||
    affiliatePct > 100 ||
    authorPct + affiliatePct > 100
  ) {
    throw new AdminAccessError(
      "La distribución autor + afiliado no puede exceder 100%.",
      400
    );
  }

  if (!Number.isInteger(holdDays) || holdDays < 0 || holdDays > 180) {
    throw new AdminAccessError(
      "Los días de retención deben estar entre 0 y 180.",
      400
    );
  }

  if (minimumPayout < 0) {
    throw new AdminAccessError("El retiro mínimo no puede ser negativo.", 400);
  }

  const { data: before, error: beforeError } = await supabaseAdmin
    .from("finance_config")
    .select("*")
    .eq("singleton", true)
    .single();

  if (beforeError) throw new Error(beforeError.message);

  const payload = {
    default_author_rate: authorPct / 100,
    default_affiliate_rate: affiliatePct / 100,
    earnings_hold_days: holdDays,
    minimum_payout: minimumPayout,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("finance_config")
    .update(payload)
    .eq("singleton", true);

  if (error) throw new Error(error.message);

  await writeAdminAudit({
    actor,
    action: "finance.config.update",
    module: "finance",
    targetType: "finance_config",
    targetId: "singleton",
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function financeAdjustment(body: Body) {
  const actor = await requireAdminApi("finance.adjust");
  const reason = requireReason(body);
  const userId = text(body, "userId");
  const roleContext = text(body, "roleContext");
  const direction = text(body, "direction");
  const currency = text(body, "currency").toUpperCase();
  const amount = number(body, "amount");

  if (!["customer", "author", "affiliate"].includes(roleContext)) {
    throw new AdminAccessError("Rol financiero inválido.", 400);
  }
  if (!["credit", "debit"].includes(direction)) {
    throw new AdminAccessError("Dirección contable inválida.", 400);
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AdminAccessError("Moneda inválida.", 400);
  }
  if (amount === null || amount <= 0) {
    throw new AdminAccessError("Monto inválido.", 400);
  }

  const userResult = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userResult.error || !userResult.data.user) {
    throw new AdminAccessError("Usuario no encontrado.", 404);
  }

  const sourceId = randomUUID();
  const accountBucket = roleContext === "customer" ? "benefit" : "earnings";
  const now = new Date().toISOString();
  const roundedAmount = Math.round(amount * 100) / 100;

  const row = {
    user_id: userId,
    role_context: roleContext,
    account_bucket: accountBucket,
    event_type: "adjustment",
    direction,
    currency,
    amount: roundedAmount,
    gross_amount: roundedAmount,
    fee_amount: 0,
    net_amount: roundedAmount,
    status: "available",
    source_type: "admin_adjustment",
    source_id: sourceId,
    idempotency_key: `admin-adjustment:${sourceId}`,
    description: `Ajuste administrativo: ${reason}`,
    reference: sourceId,
    available_at: accountBucket === "earnings" ? now : null,
    settled_at: now,
    metadata: {
      admin_user_id: actor.id,
      reason,
    },
  };

  const { data, error } = await supabaseAdmin
    .from("financial_ledger")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await writeAdminAudit({
    actor,
    action: "finance.adjustment",
    module: "finance",
    targetType: "user",
    targetId: userId,
    reason,
    before: null,
    after: {
      ledgerId: data.id,
      roleContext,
      direction,
      amount: roundedAmount,
      currency,
    },
  });

  return ok({ ledgerId: data.id });
}

async function updateAffiliate(body: Body) {
  const actor = await requireAdminApi("affiliates.manage");
  const reason = requireReason(body);
  const affiliateId = text(body, "affiliateId");
  const status = text(body, "status");
  const commissionRatePct = number(body, "commissionRatePct");
  const referralCode = text(body, "referralCode")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");

  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new AdminAccessError("Estado de afiliado inválido.", 400);
  }
  if (
    commissionRatePct === null ||
    commissionRatePct < 0 ||
    commissionRatePct > 100
  ) {
    throw new AdminAccessError("Comisión inválida.", 400);
  }
  if (referralCode.length < 4) {
    throw new AdminAccessError(
      "El código de afiliado debe tener al menos 4 caracteres.",
      400
    );
  }

  const before = await selectOne("affiliate_profiles", "id", affiliateId);
  if (!before) throw new AdminAccessError("Afiliado no encontrado.", 404);

  const payload = {
    status,
    referral_code: referralCode,
    code: referralCode,
    commission_rate: commissionRatePct,
    commission_rate_override: commissionRatePct / 100,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("affiliate_profiles")
    .update(payload)
    .eq("id", affiliateId);

  if (error) throw new Error(error.message);

  if (status === "approved") {
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: affiliateId, role: "affiliate" },
        { onConflict: "user_id,role" }
      );
    if (roleError) throw new Error(roleError.message);
  }

  await writeAdminAudit({
    actor,
    action: "affiliate.update",
    module: "affiliates",
    targetType: "affiliate",
    targetId: affiliateId,
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function updateAuthor(body: Body) {
  const actor = await requireAdminApi("authors.manage");
  const reason = requireReason(body);
  const authorProfileId = text(body, "authorProfileId");
  const status = text(body, "status");
  const rejectionReason = text(body, "rejectionReason");

  if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
    throw new AdminAccessError("Estado de autor inválido.", 400);
  }

  const before = await selectOne("author_profiles", "id", authorProfileId);
  if (!before) throw new AdminAccessError("Autor no encontrado.", 404);

  const payload = {
    approval_status: status,
    rejection_reason:
      status === "rejected" || status === "suspended"
        ? rejectionReason || reason
        : null,
  };

  const { error } = await supabaseAdmin
    .from("author_profiles")
    .update(payload)
    .eq("id", authorProfileId);

  if (error) throw new Error(error.message);

  await writeAdminAudit({
    actor,
    action: "author.update",
    module: "authors",
    targetType: "author_profile",
    targetId: authorProfileId,
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function updatePayout(body: Body) {
  const actor = await requireAdminApi("payouts.manage");
  const reason = requireReason(body);
  const payoutId = text(body, "payoutId");
  const status = text(body, "status");
  const reference = text(body, "reference");
  const failureReason = text(body, "failureReason");

  if (!["processing", "paid", "failed", "cancelled"].includes(status)) {
    throw new AdminAccessError("Estado de retiro inválido.", 400);
  }

  const before = await selectOne("financial_payouts", "id", payoutId);
  if (!before) throw new AdminAccessError("Retiro no encontrado.", 404);

  const { error } = await supabaseAdmin.rpc("finance_set_payout_status", {
    p_payout_id: payoutId,
    p_status: status,
    p_reference: reference || null,
    p_failure_reason: failureReason || null,
  });

  if (error) throw new Error(error.message);

  const after = await selectOne("financial_payouts", "id", payoutId);

  await writeAdminAudit({
    actor,
    action: "payout.status",
    module: "payouts",
    targetType: "payout",
    targetId: payoutId,
    reason,
    before,
    after,
  });

  return ok();
}

async function updateBook(body: Body) {
  const actor = await requireAdminApi("books.manage");
  const reason = requireReason(body);
  const bookId = text(body, "bookId");
  const title = text(body, "title");
  const slug = text(body, "slug");
  const status = text(body, "status");
  const paypalPrice = number(body, "paypalPrice");

  if (!title || !slug) {
    throw new AdminAccessError("Título y slug son obligatorios.", 400);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new AdminAccessError("Slug inválido.", 400);
  }
  if (!["draft", "under_review", "published"].includes(status)) {
    throw new AdminAccessError("Estado del libro inválido.", 400);
  }
  if (paypalPrice === null || paypalPrice <= 0) {
    throw new AdminAccessError("Precio PayPal inválido.", 400);
  }

  const before = await selectOne("books", "id", bookId);
  if (!before) throw new AdminAccessError("Libro no encontrado.", 404);

  const roundedPrice = Math.round(paypalPrice * 100) / 100;
  const payload = {
    title,
    slug,
    status,
    paypal_price: roundedPrice,
    paypal_currency: "USD",
  };

  const { error } = await supabaseAdmin
    .from("books")
    .update(payload)
    .eq("id", bookId);

  if (error) throw new Error(error.message);

  const editionResult = await supabaseAdmin
    .from("book_editions")
    .select("id")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (editionResult.data?.id) {
    const { error: editionError } = await supabaseAdmin
      .from("book_editions")
      .update({
        paypal_price: roundedPrice,
        paypal_currency: "USD",
      })
      .eq("id", editionResult.data.id);

    if (editionError) throw new Error(editionError.message);
  }

  await writeAdminAudit({
    actor,
    action: "book.update",
    module: "books",
    targetType: "book",
    targetId: bookId,
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function updateBookFinance(body: Body) {
  const actor = await requireAdminApi("books.manage");
  const reason = requireReason(body);
  const bookId = text(body, "bookId");
  const authorPct = nullableNumber(body, "authorRatePct");
  const affiliatePct = nullableNumber(body, "affiliateRatePct");
  const holdDays = nullableNumber(body, "holdDays");

  for (const value of [authorPct, affiliatePct]) {
    if (value !== null && (value < 0 || value > 100)) {
      throw new AdminAccessError("Porcentaje financiero inválido.", 400);
    }
  }

  if (
    holdDays !== null &&
    (!Number.isInteger(holdDays) || holdDays < 0 || holdDays > 180)
  ) {
    throw new AdminAccessError("Hold days inválido.", 400);
  }

  const { data: config, error: configError } = await supabaseAdmin
    .from("finance_config")
    .select("default_author_rate,default_affiliate_rate")
    .eq("singleton", true)
    .single();

  if (configError) throw new Error(configError.message);

  const effectiveAuthor =
    authorPct === null ? Number(config.default_author_rate) : authorPct / 100;
  const effectiveAffiliate =
    affiliatePct === null
      ? Number(config.default_affiliate_rate)
      : affiliatePct / 100;

  if (effectiveAuthor + effectiveAffiliate > 1) {
    throw new AdminAccessError(
      "La distribución efectiva autor + afiliado excede 100%.",
      400
    );
  }

  const before = await selectOne("book_finance_rules", "book_id", bookId);

  const payload = {
    book_id: bookId,
    author_rate: authorPct === null ? null : authorPct / 100,
    affiliate_rate: affiliatePct === null ? null : affiliatePct / 100,
    hold_days: holdDays,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("book_finance_rules")
    .upsert(payload, { onConflict: "book_id" });

  if (error) throw new Error(error.message);

  await writeAdminAudit({
    actor,
    action: "book.finance.update",
    module: "finance",
    targetType: "book",
    targetId: bookId,
    reason,
    before,
    after: payload,
  });

  return ok();
}

async function setAdminPermissions(body: Body) {
  const actor = await requireAdminApi("security.manage");
  const reason = requireReason(body);
  const adminUserId = text(body, "adminUserId");

  const raw = Array.isArray(body.permissions) ? body.permissions : [];
  const permissions = [
    ...new Set(
      raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];

  const { data: adminRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", adminUserId)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) throw new Error(roleError.message);
  if (!adminRole) {
    throw new AdminAccessError("El usuario no tiene rol admin.", 409);
  }

  if (adminUserId === actor.id && !permissions.includes("*")) {
    const { count, error: countError } = await supabaseAdmin
      .from("admin_permissions")
      .select("*", { count: "exact", head: true })
      .eq("permission", "*")
      .neq("admin_user_id", actor.id);

    if (countError) throw new Error(countError.message);

    if ((count ?? 0) === 0) {
      throw new AdminAccessError(
        "No puedes retirar tu acceso total si no existe otro administrador con permiso *.",
        409
      );
    }
  }

  const { data: before, error: beforeError } = await supabaseAdmin
    .from("admin_permissions")
    .select("permission")
    .eq("admin_user_id", adminUserId);

  if (beforeError) throw new Error(beforeError.message);

  const { error: deleteError } = await supabaseAdmin
    .from("admin_permissions")
    .delete()
    .eq("admin_user_id", adminUserId);

  if (deleteError) throw new Error(deleteError.message);

  if (permissions.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("admin_permissions")
      .insert(
        permissions.map((permission) => ({
          admin_user_id: adminUserId,
          permission,
          created_by: actor.id,
        }))
      );

    if (insertError) throw new Error(insertError.message);
  }

  await writeAdminAudit({
    actor,
    action: "admin.permissions.set",
    module: "security",
    targetType: "admin",
    targetId: adminUserId,
    reason,
    before: before ?? [],
    after: permissions,
  });

  return ok();
}

async function refundPurchase(body: Body) {
  const actor = await requireAdminApi("refunds.manage");
  const reason = requireReason(body);
  const purchaseId = text(body, "purchaseId");
  const amount = number(body, "amount");

  if (amount === null || amount <= 0) {
    throw new AdminAccessError("Monto de reembolso inválido.", 400);
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("book_purchases")
    .select(
      "id,user_id,book_id,amount_paid,currency,payment_provider,payment_reference,provider_order_id,revoked_at"
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseError) throw new Error(purchaseError.message);
  if (!purchase) throw new AdminAccessError("Compra no encontrada.", 404);
  if (purchase.payment_provider !== "paypal") {
    throw new AdminAccessError(
      "Este reembolso automático solo está habilitado para PayPal.",
      409
    );
  }

  const captureId = String(purchase.payment_reference || "").trim();
  if (!captureId) {
    throw new AdminAccessError("La compra no tiene PayPal Capture ID.", 409);
  }

  const { data: originalLedger, error: ledgerError } = await supabaseAdmin
    .from("financial_ledger")
    .select("amount")
    .eq("purchase_id", purchaseId)
    .eq("role_context", "customer")
    .eq("event_type", "purchase")
    .eq("direction", "debit")
    .limit(1)
    .maybeSingle();

  if (ledgerError) throw new Error(ledgerError.message);
  if (!originalLedger) {
    throw new AdminAccessError(
      "La compra todavía no está en el ledger canónico. Haz primero el backfill antes de reembolsarla desde SUPERADMIN.",
      409
    );
  }

  const { data: previousRefundRows, error: previousRefundError } =
    await supabaseAdmin
      .from("financial_ledger")
      .select("amount")
      .eq("purchase_id", purchaseId)
      .eq("role_context", "customer")
      .eq("event_type", "refund")
      .eq("direction", "credit")
      .not("status", "in", '("failed","cancelled")');

  if (previousRefundError) throw new Error(previousRefundError.message);

  const alreadyRefunded = (previousRefundRows ?? []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const remaining = Math.max(
    0,
    Number(originalLedger.amount) - alreadyRefunded
  );

  if (amount > remaining + 0.0001) {
    throw new AdminAccessError(
      `El máximo reembolsable restante es ${purchase.currency} ${remaining.toFixed(2)}.`,
      409
    );
  }

  const requestId = `admin-refund-${purchaseId}-${randomUUID()}`;

  const paypalRefund = await refundPayPalCapture({
    captureId,
    amount,
    currency: String(purchase.currency || "USD").toUpperCase(),
    requestId,
  });

  const refundReference =
    typeof paypalRefund.id === "string" && paypalRefund.id.trim()
      ? paypalRefund.id
      : requestId;

  const { error: financeError } = await supabaseAdmin.rpc(
    "finance_record_refund",
    {
      p_purchase_id: purchaseId,
      p_refund_amount: amount,
      p_refund_reference: refundReference,
    }
  );

  if (financeError) {
    await writeAdminAudit({
      actor,
      action: "purchase.refund.reconcile_required",
      module: "purchases",
      targetType: "purchase",
      targetId: purchaseId,
      reason,
      before: purchase,
      after: {
        paypalRefund,
        financeError: financeError.message,
      },
    });

    throw new Error(
      `PayPal reembolsó, pero el ledger requiere conciliación manual: ${financeError.message}`
    );
  }

  if (Math.abs(amount - remaining) < 0.005) {
    const { error: revokeError } = await supabaseAdmin
      .from("book_purchases")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", purchaseId);

    if (revokeError) throw new Error(revokeError.message);
  }

  await writeAdminAudit({
    actor,
    action: "purchase.refund",
    module: "purchases",
    targetType: "purchase",
    targetId: purchaseId,
    reason,
    before: purchase,
    after: {
      amount,
      currency: purchase.currency,
      paypalRefund,
      refundReference,
      fullRefund: Math.abs(amount - remaining) < 0.005,
    },
  });

  return ok({ refundReference });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "JSON inválido." },
        { status: 400 }
      );
    }

    const action = text(body, "action");

    switch (action) {
      case "user.update":
        return await updateUser(body);
      case "user.controls":
        return await updateControls(body);
      case "user.ban":
        return await banUser(body, true);
      case "user.unban":
        return await banUser(body, false);
      case "role.add":
        return await roleChange(body, "add");
      case "role.remove":
        return await roleChange(body, "remove");
      case "finance.config.update":
        return await updateFinanceConfig(body);
      case "finance.adjustment":
        return await financeAdjustment(body);
      case "affiliate.update":
        return await updateAffiliate(body);
      case "author.update":
        return await updateAuthor(body);
      case "payout.status":
        return await updatePayout(body);
      case "book.update":
        return await updateBook(body);
      case "book.finance.update":
        return await updateBookFinance(body);
      case "admin.permissions.set":
        return await setAdminPermissions(body);
      case "purchase.refund":
        return await refundPurchase(body);
      default:
        return NextResponse.json(
          { ok: false, error: "Acción administrativa desconocida." },
          { status: 400 }
        );
    }
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "Error administrativo interno.";

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
