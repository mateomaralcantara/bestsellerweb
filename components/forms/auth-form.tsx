"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pl-11 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

export function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Conecta Supabase para activar la autenticación.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("full_name") || "");

    setLoading(true);

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      setLoading(false);
      setMessage(
        error
          ? error.message
          : "Cuenta creada. Revisa tu correo si la confirmación está activada."
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    setMessage(
      error
        ? error.message
        : "Sesión iniciada. Ya puedes entrar a tu biblioteca."
    );
  }

  return (
    <div>
      <div className="mb-7 flex gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5">
        <button
          type="button"
          onClick={() => setMode("login")}
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
          onClick={() => setMode("register")}
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
              placeholder="Tu contraseña"
              className={inputClassName}
            />
          </span>
        </label>

        <button
          disabled={loading}
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
