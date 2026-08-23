import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  PayPalApiError,
  verifyPayPalWebhookSignature,
} from "@/lib/paypal/client";
import { getPayPalWebhookId } from "@/lib/paypal/config";
import { grantBookPurchase } from "@/lib/paypal/purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Event = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: {
      related_ids?: { order_id?: string };
    };
  };
};

class WebhookRequestError extends Error {}

function header(request: Request, name: string) {
  const value = request.headers.get(name);
  if (!value) throw new WebhookRequestError(`Falta el encabezado ${name}.`);
  return value;
}

function amountMatches(expected: number, received?: string) {
  const value = Number(received);
  return Number.isFinite(value) && Math.abs(expected - value) < 0.001;
}

async function completePurchase(event: Event) {
  const orderId =
    event.resource?.supplementary_data?.related_ids?.order_id;
  const captureId = event.resource?.id;

  if (!orderId || !captureId) {
    throw new Error("Webhook sin order_id o capture_id.");
  }

  const { data, error } = await supabaseAdmin
    .from("paypal_orders")
    .select("id, user_id, book_id, paypal_order_id, amount, currency")
    .eq("paypal_order_id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  if (
    !amountMatches(Number(data.amount), event.resource?.amount?.value) ||
    data.currency !== event.resource?.amount?.currency_code
  ) {
    await supabaseAdmin
      .from("paypal_orders")
      .update({
        status: "amount_mismatch",
        failure_reason: "Importe del webhook diferente.",
        webhook_event_id: event.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    throw new Error("El importe del webhook no coincide.");
  }

  await supabaseAdmin
    .from("paypal_orders")
    .update({
      paypal_capture_id: captureId,
      status: "completed",
      webhook_event_id: event.id || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  await grantBookPurchase({
    userId: data.user_id,
    bookId: data.book_id,
    amount: Number(data.amount).toFixed(2),
    currency: data.currency,
    paypalOrderId: data.paypal_order_id,
    paypalCaptureId: captureId,
  });
}

export async function POST(request: Request) {
  try {
    let event: Event;

    try {
      event = JSON.parse(await request.text()) as Event;
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON de webhook invÃ¡lido." },
        { status: 400 }
      );
    }

    const verification = await verifyPayPalWebhookSignature({
      transmissionId: header(request, "paypal-transmission-id"),
      transmissionTime: header(request, "paypal-transmission-time"),
      certUrl: header(request, "paypal-cert-url"),
      authAlgo: header(request, "paypal-auth-algo"),
      transmissionSignature: header(
        request,
        "paypal-transmission-sig"
      ),
      webhookId: getPayPalWebhookId(),
      webhookEvent: event,
    });

    if (verification.verification_status !== "SUCCESS") {
      return NextResponse.json(
        { ok: false, error: "Firma del webhook inválida." },
        { status: 400 }
      );
    }

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      await completePurchase(event);
    }

    return NextResponse.json({
      ok: true,
      received: true,
      eventType: event.event_type || null,
    });
  } catch (error) {
    console.error("paypal-webhook:", error);

    if (error instanceof WebhookRequestError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo verificar el webhook.",
          details:
            process.env.NODE_ENV === "development"
              ? error.details
              : undefined,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error procesando webhook.",
      },
      { status: 500 }
    );
  }
}
