"use client";

export type BookInterestEventType =
  | "book_view"
  | "preview_open"
  | "add_to_cart"
  | "checkout_start";

const SESSION_KEY = "bestseller:interest-session";

function getAnonymousSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)?.trim();

    if (existing && existing.length >= 16) {
      return existing;
    }

    const generated =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;

    window.localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function trackBookInterest(
  bookId: string,
  eventType: BookInterestEventType
) {
  if (!bookId || typeof window === "undefined") return;

  void fetch("/api/analytics/book-interest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookId,
      eventType,
      anonymousSessionId: getAnonymousSessionId(),
    }),
    keepalive: true,
  }).catch(() => {
    // La analítica nunca debe interrumpir la experiencia de compra o lectura.
  });
}
