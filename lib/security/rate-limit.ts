import { createHmac, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  identity?: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RpcRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type LocalEntry = {
  count: number;
  resetAt: number;
};

const fallbackStore = new Map<string, LocalEntry>();
let lastFallbackWarningAt = 0;
let developmentSecret: string | null = null;

function getSecret() {
  const configured = process.env.RATE_LIMIT_SECRET?.trim() || "";

  if (configured.length >= 32) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RATE_LIMIT_SECRET debe tener al menos 32 caracteres en producción."
    );
  }

  developmentSecret ||= randomBytes(32).toString("base64url");
  return developmentSecret;
}

function getClientAddress(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return forwarded.split(",")[0]?.trim().slice(0, 128) || "unknown";
}

function hashIdentifier(request: Request, identity?: string | null) {
  const source = `${identity || "anonymous"}|${getClientAddress(request)}`;
  return createHmac("sha256", getSecret()).update(source).digest("hex");
}

function localFallback(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const current = fallbackStore.get(key);
  const entry =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowSeconds * 1000 };

  entry.count += 1;
  fallbackStore.set(key, entry);

  if (fallbackStore.size > 5_000) {
    for (const [candidateKey, candidate] of fallbackStore) {
      if (candidate.resetAt <= now) fallbackStore.delete(candidateKey);
    }

    while (fallbackStore.size > 4_500) {
      const oldestKey = fallbackStore.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) break;
      fallbackStore.delete(oldestKey);
    }
  }

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export async function consumeRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identifierHash = hashIdentifier(request, options.identity);
  const fallbackKey = `${options.bucket}:${identifierHash}`;

  try {
    const { data, error } = await supabaseAdmin.rpc(
      "consume_api_rate_limit",
      {
        p_bucket: options.bucket,
        p_identifier_hash: identifierHash,
        p_limit: options.limit,
        p_window_seconds: options.windowSeconds,
      }
    );

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as RpcRow | null;
    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("Supabase no devolvió el resultado del rate limit.");
    }

    return {
      allowed: row.allowed,
      remaining: Number(row.remaining) || 0,
      retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || 1),
    };
  } catch (error) {
    const now = Date.now();
    if (now - lastFallbackWarningAt > 60_000) {
      lastFallbackWarningAt = now;
      console.warn(
        "Rate limit distribuido no disponible; usando respaldo local temporal.",
        error instanceof Error ? error.message : "Error desconocido"
      );
    }

    return localFallback(
      fallbackKey,
      options.limit,
      options.windowSeconds
    );
  }
}
