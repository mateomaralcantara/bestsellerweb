export type PayPalEnvironment = "sandbox" | "live";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

export function getPayPalEnvironment(): PayPalEnvironment {
  const value = process.env.PAYPAL_ENV?.trim().toLowerCase();

  if (value === "live" || value === "sandbox") {
    return value;
  }

  if (!value && process.env.NODE_ENV !== "production") {
    return "sandbox";
  }

  throw new Error("PAYPAL_ENV debe ser exactamente sandbox o live.");
}

export function getPayPalBaseUrl() {
  return getPayPalEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export const getPayPalClientId = () => required("PAYPAL_CLIENT_ID");
export const getPayPalClientSecret = () => required("PAYPAL_CLIENT_SECRET");
export const getPayPalWebhookId = () => required("PAYPAL_WEBHOOK_ID");

export function getDefaultPayPalCurrency() {
  const value =
    process.env.PAYPAL_DEFAULT_CURRENCY?.trim().toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error("PAYPAL_DEFAULT_CURRENCY debe tener 3 letras.");
  }
  return value;
}
