import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBookCheckoutItem } from "@/lib/paypal/book-checkout";
import { createPayPalOrder, PayPalApiError } from "@/lib/paypal/client";
import { userAlreadyOwnsBook } from "@/lib/paypal/purchases";
import {
  errorStatus,
  isUuid,
  publicErrorMessage,
  readJsonBody,
  requireTrustedMutation,
} from "@/lib/security/http";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: process.env.NODE_ENV === "development" ? details : undefined,
    },
    { status }
  );
}

function getLocalOrderError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205"
  ) {
    return "Falta aplicar la migración de PayPal en Supabase.";
  }

  if (code === "23503") {
    return "El usuario o el libro no coincide con los registros de Supabase.";
  }

  return "No se pudo crear la orden local.";
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Debes iniciar sesión para comprar.", 401);
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "paypal:create-order",
      identity: user.id,
      limit: 10,
      windowSeconds: 600,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos. Espera antes de reintentar." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await readJsonBody<{ bookId?: unknown }>(request, 1_024);
    const bookId =
      typeof body?.bookId === "string" ? body.bookId.trim() : "";

    if (!isUuid(bookId)) return fail("El bookId no es válido.", 400);

    if (await userAlreadyOwnsBook({ userId: user.id, bookId })) {
      return NextResponse.json(
        {
          ok: false,
          alreadyPurchased: true,
          error: "Ya tienes acceso a este libro.",
        },
        { status: 409 }
      );
    }

    const book = await getBookCheckoutItem(bookId);

    const { data: localOrder, error: insertError } = await supabaseAdmin
      .from("paypal_orders")
      .insert({
        user_id: user.id,
        book_id: book.id,
        status: "creating",
        amount: Number(book.amount),
        currency: book.currency,
      })
      .select("id")
      .single();

    if (insertError || !localOrder) {
      return fail(getLocalOrderError(insertError), 500, insertError);
    }

    try {
      const paypalOrder = await createPayPalOrder({
        localOrderId: localOrder.id,
        bookTitle: book.title,
        amount: book.amount,
        currency: book.currency,
      });

      if (!paypalOrder.id) {
        throw new Error("PayPal no devolvió el identificador de la orden.");
      }

      const purchaseUnit = paypalOrder.purchase_units?.[0];
      const returnedAmount = Number(purchaseUnit?.amount?.value);
      const validRepresentation =
        paypalOrder.status === "CREATED" &&
        purchaseUnit?.reference_id === localOrder.id &&
        purchaseUnit?.custom_id === localOrder.id &&
        purchaseUnit?.invoice_id === localOrder.id &&
        purchaseUnit?.amount?.currency_code === book.currency &&
        Number.isFinite(returnedAmount) &&
        Math.abs(returnedAmount - Number(book.amount)) < 0.001;

      if (!validRepresentation) {
        throw new Error("PayPal devolvió una orden con datos inconsistentes.");
      }

      const { error: updateError } = await supabaseAdmin
        .from("paypal_orders")
        .update({
          paypal_order_id: paypalOrder.id,
          status: paypalOrder.status?.toLowerCase() || "created",
          raw_create: paypalOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      if (updateError) {
        return fail(
          "PayPal creó la orden, pero no se pudo guardar localmente.",
          500,
          updateError
        );
      }

      return NextResponse.json({
        ok: true,
        orderId: paypalOrder.id,
      });
    } catch (error) {
      await supabaseAdmin
        .from("paypal_orders")
        .update({
          status: "failed",
          failure_reason:
            error instanceof Error ? error.message : "Error desconocido",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      throw error;
    }
  } catch (error) {
    console.error("create-order:", error);

    if (error instanceof PayPalApiError) {
      return fail(
        "PayPal rechazó la creación de la orden.",
        502,
        error.details
      );
    }

    return fail(
      publicErrorMessage(error, "No se pudo crear la orden."),
      errorStatus(error)
    );
  }
}
