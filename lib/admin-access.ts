import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminAccess = {
  user: {
    id: string;
    email: string | null;
  } | null;
  isAdmin: boolean;
};

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      isAdmin: false,
    };
  }

  const { data: adminRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (roleError) {
    console.error("No se pudo verificar el rol administrativo:", roleError.message);
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    isAdmin: Boolean(adminRole) && !roleError,
  };
}
