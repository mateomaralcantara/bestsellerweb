import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBookCheckoutItem } from "@/lib/paypal/book-checkout";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const slug =
      request.nextUrl.searchParams.get("slug")?.trim() || "";

    if (!slug || slug.length > 160 || !/^[a-z0-9-]+$/i.test(slug)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta el slug del libro.",
        },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "paypal:book-lookup",
      identity: slug,
      limit: 120,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas consultas." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("PayPal book-by-slug:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo consultar el libro.",
        },
        { status: 500 }
      );
    }

    if (!data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Libro no encontrado.",
        },
        { status: 404 }
      );
    }

    let checkoutItem: Awaited<ReturnType<typeof getBookCheckoutItem>>;

    try {
      checkoutItem = await getBookCheckoutItem(String(data.id));
    } catch (error) {
      console.error("PayPal pricing lookup:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "El precio PayPal no está listo.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        bookId: checkoutItem.id,
        amount: checkoutItem.amount,
        currency: checkoutItem.currency,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("PayPal book-by-slug:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error consultando el libro.",
      },
      { status: 500 }
    );
  }
}
