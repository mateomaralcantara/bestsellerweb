import "server-only";

import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export class AdminAccessError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export type AdminActor = {
  id: string;
  email: string | null;
};

async function hasPermission(userId: string, permission: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_permissions")
    .select("permission")
    .eq("admin_user_id", userId)
    .in("permission", ["*", permission])
    .limit(1);

  if (error) {
    throw new AdminAccessError(
      `No se pudo verificar el permiso administrativo: ${error.message}`,
      500
    );
  }

  return Boolean(data?.length);
}

export async function requireAdminRolePage(): Promise<AdminActor> {
  const access = await getAdminAccess();

  if (!access.user) {
    redirect(`/auth?next=${encodeURIComponent("/admin")}`);
  }

  if (!access.isAdmin) {
    redirect("/dashboard");
  }

  return access.user;
}

export async function requireAdminPage(
  permission: string
): Promise<AdminActor> {
  const actor = await requireAdminRolePage();

  if (!(await hasPermission(actor.id, permission))) {
    redirect("/dashboard");
  }

  return actor;
}

export async function requireAdminApi(
  permission: string
): Promise<AdminActor> {
  const access = await getAdminAccess();

  if (!access.user) {
    throw new AdminAccessError("Debes iniciar sesión.", 401);
  }

  if (!access.isAdmin) {
    throw new AdminAccessError("Acceso administrativo denegado.", 403);
  }

  if (!(await hasPermission(access.user.id, permission))) {
    throw new AdminAccessError(
      `No tienes el permiso administrativo: ${permission}`,
      403
    );
  }

  return access.user;
}

export async function writeAdminAudit(input: {
  actor: AdminActor;
  action: string;
  module: string;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: input.actor.id,
    action: input.action,
    module: input.module,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    reason: input.reason?.trim() || null,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
  });

  if (error) {
    throw new Error(`No se pudo escribir la auditoría: ${error.message}`);
  }
}
