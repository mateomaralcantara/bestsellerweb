import { supabaseAdmin } from "@/lib/supabase/admin";

export type AuthorPublishingAccessReason =
  | "missing_profile"
  | "missing_section"
  | "pending"
  | "rejected"
  | "suspended"
  | "not_approved"
  | "allowed";

export type AuthorPublishingAccess = {
  allowed: boolean;
  reason: AuthorPublishingAccessReason;
  message: string;
  authorId: string | null;
  profile: {
    id: string;
    user_id: string | null;
    slug: string | null;
    display_name: string | null;
    pen_name: string | null;
    approval_status: string | null;
    rejection_reason: string | null;
  } | null;
};

function getBlockedResponse(params: {
  reason: AuthorPublishingAccessReason;
  message: string;
  authorId?: string | null;
  profile?: AuthorPublishingAccess["profile"];
}): AuthorPublishingAccess {
  return {
    allowed: false,
    reason: params.reason,
    message: params.message,
    authorId: params.authorId ?? null,
    profile: params.profile ?? null,
  };
}

export async function getAuthorPublishingAccess(
  userId: string
): Promise<AuthorPublishingAccess> {
  if (!userId?.trim()) {
    return getBlockedResponse({
      reason: "missing_profile",
      message: "Debes iniciar sesión para publicar libros.",
    });
  }

  const { data: profile, error } = await supabaseAdmin
    .from("author_profiles")
    .select(
      `
        id,
        user_id,
        slug,
        display_name,
        pen_name,
        approval_status,
        rejection_reason
      `
    )
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error verificando perfil de autor: ${error.message}`);
  }

  if (!profile) {
    return getBlockedResponse({
      reason: "missing_profile",
      message:
        "Primero debes crear tu sección de autor antes de poder publicar libros.",
    });
  }

  const hasPublicName = Boolean(
    profile.display_name?.trim() || profile.pen_name?.trim()
  );

  const hasSlug = Boolean(profile.slug?.trim());

  if (!hasPublicName || !hasSlug) {
    return getBlockedResponse({
      reason: "missing_section",
      message:
        "Tu sección de autor está incompleta. Completa tu nombre público y tu slug antes de publicar.",
      authorId: profile.id,
      profile,
    });
  }

  const status = profile.approval_status || "pending";

  if (status === "approved") {
    return {
      allowed: true,
      reason: "allowed",
      message: "Autor aprobado para publicar.",
      authorId: profile.id,
      profile,
    };
  }

  if (status === "pending") {
    return getBlockedResponse({
      reason: "pending",
      message:
        "Tu sección de autor está en revisión. Cuando sea aprobada podrás publicar libros.",
      authorId: profile.id,
      profile,
    });
  }

  if (status === "rejected") {
    return getBlockedResponse({
      reason: "rejected",
      message:
        profile.rejection_reason ||
        "Tu sección de autor fue rechazada. Debes corregirla antes de publicar.",
      authorId: profile.id,
      profile,
    });
  }

  if (status === "suspended") {
    return getBlockedResponse({
      reason: "suspended",
      message:
        "Tu sección de autor está suspendida. No puedes publicar libros en este momento.",
      authorId: profile.id,
      profile,
    });
  }

  return getBlockedResponse({
    reason: "not_approved",
    message:
      "Tu sección de autor todavía no está aprobada para publicar libros.",
    authorId: profile.id,
    profile,
  });
}