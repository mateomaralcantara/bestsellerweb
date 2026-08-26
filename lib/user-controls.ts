import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type UserControls = {
  purchaseBlocked: boolean;
  payoutBlocked: boolean;
  notes: string | null;
};

export async function getUserControls(userId: string): Promise<UserControls> {
  const { data, error } = await supabaseAdmin
    .from("admin_user_controls")
    .select("purchase_blocked,payout_blocked,notes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return {
        purchaseBlocked: false,
        payoutBlocked: false,
        notes: null,
      };
    }

    throw new Error(
      `No se pudieron consultar los controles del usuario: ${error.message}`
    );
  }

  return {
    purchaseBlocked: Boolean(data?.purchase_blocked),
    payoutBlocked: Boolean(data?.payout_blocked),
    notes: data?.notes ?? null,
  };
}
