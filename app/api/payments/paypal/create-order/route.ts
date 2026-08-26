import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBookCheckoutItem } from "@/lib/paypal/book-checkout";
import { createPayPalOrder, PayPalApiError } from "@/lib/paypal/client";
import { userAlreadyOwnsBook } from "@/lib/paypal/purchases";
import { normalizeAffiliateCode, resolveAffiliateUserByCode } from "@/lib/finance/record-sale";
import { buildRateLimitHeaders, consumePayPalRateLimit } from "@/lib/security/paypal-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: process.env.NODE_ENV === "development" ? details : undefined,
    },
    { status }
  );
}

function getLocalOrderError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205"
  ) {
    return "Falta aplicar la migración de PayPal en Supabase.";
  }

  if (code === "23503") {
    return "El usuario o el libro no coincide con los registros de Supabase.";
  }

  return "No se pudo crear la orden local.";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Debes iniciar sesión para comprar.", 401);
    }
    const rateLimitMax = 10;
    const rateLimit = await consumePayPalRateLimit({
      route: "paypal:create-order",
      userId: user.id,
      limit: rateLimitMax,
      windowSeconds: 300,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Demasiadas solicitudes de pago. Inténtalo nuevamente en unos minutos.",
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit, rateLimitMax),
        }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { bookId?: unknown; affiliateCode?: unknown }
      | null;
    const bookId =
      typeof body?.bookId === "string" ? body.bookId.trim() : "";

    if (!bookId) return fail("Falta el bookId.", 400);



    const cookieStore = await cookies();
    const bodyAffiliateCode =
      typeof body?.affiliateCode === "string"
        ? normalizeAffiliateCode(body.affiliateCode)
        : "";
    const cookieAffiliateCode = normalizeAffiliateCode(
      cookieStore.get("libroseller_affiliate")?.value
    );
    const affiliateCode = bodyAffiliateCode || cookieAffiliateCode;
    const affiliateUserId = affiliateCode
      ? await resolveAffiliateUserByCode(affiliateCode, user.id)
      : null;
if (await userAlreadyOwnsBook({ userId: user.id, bookId })) {
      return NextResponse.json(
        {
          ok: false,
          alreadyPurchased: true,
          error: "Ya tienes acceso a este libro.",
        },
        { status: 409 }
      );
    }

    const book = await getBookCheckoutItem(bookId);

    const { data: localOrder, error: insertError } = await supabaseAdmin
      .from("paypal_orders")
      .insert({
        user_id: user.id,
        book_id: book.id,
        status: "creating",
        amount: Number(book.amount),
        currency: book.currency,
        affiliate_user_id: affiliateUserId,
        affiliate_code: affiliateUserId ? affiliateCode : null,
      })
      .select("id")
      .single();

    if (insertError || !localOrder) {
      return fail(getLocalOrderError(insertError), 500, insertError);
    }

    try {
      const paypalOrder = await createPayPalOrder({
        localOrderId: localOrder.id,
        bookTitle: book.title,
        amount: book.amount,
        currency: book.currency,
});

      if (!paypalOrder.id) {
        throw new Error("PayPal no devolvió el identificador de la orden.");
      }

      const { error: updateError } = await supabaseAdmin
        .from("paypal_orders")
        .update({
          paypal_order_id: paypalOrder.id,
          status: paypalOrder.status?.toLowerCase() || "created",
          raw_create: paypalOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      if (updateError) {
        return fail(
          "PayPal creó la orden, pero no se pudo guardar localmente.",
          500,
          updateError
        );
      }

      return NextResponse.json({
        ok: true,
        orderId: paypalOrder.id,
      });
    } catch (error) {
      await supabaseAdmin
        .from("paypal_orders")
        .update({
          status: "failed",
          failure_reason:
            error instanceof Error ? error.message : "Error desconocido",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localOrder.id);

      throw error;
    }
  } catch (error) {
    console.error("create-order:", error);

    if (error instanceof PayPalApiError) {
      return fail(
        "PayPal rechazó la creación de la orden.",
        502,
        error.details
      );
    }

    return fail(
      error instanceof Error ? error.message : "Error creando la orden.",
      500
    );
  }
}
