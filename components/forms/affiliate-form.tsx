"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

export function AffiliateForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/applications/affiliate", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-BestSeller-Request": "1",
        },
        body: JSON.stringify({
          fullName: String(formData.get("full_name") || ""),
          email: String(formData.get("email") || ""),
          channels: String(formData.get("channels") || ""),
          audience: String(formData.get("audience") || ""),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setStatus(payload?.error || "No se pudo enviar la solicitud.");
        return;
      }

      form.reset();
      setStatus("Solicitud enviada correctamente. Revisaremos tu información.");
    } catch {
      setStatus("No se pudo conectar con el servidor. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="commercial-card space-y-5 rounded-[34px] p-6 sm:p-8"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>Nombre completo</span>
          <input
            name="full_name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Tu nombre"
            className={inputClassName}
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>Correo electrónico</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="nombre@correo.com"
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm font-bold text-slate-700">
        <span>Canales donde promocionas contenido</span>
        <input
          name="channels"
          required
          minLength={3}
          maxLength={600}
          placeholder="Instagram, TikTok, newsletter, comunidad..."
          className={inputClassName}
        />
      </label>

      <label className="block space-y-2 text-sm font-bold text-slate-700">
        <span>Describe brevemente tu audiencia</span>
        <textarea
          name="audience"
          rows={5}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Temas de interés, tamaño aproximado y tipo de comunidad..."
          className={inputClassName}
        />
      </label>

      <button
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-5 py-3.5 font-black text-white shadow-[0_14px_30px_rgba(21,94,239,0.25)] transition hover:-translate-y-0.5 hover:bg-[#2b78ff] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Enviando..." : "Enviar solicitud"}
        {!loading ? <Send className="h-4 w-4" /> : null}
      </button>

      {status ? (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          {status}
        </p>
      ) : null}
    </form>
  );
}
