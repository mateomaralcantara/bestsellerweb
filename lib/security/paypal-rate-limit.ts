import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PayPalRateLimitRoute =
  | "paypal:create-order"
  | "paypal:capture-order";

type ConsumeRateLimitParams = {
  route: PayPalRateLimitRoute;
  userId: string;
  limit: number;
  windowSeconds: number;
};

export type PayPalRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

type RpcRateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after: number;
};

function getRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "RATE_LIMIT_SECRET debe existir y tener al menos 32 caracteres."
    );
  }

  return secret;
}

export function hashPayPalRateLimitActor(userId: string) {
  const cleanUserId = userId.trim();

  if (!cleanUserId) {
    throw new Error("No se puede limitar una solicitud sin userId.");
  }

  return createHmac("sha256", getRateLimitSecret())
    .update(`paypal-user:${cleanUserId}`)
    .digest("hex");
}

function normalizeRpcRow(data: unknown): RpcRateLimitRow | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Record<string, unknown>;

  if (
    typeof candidate.allowed !== "boolean" ||
    typeof candidate.remaining !== "number" ||
    typeof candidate.retry_after !== "number"
  ) {
    return null;
  }

  return {
    allowed: candidate.allowed,
    remaining: candidate.remaining,
    retry_after: candidate.retry_after,
  };
}

export async function consumePayPalRateLimit({
  route,
  userId,
  limit,
  windowSeconds,
}: ConsumeRateLimitParams): Promise<PayPalRateLimitResult> {
  const actorHash = hashPayPalRateLimitActor(userId);

  const { data, error } = await supabaseAdmin.rpc(
    "consume_paypal_rate_limit",
    {
      p_route: route,
      p_actor_hash: actorHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }
  );

  if (error) {
    throw new Error(
      `No se pudo validar el límite de solicitudes: ${error.message}`
    );
  }

  const row = normalizeRpcRow(data);

  if (!row) {
    throw new Error("Supabase devolvió un resultado de rate limit inválido.");
  }

  return {
    allowed: row.allowed,
    remaining: Math.max(0, Math.trunc(row.remaining)),
    retryAfter: Math.max(1, Math.trunc(row.retry_after)),
  };
}

export function buildRateLimitHeaders(
  result: PayPalRateLimitResult,
  limit: number
): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfter),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}
