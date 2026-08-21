"use client";

import Script from "next/script";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-11 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      language: string;
      size: "flexible";
      theme: "auto";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function AuthForm({
  nextPath = "/dashboard",
  nonce,
}: {
  nextPath?: string;
  nonce?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    if (
      !turnstileSiteKey ||
      !turnstileReady ||
      !turnstileContainerRef.current ||
      !window.turnstile
    ) {
      return;
    }

    const widgetId = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      action: mode === "login" ? "login" : "register",
      language: "es",
      size: "flexible",
      theme: "auto",
      callback: (token) => setCaptchaToken(token),
      "error-callback": () => setCaptchaToken(null),
      "expired-callback": () => setCaptchaToken(null),
    });

    turnstileWidgetRef.current = widgetId;

    return () => {
      if (window.turnstile && turnstileWidgetRef.current === widgetId) {
        window.turnstile.remove(widgetId);
        turnstileWidgetRef.current = null;
      }
    };
  }, [mode, turnstileReady, turnstileSiteKey]);

  function resetCaptcha() {
    setCaptchaToken(null);
    if (window.turnstile && turnstileWidgetRef.current) {
      window.turnstile.reset(turnstileWidgetRef.current);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Conecta Supabase para activar la autenticación.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("full_name") || "").trim();

    if (password.length < 10 || password.length > 128) {
      setMessage("La contraseña debe tener entre 10 y 128 caracteres.");
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setMessage("Completa la verificación de seguridad antes de continuar.");
      return;
    }

    setLoading(true);

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.slice(0, 120) },
          captchaToken: captchaToken || undefined,
          emailRedirectTo:
            `${window.location.origin}/auth/callback?next=` +
            encodeURIComponent(nextPath),
        },
      });

      setLoading(false);
      resetCaptcha();
      setMessage(
        error
          ? "No se pudo completar el registro. Revisa los datos e inténtalo nuevamente."
          : "Si el correo es válido, recibirás las instrucciones para confirmar tu cuenta."
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: captchaToken || undefined,
      },
    });

    setLoading(false);
    resetCaptcha();
    if (error) {
      setMessage("Correo o contraseña incorrectos.");
      return;
    }

    window.location.assign(nextPath);
  }

  return (
    <div>
      {turnstileSiteKey ? (
        <Script
          id="cloudflare-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          nonce={nonce}
          onReady={() => setTurnstileReady(true)}
        />
      ) : null}

      <div className="mb-7 flex gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5">
        <button
          type="button"
          onClick={() => {
            if (mode !== "login") {
              setCaptchaToken(null);
              setMode("login");
            }
          }}
          className={
            mode === "login"
              ? "flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#07111f] shadow-sm"
              : "flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800"
          }
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => {
            if (mode !== "register") {
              setCaptchaToken(null);
              setMode("register");
            }
          }}
          className={
            mode === "register"
              ? "flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#07111f] shadow-sm"
              : "flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800"
          }
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === "register" ? (
          <label className="block space-y-2 text-sm font-bold text-slate-700">
            <span>Nombre completo</span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="full_name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Tu nombre"
                className={inputClassName}
              />
            </span>
          </label>
        ) : null}

        <label className="block space-y-2 text-sm font-bold text-slate-700">
          <span>Correo electrónico</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="nombre@correo.com"
              className={inputClassName}
            />
          </span>
        </label>

        <label className="block space-y-2 text-sm font-bold text-slate-700">
          <span>Contraseña</span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={10}
              maxLength={128}
              placeholder="Tu contraseña"
              className={inputClassName}
            />
          </span>
        </label>

        {turnstileSiteKey ? (
          <div
            ref={turnstileContainerRef}
            className="min-h-[65px] w-full overflow-hidden rounded-xl"
            aria-label="Verificación de seguridad"
          />
        ) : null}

        <button
          disabled={loading || Boolean(turnstileSiteKey && !captchaToken)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-5 py-3.5 font-black text-white shadow-[0_14px_30px_rgba(21,94,239,0.25)] transition hover:-translate-y-0.5 hover:bg-[#2b78ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Procesando..."
            : mode === "login"
              ? "Entrar a mi cuenta"
              : "Crear mi cuenta"}
          {!loading ? <ArrowRight className="h-4 w-4" /> : null}
        </button>

        {message ? (
          <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
