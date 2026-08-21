"use client";

import { useEffect, useId, useRef, useState } from "react";

type ButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
};

type PayPalNamespace = {
  Buttons: (options: {
    style?: {
      layout?: "vertical" | "horizontal";
      shape?: "rect" | "pill";
      label?: "paypal" | "checkout" | "buynow" | "pay";
      height?: number;
    };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }) => ButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

type Props = {
  bookId: string;
  clientId: string;
  currency: string;
};

type ApiPayload = {
  orderId?: string;
  captureId?: string;
  redirectUrl?: string;
  alreadyPurchased?: boolean;
  error?: string;
};

export function PayPalCheckoutButton({
  bookId,
  clientId,
  currency,
}: Props) {
  const reactId = useId();
  const containerId = `paypal-${reactId.replace(/:/g, "")}`;
  const instanceRef = useRef<ButtonsInstance | null>(null);

  const [state, setState] = useState<
    "loading" | "ready" | "processing" | "error"
  >("loading");
  const [message, setMessage] = useState(
    "Cargando métodos de pago seguros..."
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSdk() {
      const scriptId = "paypal-javascript-sdk";
      let script = document.getElementById(
        scriptId
      ) as HTMLScriptElement | null;

      if (script && script.dataset.currency !== currency) {
        script.remove();
        window.paypal = undefined;
        script = null;
      }

      if (!script) {
        const nonce =
          document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ||
          "";

        script = document.createElement("script");
        script.id = scriptId;
        script.async = true;
        script.dataset.currency = currency;
        if (nonce) {
          script.nonce = nonce;
          script.dataset.cspNonce = nonce;
        }
        script.src =
          "https://www.paypal.com/sdk/js" +
          `?client-id=${encodeURIComponent(clientId)}` +
          `&currency=${encodeURIComponent(currency)}` +
          "&intent=capture&components=buttons";

        document.head.appendChild(script);
      }

      if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          script?.addEventListener("load", () => resolve(), {
            once: true,
          });
          script?.addEventListener(
            "error",
            () => reject(new Error("No se pudo cargar PayPal.")),
            { once: true }
          );
        });
      }
    }

    async function renderButtons() {
      try {
        await loadSdk();

        if (cancelled) return;

        const container = document.getElementById(containerId);
        if (!container || !window.paypal) {
          throw new Error("El botón PayPal no está disponible.");
        }

        instanceRef.current = window.paypal.Buttons({
          style: {
            layout: "vertical",
            shape: "rect",
            label: "paypal",
            height: 48,
          },

          createOrder: async () => {
            setState("processing");
            setMessage("Creando orden segura...");

            const response = await fetch(
              "/api/payments/paypal/create-order",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-BestSeller-Request": "1",
                },
                credentials: "same-origin",
                body: JSON.stringify({ bookId }),
              }
            );

            const payload = (await response.json()) as ApiPayload;

            if (payload.alreadyPurchased) {
              window.location.assign(
                `/checkout/paypal/success?bookId=${encodeURIComponent(
                  bookId
                )}`
              );
              throw new Error("Ya tienes acceso a este libro.");
            }

            if (!response.ok || !payload.orderId) {
              throw new Error(
                payload.error || "No se pudo crear la orden PayPal."
              );
            }

            setState("ready");
            setMessage("Selecciona tu método de pago.");
            return payload.orderId;
          },

          onApprove: async ({ orderID }) => {
            setState("processing");
            setMessage("Confirmando tu pago...");

            const response = await fetch(
              "/api/payments/paypal/capture-order",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-BestSeller-Request": "1",
                },
                credentials: "same-origin",
                body: JSON.stringify({ orderId: orderID }),
              }
            );

            const payload = (await response.json()) as ApiPayload;

            if (!response.ok || !payload.captureId) {
              throw new Error(
                payload.error || "No se pudo confirmar el pago."
              );
            }

            window.location.assign(
              payload.redirectUrl ||
                `/checkout/paypal/success?bookId=${encodeURIComponent(
                  bookId
                )}`
            );
          },

          onCancel: () => {
            setState("ready");
            setMessage(
              "El pago fue cancelado. Puedes intentarlo nuevamente."
            );
          },

          onError: (error) => {
            console.error("PayPal Buttons:", error);
            setState("error");
            setMessage(
              error instanceof Error
                ? error.message
                : "Ocurrió un error con PayPal."
            );
          },
        });

        await instanceRef.current.render(container);

        if (!cancelled) {
          setState("ready");
          setMessage("Selecciona tu método de pago.");
        }
      } catch (error) {
        console.error("PayPal SDK:", error);
        if (!cancelled) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo iniciar PayPal."
          );
        }
      }
    }

    void renderButtons();

    return () => {
      cancelled = true;
      if (instanceRef.current?.close) {
        void instanceRef.current.close().catch(() => undefined);
      }
      instanceRef.current = null;
    };
  }, [bookId, clientId, containerId, currency]);

  return (
    <div className="space-y-4">
      <div
        id={containerId}
        className={
          state === "processing"
            ? "pointer-events-none opacity-60"
            : ""
        }
      />

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          state === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : state === "processing"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        {message}
      </div>

      <p className="text-center text-xs leading-5 text-slate-500">
        El precio se valida en el servidor. BestSeller no almacena
        los datos de tu tarjeta.
      </p>
    </div>
  );
}
