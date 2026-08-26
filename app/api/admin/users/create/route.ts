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

const ALLOWED_SPECIAL_ROLES = new Set(["author", "affiliate", "admin"]);

function text(body: Body, key: string) {
  return typeof body[key] === "string" ? String(body[key]).trim() : "";
}

function boolean(body: Body, key: string) {
  return body[key] === true;
}

function reason(body: Body) {
  const value = text(body, "reason");

  if (value.length < 5) {
    throw new AdminAccessError(
      "Debes indicar un motivo administrativo de al menos 5 caracteres.",
      400
    );
  }

  return value;
}

function normalizeRoles(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((role) => String(role).trim().toLowerCase())
        .filter((role) => ALLOWED_SPECIAL_ROLES.has(role))
    ),
  ];
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body = (await request.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const actor = await requireAdminApi("users.manage");
    const why = reason(body);
    const email = text(body, "email").toLowerCase();
    const fullName = text(body, "fullName");
    const password = text(body, "password");
    const roles = normalizeRoles(body.roles);

    if (!validEmail(email)) {
      throw new AdminAccessError("Correo inválido.", 400);
    }

    if (fullName.length < 2) {
      throw new AdminAccessError("Nombre completo inválido.", 400);
    }

    if (password.length < 10) {
      throw new AdminAccessError(
        "La contraseña temporal debe tener al menos 10 caracteres.",
        400
      );
    }

    if (roles.length > 0) {
      await requireAdminApi("roles.manage");
    }

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: boolean(body, "emailConfirm"),
      user_metadata: {
        full_name: fullName,
      },
    });

    if (created.error || !created.data.user) {
      throw new AdminAccessError(
        created.error?.message || "No se pudo crear el usuario.",
        409
      );
    }

    createdUserId = created.data.user.id;

    const profileResult = await supabaseAdmin.from("profiles").upsert(
      {
        id: createdUserId,
        full_name: fullName,
      },
      { onConflict: "id" }
    );

    if (profileResult.error) {
      throw new Error(profileResult.error.message);
    }

    if (roles.length > 0) {
      const roleRows = roles.map((role) => ({
        user_id: createdUserId,
        role,
      }));

      const roleResult = await supabaseAdmin
        .from("user_roles")
        .upsert(roleRows, { onConflict: "user_id,role" });

      if (roleResult.error) {
        throw new Error(roleResult.error.message);
      }
    }

    if (roles.includes("admin")) {
      const permissionResult = await supabaseAdmin
        .from("admin_permissions")
        .upsert(
          {
            admin_user_id: createdUserId,
            permission: "*",
            created_by: actor.id,
          },
          { onConflict: "admin_user_id,permission" }
        );

      if (permissionResult.error) {
        throw new Error(permissionResult.error.message);
      }
    }

    const controlsResult = await supabaseAdmin
      .from("admin_user_controls")
      .upsert(
        {
          user_id: createdUserId,
          purchase_blocked: boolean(body, "purchaseBlocked"),
          payout_blocked: boolean(body, "payoutBlocked"),
          notes: "Cuenta creada desde SUPERADMIN",
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (controlsResult.error) {
      throw new Error(controlsResult.error.message);
    }

    await writeAdminAudit({
      actor,
      action: "user.create",
      module: "users",
      targetType: "user",
      targetId: createdUserId,
      reason: why,
      before: null,
      after: {
        email,
        fullName,
        roles,
        emailConfirmed: boolean(body, "emailConfirm"),
        purchaseBlocked: boolean(body, "purchaseBlocked"),
        payoutBlocked: boolean(body, "payoutBlocked"),
      },
    });

    return NextResponse.json({
      ok: true,
      userId: createdUserId,
      email,
      roles,
    });
  } catch (error) {
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch (rollbackError) {
        console.error("SUPERADMIN CREATE USER ROLLBACK:", rollbackError);
      }
    }

    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("SUPERADMIN CREATE USER:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error administrativo creando usuario.",
      },
      { status: 500 }
    );
  }
}
