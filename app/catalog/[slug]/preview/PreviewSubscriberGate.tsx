"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Mail, MessageCircle, Sparkles } from "lucide-react";

type ReaderKind = "epub" | "pages";

type Props = {
  bookSlug: string;
  bookTitle: string;
  progressKey: string;
  readerKind: ReaderKind;
};

type ApiResponse = {
  ok?: boolean;
  recognized?: boolean;
  subscriberToken?: string;
  error?: string;
};

const SUBSCRIBER_TOKEN_KEY = "libroseller:preview-subscriber-token:v1";
const GATE_PAGE = 6;
const EPUB_GATE_PERCENT = 20;
const POLL_MS = 450;

function readToken() {
  try {
    return window.localStorage.getItem(SUBSCRIBER_TOKEN_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

function saveToken(token: string) {
  try {
    window.localStorage.setItem(SUBSCRIBER_TOKEN_KEY, token);
  } catch {
    // La sesión actual continúa desbloqueada aunque el navegador bloquee storage.
  }
}

function clearToken() {
  try {
    window.localStorage.removeItem(SUBSCRIBER_TOKEN_KEY);
  } catch {
    // Sin impacto en el preview actual.
  }
}

function pageReaderHasCrossedGate(progressKey: string) {
  try {
    const raw = window.localStorage.getItem(
      `bestseller-reader-progress:${progressKey}`
    );
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { currentPage?: unknown };
    const currentPage = Number(parsed.currentPage);
    return Number.isFinite(currentPage) && currentPage >= GATE_PAGE;
  } catch {
    return false;
  }
}

function epubReaderHasCrossedGate(progressKey: string) {
  try {
    const raw = window.localStorage.getItem(`libroseller:epub:${progressKey}`);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { percent?: unknown };
    const percent = Number(parsed.percent);
    return Number.isFinite(percent) && percent >= EPUB_GATE_PERCENT;
  } catch {
    return false;
  }
}

async function postSubscription(payload: Record<string, unknown>) {
  const response = await fetch("/api/preview-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ApiResponse;
  return { response, data };
}

export default function PreviewSubscriberGate({
  bookSlug,
  bookTitle,
  progressKey,
  readerKind,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationDone, setVerificationDone] = useState(false);
  const [knownSubscriber, setKnownSubscriber] = useState(false);
  const handledThresholdRef = useRef(false);
  const knownTokenRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function verifyExistingSubscriber() {
      const token = readToken();
      knownTokenRef.current = token;

      if (!token) {
        if (!cancelled) setVerificationDone(true);
        return;
      }

      try {
        const { response, data } = await postSubscription({
          action: "verify",
          bookSlug,
          subscriberToken: token,
        });

        if (cancelled) return;

        if (response.ok && data.ok && data.recognized) {
          setKnownSubscriber(true);
        } else {
          clearToken();
          knownTokenRef.current = "";
          setKnownSubscriber(false);
        }
      } catch {
        // Si hay una interrupción temporal de red no castigamos a un suscriptor conocido.
        if (!cancelled) setKnownSubscriber(Boolean(token));
      } finally {
        if (!cancelled) setVerificationDone(true);
      }
    }

    void verifyExistingSubscriber();
    return () => {
      cancelled = true;
    };
  }, [bookSlug]);

  useEffect(() => {
    if (!verificationDone) return;

    let cancelled = false;

    const inspect = async () => {
      if (handledThresholdRef.current || cancelled) return;

      const crossed =
        readerKind === "pages"
          ? pageReaderHasCrossedGate(progressKey)
          : epubReaderHasCrossedGate(progressKey);

      if (!crossed) return;
      handledThresholdRef.current = true;

      if (knownSubscriber && knownTokenRef.current) {
        try {
          const { response, data } = await postSubscription({
            action: "track",
            bookSlug,
            subscriberToken: knownTokenRef.current,
          });

          if (response.ok && data.ok) return;
        } catch {
          // Si la identificación guardada falla, se solicita el correo de nuevo.
        }

        clearToken();
        knownTokenRef.current = "";
        setKnownSubscriber(false);
      }

      if (!cancelled) setOpen(true);
    };

    void inspect();
    const timer = window.setInterval(() => void inspect(), POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [bookSlug, knownSubscriber, progressKey, readerKind, verificationDone]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage("");

    try {
      const { response, data } = await postSubscription({
        action: "subscribe",
        bookSlug,
        email,
        whatsapp,
      });

      if (!response.ok || !data.ok || !data.subscriberToken) {
        setMessage(data.error || "No pudimos guardar tus datos. Inténtalo de nuevo.");
        return;
      }

      saveToken(data.subscriberToken);
      knownTokenRef.current = data.subscriberToken;
      setKnownSubscriber(true);
      setOpen(false);
    } catch {
      setMessage("No pudimos conectar con LibroSeller. Verifica tu conexión e inténtalo otra vez.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#03101c]/82 px-4 py-6 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-subscription-title"
        className="w-full max-w-xl overflow-hidden rounded-[32px] border border-white/15 bg-white shadow-[0_35px_120px_rgba(0,0,0,0.45)]"
      >
        <div className="bg-[linear-gradient(135deg,#06192b_0%,#0b3d91_58%,#155eef_100%)] px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <BookOpen className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                Continúa leyendo gratis
              </p>
              <p className="mt-1 text-sm text-white/75">Ya leíste tus primeras 5 páginas.</p>
            </div>
          </div>

          <h2
            id="preview-subscription-title"
            className="mt-6 text-2xl font-black leading-tight sm:text-3xl"
          >
            Recibe libros que realmente coincidan contigo
          </h2>
          <p className="mt-3 text-sm leading-6 text-blue-50/90 sm:text-base">
            Déjanos tu correo y podrás seguir leyendo <strong>{bookTitle}</strong>. Además,
            te avisaremos cuando publiquemos nuevos libros de esta área y de temas que vayas demostrando que te interesan.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-7 sm:px-8">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
              <Mail className="h-4 w-4 text-[#155eef]" />
              Correo electrónico
              <span className="text-red-500">*</span>
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-950 outline-none transition focus:border-[#155eef] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              WhatsApp
              <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              placeholder="+1 809 000 0000"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-950 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Si lo agregas, podremos enviarte alertas editoriales también por WhatsApp. No es obligatorio.
            </p>
          </label>

          {message ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#155eef] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0f4fd1] disabled:cursor-wait disabled:opacity-65"
          >
            <Sparkles className="h-5 w-5" />
            {submitting ? "Guardando…" : "Continuar leyendo"}
          </button>

          <p className="text-center text-[11px] leading-5 text-slate-400">
            Al continuar aceptas recibir novedades editoriales personalizadas de LibroSeller por correo y,
            solo si proporcionas tu número, por WhatsApp. Podrás darte de baja de futuras comunicaciones.
          </p>
        </form>
      </div>
    </div>
  );
}
