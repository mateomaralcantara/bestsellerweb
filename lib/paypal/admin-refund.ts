import "server-only";

import {
  getPayPalBaseUrl,
  getPayPalClientId,
  getPayPalClientSecret,
} from "@/lib/paypal/config";

export type PayPalRefund = {
  id?: string;
  status?: string;
  amount?: {
    value?: string;
    currency_code?: string;
  };
};

async function getAdminPayPalAccessToken() {
  const credentials = Buffer.from(
    `${getPayPalClientId()}:${getPayPalClientSecret()}`
  ).toString("base64");

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { access_token?: unknown; error_description?: unknown }
    | null;

  if (
    !response.ok ||
    typeof payload?.access_token !== "string" ||
    !payload.access_token
  ) {
    throw new Error(
      typeof payload?.error_description === "string"
        ? payload.error_description
        : "No se pudo autenticar el reembolso con PayPal."
    );
  }

  return payload.access_token;
}

export async function refundPayPalCapture(input: {
  captureId: string;
  amount: number;
  currency: string;
  requestId: string;
}): Promise<PayPalRefund> {
  const token = await getAdminPayPalAccessToken();

  const response = await fetch(
    `${getPayPalBaseUrl()}/v2/payments/captures/${encodeURIComponent(
      input.captureId
    )}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "PayPal-Request-Id": input.requestId,
      },
      body: JSON.stringify({
        amount: {
          value: input.amount.toFixed(2),
          currency_code: input.currency,
        },
      }),
      cache: "no-store",
    }
  );

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
    throw new Error(
      `PayPal rechazó el reembolso (${response.status}).`
    );
  }

  return (payload ?? {}) as PayPalRefund;
}
