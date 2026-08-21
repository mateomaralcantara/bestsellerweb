import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  PayPalApiError,
  verifyPayPalWebhookSignature,
} from "@/lib/paypal/client";
import { getPayPalWebhookId } from "@/lib/paypal/config";
import { grantBookPurchase } from "@/lib/paypal/purchases";
import {
  errorStatus,
  HttpRequestError,
  publicErrorMessage,
  readTextBody,
} from "@/lib/security/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 262_144;
const MAX_TRANSMISSION_AGE_MS = 15 * 60 * 1_000;

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

type WebhookClaim = {
  shouldProcess: boolean;
  ledgerAvailable: boolean;
};

function requiredHeader(request: Request, name: string, maxLength: number) {
  const value = request.headers.get(name)?.trim() || "";

  if (!value || value.length > maxLength || /[\r\n]/.test(value)) {
    throw new HttpRequestError(`Encabezado ${name} inválido.`, 400);
  }

  return value;
}

function validateTransmissionTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new HttpRequestError("Fecha de transmisión inválida.", 400);
  }

  if (Math.abs(Date.now() - timestamp) > MAX_TRANSMISSION_AGE_MS) {
    throw new HttpRequestError("Webhook fuera de la ventana permitida.", 400);
  }
}

function validateCertificateUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new HttpRequestError("Certificado de PayPal inválido.", 400);
  }

  const trustedHost =
    url.hostname === "paypal.com" ||
    url.hostname.endsWith(".paypal.com") ||
    url.hostname === "paypalobjects.com" ||
    url.hostname.endsWith(".paypalobjects.com");

  if (url.protocol !== "https:" || !trustedHost || url.username || url.password) {
    throw new HttpRequestError("Certificado de PayPal no permitido.", 400);
  }
}

function validateEvent(event: Event) {
  const eventId = event.id?.trim() || "";
  const eventType = event.event_type?.trim() || "";

  if (!/^[A-Z0-9-]{8,80}$/i.test(eventId)) {
    throw new HttpRequestError("El webhook no tiene un event_id válido.", 400);
  }

  if (!/^[A-Z0-9._-]{3,120}$/i.test(eventType)) {
    throw new HttpRequestError("El webhook no tiene un event_type válido.", 400);
  }

  return { eventId, eventType };
}

function amountMatches(expected: number, received?: string) {
  const value = Number(received);
  return Number.isFinite(value) && Math.abs(expected - value) < 0.001;
}

async function claimWebhookEvent(
  event: Event,
  eventId: string,
  eventType: string
): Promise<WebhookClaim> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_paypal_webhook_event",
    {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: event,
      p_resource_id: event.resource?.id || null,
    }
  );

  if (!error) {
    return { shouldProcess: data === true, ledgerAvailable: true };
  }

  const missingFunction =
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message.includes("claim_paypal_webhook_event");

  if (!missingFunction) {
    throw new Error(`No se pudo registrar el webhook: ${error.message}`);
  }

  console.warn(
    "Falta aplicar 20260820_total_security_hardening.sql; el ledger de webhooks está en compatibilidad temporal."
  );

  const { data: duplicate } = await supabaseAdmin
    .from("paypal_orders")
    .select("id")
    .eq("webhook_event_id", eventId)
    .limit(1)
    .maybeSingle();

  return { shouldProcess: !duplicate, ledgerAvailable: false };
}

async function finishWebhookEvent(
  eventId: string,
  status: "completed" | "failed" | "ignored",
  errorMessage: string | null,
  ledgerAvailable: boolean
) {
  if (!ledgerAvailable) return;

  const { error } = await supabaseAdmin
    .from("paypal_webhook_events")
    .update({
      status,
      last_error: errorMessage?.slice(0, 1_000) || null,
      processed_at: status === "failed" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  if (error) throw new Error(`No se pudo cerrar el webhook: ${error.message}`);
}

async function completePurchase(event: Event, eventId: string) {
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
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
  if (!data) return "ignored" as const;

  if (
    !amountMatches(Number(data.amount), event.resource?.amount?.value) ||
    data.currency !== event.resource?.amount?.currency_code
  ) {
    await supabaseAdmin
      .from("paypal_orders")
      .update({
        status: "amount_mismatch",
        failure_reason: "Importe del webhook diferente.",
        webhook_event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    throw new Error("El importe del webhook no coincide.");
  }

  const { error: updateError } = await supabaseAdmin
    .from("paypal_orders")
    .update({
      paypal_capture_id: captureId,
      status: "completed",
      webhook_event_id: eventId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  if (updateError) {
    throw new Error(`No se pudo actualizar la orden: ${updateError.message}`);
  }

  await grantBookPurchase({
    userId: data.user_id,
    bookId: data.book_id,
    amount: Number(data.amount).toFixed(2),
    currency: data.currency,
    paypalOrderId: data.paypal_order_id,
    paypalCaptureId: captureId,
  });

  return "completed" as const;
}

export async function POST(request: Request) {
  let eventId = "";
  let ledgerAvailable = false;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw new HttpRequestError("Content-Type del webhook inválido.", 415);
    }

    const transmissionId = requiredHeader(
      request,
      "paypal-transmission-id",
      100
    );
    const transmissionTime = requiredHeader(
      request,
      "paypal-transmission-time",
      64
    );
    const certUrl = requiredHeader(request, "paypal-cert-url", 2_048);
    const authAlgo = requiredHeader(request, "paypal-auth-algo", 64);
    const transmissionSignature = requiredHeader(
      request,
      "paypal-transmission-sig",
      2_048
    );

    validateTransmissionTime(transmissionTime);
    validateCertificateUrl(certUrl);

    if (authAlgo.toUpperCase() !== "SHA256WITHRSA") {
      throw new HttpRequestError("Algoritmo de firma no permitido.", 400);
    }

    const rawBody = await readTextBody(request, MAX_WEBHOOK_BYTES);
    let event: Event;

    try {
      event = JSON.parse(rawBody) as Event;
    } catch {
      throw new HttpRequestError("JSON del webhook inválido.", 400);
    }

    const validated = validateEvent(event);
    eventId = validated.eventId;

    const verification = await verifyPayPalWebhookSignature({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSignature,
      webhookId: getPayPalWebhookId(),
      webhookEvent: event,
    });

    if (verification.verification_status !== "SUCCESS") {
      return NextResponse.json(
        { ok: false, error: "Firma del webhook inválida." },
        { status: 400 }
      );
    }

    const claim = await claimWebhookEvent(
      event,
      validated.eventId,
      validated.eventType
    );
    ledgerAvailable = claim.ledgerAvailable;

    if (!claim.shouldProcess) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    if (validated.eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const status = await completePurchase(event, validated.eventId);
      await finishWebhookEvent(
        validated.eventId,
        status,
        null,
        ledgerAvailable
      );
    } else {
      await finishWebhookEvent(
        validated.eventId,
        "ignored",
        null,
        ledgerAvailable
      );
    }

    return NextResponse.json({
      ok: true,
      received: true,
      eventType: validated.eventType,
    });
  } catch (error) {
    console.error("paypal-webhook:", error);

    if (eventId && ledgerAvailable) {
      await finishWebhookEvent(
        eventId,
        "failed",
        error instanceof Error ? error.message : "Error desconocido",
        true
      ).catch((ledgerError) => {
        console.error("No se pudo marcar el webhook como fallido:", ledgerError);
      });
    }

    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        { ok: false, error: "No se pudo verificar el webhook." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error, "Error procesando webhook.") },
      { status: errorStatus(error) }
    );
  }
}
