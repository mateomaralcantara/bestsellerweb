import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminAccessError, requireAdminApi, writeAdminAudit } from "@/lib/admin/superadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;
type Context = { params: Promise<{ id: string }> };

function text(body: Body, key: string) { return typeof body[key] === "string" ? String(body[key]).trim() : ""; }
function reason(body: Body) { const value = text(body, "reason"); if (value.length < 3) throw new AdminAccessError("Debes indicar un motivo administrativo.", 400); return value; }
function ok() { return NextResponse.json({ ok: true }); }

async function userOr404(userId: string) {
  const result = await supabaseAdmin.auth.admin.getUserById(userId);
  if (result.error || !result.data.user) throw new AdminAccessError("Usuario no encontrado.", 404);
  return result.data.user;
}

async function setPassword(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body); const password = text(body, "password");
  if (password.length < 10) throw new AdminAccessError("La nueva contrasena debe tener al menos 10 caracteres.", 400);
  await userOr404(userId);
  const result = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (result.error) throw new Error(result.error.message);
  await writeAdminAudit({ actor, action: "user.password.set", module: "users", targetType: "user", targetId: userId, reason: why, before: null, after: { passwordChanged: true } });
  return ok();
}

async function updateMetadata(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body); const user = await userOr404(userId); const metadata = body.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new AdminAccessError("Metadata invalida.", 400);
  const result = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: metadata as Record<string, unknown> });
  if (result.error) throw new Error(result.error.message);
  await writeAdminAudit({ actor, action: "user.metadata.update", module: "users", targetType: "user", targetId: userId, reason: why, before: user.user_metadata ?? {}, after: metadata });
  return ok();
}

async function purchaseAccess(userId: string, body: Body) {
  const actor = await requireAdminApi("users.manage");
  const why = reason(body); const purchaseId = text(body, "purchaseId"); const grant = body.grant === true;
  const purchase = await supabaseAdmin.from("book_purchases").select("id,user_id,amount_paid,revoked_at").eq("id", purchaseId).eq("user_id", userId).maybeSingle();
  if (purchase.error) throw new Error(purchase.error.message);
  if (!purchase.data) throw new AdminAccessError("Compra no encontrada para este usuario.", 404);

  if (grant) {
    const refunds = await supabaseAdmin.from("financial_ledger").select("amount,status,direction").eq("purchase_id", purchaseId).eq("event_type", "refund").eq("direction", "credit").not("status", "in", '("failed","cancelled")');
    if (refunds.error) throw new Error(refunds.error.message);
    const refunded = (refunds.data ?? []).reduce((total, row) => total + Number(row.amount || 0), 0);
    const paid = Number(purchase.data.amount_paid || 0);
    if (paid > 0 && refunded + 0.005 >= paid) throw new AdminAccessError("No se puede reactivar una compra totalmente reembolsada.", 409);
  }

  const revokedAt = grant ? null : new Date().toISOString();
  const update = await supabaseAdmin.from("book_purchases").update({ revoked_at: revokedAt }).eq("id", purchaseId).eq("user_id", userId);
  if (update.error) throw new Error(update.error.message);
  await writeAdminAudit({ actor, action: grant ? "purchase.access.grant" : "purchase.access.revoke", module: "purchases", targetType: "user", targetId: userId, reason: why, before: { purchaseId, revokedAt: purchase.data.revoked_at }, after: { purchaseId, revokedAt } });
  return ok();
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) return NextResponse.json({ ok: false, error: "Body invalido." }, { status: 400 });
    switch (text(body, "action")) {
      case "password.set": return await setPassword(id, body);
      case "metadata.update": return await updateMetadata(id, body);
      case "purchase.access": return await purchaseAccess(id, body);
      default: throw new AdminAccessError("Accion USER 360 no soportada.", 400);
    }
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("SUPERADMIN USER360:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error administrativo." }, { status: 500 });
  }
}