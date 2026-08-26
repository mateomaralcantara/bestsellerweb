"use client";

export async function postAdminAction(
  action: string,
  payload: Record<string, unknown>
) {
  const response = await fetch("/api/admin/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; [key: string]: unknown }
    | null;

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "No se pudo completar la operación.");
  }

  return body;
}
