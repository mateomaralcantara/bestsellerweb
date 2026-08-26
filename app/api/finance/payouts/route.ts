import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayoutRole = "author" | "affiliate";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Debes iniciar sesión.", 401);
  }

  const { data, error } = await supabase
    .from("financial_payouts")
    .select(
      "id,user_id,role_context,currency,requested_amount,fee_amount,net_amount,method,status,payout_reference,failure_reason,requested_at,processed_at"
    )
    .eq("user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(100);

  if (error) {
    return fail(error.message, 500);
  }

  return NextResponse.json({
    ok: true,
    payouts: data ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Debes iniciar sesión.", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        amount?: unknown;
        currency?: unknown;
        method?: unknown;
        roleContext?: unknown;
      }
    | null;

  const amount = Number(body?.amount);

  const currency =
    typeof body?.currency === "string"
      ? body.currency.trim().toUpperCase()
      : "USD";

  const method =
    typeof body?.method === "string"
      ? body.method.trim().toLowerCase()
      : "paypal";

  if (body?.roleContext !== "author" && body?.roleContext !== "affiliate") {
    return fail("Debes indicar si el retiro corresponde a autor o afiliado.", 400);
  }

  const roleContext: PayoutRole = body.roleContext;

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Monto inválido.", 400);
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return fail("Moneda inválida.", 400);
  }

  if (!method) {
    return fail("Método de retiro inválido.", 400);
  }

  const { data, error } = await supabase.rpc("finance_request_payout", {
    p_amount: amount,
    p_currency: currency,
    p_method: method,
    p_role_context: roleContext,
  });

  if (error) {
    return fail(error.message, 409);
  }

  return NextResponse.json({
    ok: true,
    payoutId: data,
    roleContext,
  });
}