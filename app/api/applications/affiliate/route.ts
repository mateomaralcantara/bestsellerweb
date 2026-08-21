import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  errorStatus,
  publicErrorMessage,
  readJsonBody,
  requireTrustedMutation,
} from "@/lib/security/http";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_APPLICATION_BYTES = 6_144;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AffiliateApplicationBody = {
  fullName?: unknown;
  email?: unknown;
  channels?: unknown;
  audience?: unknown;
};

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isSchemaCompatibilityError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* does not exist|could not find .* column/i.test(error.message || "")
  );
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id || !user.email) {
      return NextResponse.json(
        { error: "Inicia sesión antes de enviar la solicitud." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "affiliate-application",
      identity: user.id,
      limit: 2,
      windowSeconds: 86_400,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Ya recibimos tus solicitudes recientes. Inténtalo mañana." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await readJsonBody<AffiliateApplicationBody>(
      request,
      MAX_APPLICATION_BYTES
    );
    const fullName = text(body.fullName, 120);
    const email = text(body.email, 254).toLowerCase();
    const channels = text(body.channels, 600);
    const audience = text(body.audience, 2_000);
    const accountEmail = user.email.trim().toLowerCase();

    if (fullName.length < 2 || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Revisa el nombre y el correo electrónico." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (email !== accountEmail) {
      return NextResponse.json(
        { error: "Usa el mismo correo de tu cuenta para enviar la solicitud." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (channels.length < 3 || audience.length < 10) {
      return NextResponse.json(
        { error: "Describe tus canales y tu audiencia con un poco más de detalle." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const modernPayload = {
      user_id: user.id,
      display_name: fullName,
      email: accountEmail,
      channels: { description: channels },
      audience_description: audience,
      status: "pending",
    };

    const { error: modernError } = await supabaseAdmin
      .from("affiliate_applications")
      .insert(modernPayload);

    if (modernError) {
      if (!isSchemaCompatibilityError(modernError)) {
        console.error("No se pudo registrar la solicitud de afiliado:", modernError.message);
        return NextResponse.json(
          { error: "No se pudo enviar la solicitud." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }

      const { error: legacyError } = await supabaseAdmin
        .from("affiliate_applications")
        .insert({
          full_name: fullName,
          email: accountEmail,
          channels,
          audience,
          status: "new",
        });

      if (legacyError) {
        console.error("No se pudo registrar la solicitud compatible:", legacyError.message);
        return NextResponse.json(
          { error: "No se pudo enviar la solicitud." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "No se pudo enviar la solicitud.") },
      {
        status: errorStatus(error),
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
