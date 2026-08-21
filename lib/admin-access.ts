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

export async function userIsAdmin(userId: string) {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("No se pudo verificar el rol administrativo:", error.message);
    return false;
  }

  return Boolean(data);
}

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

  const isAdmin = await userIsAdmin(user.id);

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    isAdmin,
  };
}
