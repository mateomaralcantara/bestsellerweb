import {
  getPayPalBaseUrl,
  getPayPalClientId,
  getPayPalClientSecret,
} from "@/lib/paypal/config";
import { createHash } from "node:crypto";

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
const PAYPAL_TIMEOUT_MS = 15_000;

function idempotencyKey(operation: string, localOrderId: string) {
  return createHash("sha256")
    .update(`${operation}:${localOrderId}`)
    .digest("hex")
    .slice(0, 32);
}

export class PayPalApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(
    `${getPayPalClientId()}:${getPayPalClientSecret()}`
  ).toString("base64");

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
    }
  );

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new PayPalApiError(
      "No se pudo autenticar con PayPal.",
      response.status,
      payload
    );
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 300;

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + expiresIn * 1000,
  };

  return cachedToken.value;
}

async function requestPayPal<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    requestId?: string;
    preferRepresentation?: boolean;
  } = {}
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (options.requestId) {
    headers["PayPal-Request-Id"] = options.requestId;
  }

  if (options.preferRepresentation) {
    headers.Prefer = "return=representation";
  }

  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers,
    body:
      typeof options.body === "undefined"
        ? undefined
        : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new PayPalApiError(
      `PayPal respondió con estado ${response.status}.`,
      response.status,
      payload
    );
  }

  return payload as T;
}

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    invoice_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
  payer?: { email_address?: string };
};

export function createPayPalOrder(input: {
  localOrderId: string;
  bookTitle: string;
  amount: string;
  currency: string;
}) {
  return requestPayPal<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: idempotencyKey("create", input.localOrderId),
    preferRepresentation: true,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.localOrderId,
          custom_id: input.localOrderId,
          invoice_id: input.localOrderId,
          description: input.bookTitle.slice(0, 127),
          amount: {
            currency_code: input.currency,
            value: input.amount,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
    },
  });
}

export function capturePayPalOrder(
  paypalOrderId: string,
  localOrderId: string
) {
  return requestPayPal<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      requestId: idempotencyKey("capture", localOrderId),
      preferRepresentation: true,
      body: {},
    }
  );
}

export function getPayPalOrder(paypalOrderId: string) {
  return requestPayPal<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`
  );
}

export function verifyPayPalWebhookSignature(input: {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSignature: string;
  webhookId: string;
  webhookEvent: unknown;
}) {
  return requestPayPal<{ verification_status?: "SUCCESS" | "FAILURE" }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        transmission_id: input.transmissionId,
        transmission_time: input.transmissionTime,
        cert_url: input.certUrl,
        auth_algo: input.authAlgo,
        transmission_sig: input.transmissionSignature,
        webhook_id: input.webhookId,
        webhook_event: input.webhookEvent,
      },
    }
  );
}
