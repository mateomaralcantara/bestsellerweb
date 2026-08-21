import { supabaseAdmin } from "@/lib/supabase/admin";

const ACCESS_STATUSES = [
  "paid",
  "completed",
  "approved",
  "succeeded",
];

export async function userAlreadyOwnsBook(input: {
  userId: string;
  bookId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("book_purchases")
    .select("id")
    .eq("user_id", input.userId)
    .eq("book_id", input.bookId)
    .in("status", ACCESS_STATUSES)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Error verificando compra: ${error.message}`);
  return Boolean(data);
}

export async function grantBookPurchase(input: {
  userId: string;
  bookId: string;
  amount: string;
  currency: string;
  paypalOrderId: string;
  paypalCaptureId: string;
}) {
  const { data: atomicId, error: atomicError } = await supabaseAdmin.rpc(
    "grant_book_purchase_atomic",
    {
      p_amount: Number(input.amount),
      p_book_id: input.bookId,
      p_currency: input.currency,
      p_paypal_capture_id: input.paypalCaptureId,
      p_paypal_order_id: input.paypalOrderId,
      p_user_id: input.userId,
    }
  );

  if (!atomicError && typeof atomicId === "string") {
    return atomicId;
  }

  const missingFunction =
    atomicError?.code === "PGRST202" ||
    atomicError?.code === "42883" ||
    atomicError?.message?.includes("grant_book_purchase_atomic");

  if (!missingFunction) {
    throw new Error(
      `Error otorgando acceso atómico: ${atomicError?.message || "respuesta inválida"}`
    );
  }

  console.warn(
    "Falta aplicar 20260820_total_security_hardening.sql; usando compatibilidad temporal."
  );

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("book_purchases")
    .select("id")
    .eq("user_id", input.userId)
    .eq("book_id", input.bookId)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Error buscando compra: ${lookupError.message}`);
  }

  const payload = {
    user_id: input.userId,
    book_id: input.bookId,
    status: "paid",
    payment_provider: "paypal",
    payment_reference: input.paypalCaptureId,
    provider_order_id: input.paypalOrderId,
    amount_paid: Number(input.amount),
    currency: input.currency,
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("book_purchases")
      .update(payload)
      .eq("id", existing.id);

    if (error) throw new Error(`Error actualizando compra: ${error.message}`);
    return existing.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("book_purchases")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(`Error registrando compra: ${error.message}`);
  return data.id as string;
}
