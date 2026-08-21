import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  capturePayPalOrder,
  getPayPalOrder,
  PayPalApiError,
  type PayPalOrder,
} from "@/lib/paypal/client";
import { grantBookPurchase } from "@/lib/paypal/purchases";
import {
  errorStatus,
  isPayPalOrderId,
  publicErrorMessage,
  readJsonBody,
  requireTrustedMutation,
} from "@/lib/security/http";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalOrder = {
  id: string;
  user_id: string;
  book_id: string;
  paypal_order_id: string;
  paypal_capture_id: string | null;
  status: string;
  amount: number;
  currency: string;
};

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

function extractCapture(order: PayPalOrder) {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];

  return {
    orderStatus: order.status,
    captureId: capture?.id || null,
    captureStatus: capture?.status || null,
    amount: capture?.amount?.value || unit?.amount?.value || null,
    currency:
      capture?.amount?.currency_code ||
      unit?.amount?.currency_code ||
      null,
    payerEmail: order.payer?.email_address || null,
  };
}

function amountMatches(expected: number, received: string | null) {
  if (!received) return false;
  const value = Number(received);
  return Number.isFinite(value) && Math.abs(expected - value) < 0.001;
}

function referencesMatch(order: PayPalOrder, localOrderId: string) {
  const unit = order.purchase_units?.[0];
  return (
    unit?.reference_id === localOrderId &&
    unit?.custom_id === localOrderId &&
    unit?.invoice_id === localOrderId
  );
}

function isAlreadyCapturedError(error: PayPalApiError) {
  try {
    return JSON.stringify(error.details).includes("ORDER_ALREADY_CAPTURED");
  } catch {
    return false;
  }
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
      return fail("Debes iniciar sesión para confirmar el pago.", 401);
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "paypal:capture-order",
      identity: user.id,
      limit: 15,
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

    const body = await readJsonBody<{ orderId?: unknown }>(request, 1_024);
    const orderId =
      typeof body?.orderId === "string" ? body.orderId.trim() : "";

    if (!isPayPalOrderId(orderId)) {
      return fail("El orderId no es válido.", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("paypal_orders")
      .select(
        "id, user_id, book_id, paypal_order_id, paypal_capture_id, status, amount, currency"
      )
      .eq("paypal_order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return fail("No se pudo consultar la orden.", 500, error);
    if (!data) return fail("Orden no encontrada.", 404);

    const localOrder = data as LocalOrder;

    if (
      localOrder.status === "completed" &&
      localOrder.paypal_capture_id
    ) {
      await grantBookPurchase({
        userId: localOrder.user_id,
        bookId: localOrder.book_id,
        amount: Number(localOrder.amount).toFixed(2),
        currency: localOrder.currency,
        paypalOrderId: localOrder.paypal_order_id,
        paypalCaptureId: localOrder.paypal_capture_id,
      });

      return NextResponse.json({
        ok: true,
        alreadyCaptured: true,
        accessReconciled: true,
        captureId: localOrder.paypal_capture_id,
        redirectUrl: `/checkout/paypal/success?bookId=${encodeURIComponent(
          localOrder.book_id
        )}`,
      });
    }

    const staleBefore = new Date(Date.now() - 120_000).toISOString();
    const { data: captureClaim, error: captureClaimError } = await supabaseAdmin
      .from("paypal_orders")
      .update({
        status: "capturing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", localOrder.id)
      .neq("status", "completed")
      .or(`status.neq.capturing,updated_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();

    if (captureClaimError) {
      return fail("No se pudo reservar la captura del pago.", 500);
    }

    if (!captureClaim) {
      return fail("Este pago ya se está confirmando. Espera unos segundos.", 409);
    }

    let paypalOrder: PayPalOrder;

    try {
      paypalOrder = await capturePayPalOrder(
        localOrder.paypal_order_id,
        localOrder.id
      );
    } catch (error) {
      if (error instanceof PayPalApiError && isAlreadyCapturedError(error)) {
        paypalOrder = await getPayPalOrder(localOrder.paypal_order_id);
      } else {
        await supabaseAdmin
          .from("paypal_orders")
          .update({
            status: "capture_failed",
            failure_reason:
              error instanceof Error ? error.message.slice(0, 500) : "Error de captura",
            updated_at: new Date().toISOString(),
          })
          .eq("id", localOrder.id)
          .eq("status", "capturing");
        throw error;
      }
    }

    const capture = extractCapture(paypalOrder);

    if (
      capture.orderStatus !== "COMPLETED" ||
      capture.captureStatus !== "COMPLETED" ||
      !capture.captureId
    ) {
      await supabaseAdmin
        .from("paypal_orders")
        .update({
          status: "capture_pending",
          raw_capture: paypalOrder,
          failure_reason: "PayPal todavía no confirmó la captura.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      return fail(
        "PayPal no confirmó el pago como completado.",
        409,
        paypalOrder
      );
    }

    if (!referencesMatch(paypalOrder, localOrder.id)) {
      await supabaseAdmin
        .from("paypal_orders")
        .update({
          status: "reference_mismatch",
          raw_capture: paypalOrder,
          failure_reason: "Las referencias de PayPal no coinciden.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      return fail("La referencia confirmada no coincide con la orden.", 409);
    }

    if (
      !amountMatches(Number(localOrder.amount), capture.amount) ||
      capture.currency !== localOrder.currency
    ) {
      await supabaseAdmin
        .from("paypal_orders")
        .update({
          status: "amount_mismatch",
          raw_capture: paypalOrder,
          failure_reason: "Importe o moneda diferente.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      return fail("El importe confirmado no coincide con la orden.", 409);
    }

    const { error: updateError } = await supabaseAdmin
      .from("paypal_orders")
      .update({
        paypal_capture_id: capture.captureId,
        payer_email: capture.payerEmail,
        status: "completed",
        raw_capture: paypalOrder,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", localOrder.id);

    if (updateError) {
      return fail(
        "El pago fue capturado, pero no se pudo actualizar.",
        500,
        updateError
      );
    }

    await grantBookPurchase({
      userId: localOrder.user_id,
      bookId: localOrder.book_id,
      amount: Number(localOrder.amount).toFixed(2),
      currency: localOrder.currency,
      paypalOrderId: localOrder.paypal_order_id,
      paypalCaptureId: capture.captureId,
    });

    return NextResponse.json({
      ok: true,
      captureId: capture.captureId,
      redirectUrl: `/checkout/paypal/success?bookId=${encodeURIComponent(
        localOrder.book_id
      )}`,
    });
  } catch (error) {
    console.error("capture-order:", error);

    if (error instanceof PayPalApiError) {
      return fail(
        "PayPal rechazó la captura.",
        502,
        error.details
      );
    }

    return fail(
      publicErrorMessage(error, "No se pudo confirmar el pago."),
      errorStatus(error)
    );
  }
}
