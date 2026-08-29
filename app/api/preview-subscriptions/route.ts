import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTIONS_TABLE = "preview_reader_subscriptions";
const INTERESTS_TABLE = "preview_reader_subscription_interests";
const FALLBACK_EVENT_CREATED = "preview_subscription_created";
const FALLBACK_EVENT_INTEREST = "preview_subscription_interest";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BookPreference = {
  id: string;
  title: string | null;
  slug: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
};

type SubscriptionRow = {
  id: string;
  subscriber_token: string;
  email: string;
  email_normalized: string;
  whatsapp: string | null;
  whatsapp_opt_in: boolean;
  status: string;
  preferences: string[] | null;
};

function text(value: unknown, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function emailNormalized(value: unknown) {
  return text(value, 320).toLocaleLowerCase("en-US");
}

function normalizeWhatsApp(value: unknown) {
  const raw = text(value, 40);
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `${hasPlus ? "+" : ""}${digits}`;
}

function normalizePreference(value: unknown) {
  return text(value, 120)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es")
    .trim();
}

function mergePreferences(...groups: Array<Array<string | null | undefined>>) {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const value of group) {
      const normalized = normalizePreference(value);
      if (normalized) merged.add(normalized);
      if (merged.size >= 40) break;
    }
  }
  return Array.from(merged);
}

function bookPreferences(book: BookPreference) {
  return mergePreferences([
    book.primary_niche,
    book.primary_category,
    book.secondary_category,
    ...(book.keywords ?? []).slice(0, 16),
  ]);
}

function missingRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = text(record.code, 32);
  const message = text(record.message, 600).toLowerCase();
  return code === "42P01" || message.includes("does not exist") || message.includes("schema cache");
}

async function getBook(bookSlug: string) {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select(
      "id, title, slug, primary_niche, primary_category, secondary_category, keywords"
    )
    .eq("slug", bookSlug)
    .eq("status", "published")
    .maybeSingle<BookPreference>();

  if (error) throw new Error(`No se pudo resolver el libro: ${error.message}`);
  return data;
}

async function logFallbackEvent(params: {
  eventType: string;
  book: BookPreference;
  subscriberToken: string;
  email?: string;
  emailNormalized?: string;
  whatsapp?: string | null;
  preferences: string[];
}) {
  const { error } = await supabaseAdmin.from("marketplace_events").insert({
    book_id: params.book.id,
    event_type: params.eventType,
    surface: "preview_subscription_gate",
    metadata: {
      subscriberToken: params.subscriberToken,
      email: params.email ?? null,
      emailNormalized: params.emailNormalized ?? null,
      whatsapp: params.whatsapp ?? null,
      emailOptIn: Boolean(params.email),
      whatsappOptIn: Boolean(params.whatsapp),
      primaryNiche: params.book.primary_niche,
      primaryCategory: params.book.primary_category,
      secondaryCategory: params.book.secondary_category,
      preferences: params.preferences,
      fallbackStorage: true,
    },
    occurred_at: new Date().toISOString(),
  });

  if (error) throw new Error(`No se pudo conservar el lead: ${error.message}`);
}

async function findFallbackByToken(subscriberToken: string) {
  const { data, error } = await supabaseAdmin
    .from("marketplace_events")
    .select("id, metadata")
    .eq("event_type", FALLBACK_EVENT_CREATED)
    .contains("metadata", { subscriberToken })
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as { id: number; metadata: Record<string, unknown> } | null;
}

async function findFallbackByEmail(normalizedEmail: string) {
  const { data, error } = await supabaseAdmin
    .from("marketplace_events")
    .select("id, metadata")
    .eq("event_type", FALLBACK_EVENT_CREATED)
    .contains("metadata", { emailNormalized: normalizedEmail })
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as { id: number; metadata: Record<string, unknown> } | null;
}

async function recordInterest(params: {
  subscription: SubscriptionRow;
  book: BookPreference;
  preferences: string[];
}) {
  const { subscription, book, preferences } = params;
  const now = new Date().toISOString();

  const currentPreferences = mergePreferences(
    subscription.preferences ?? [],
    preferences
  );

  const { error: subscriptionError } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .update({
      last_book_id: book.id,
      primary_niche: book.primary_niche,
      primary_category: book.primary_category,
      secondary_category: book.secondary_category,
      preferences: currentPreferences,
      last_seen_at: now,
    })
    .eq("id", subscription.id);

  if (subscriptionError) throw subscriptionError;

  const { data: existingInterest, error: interestReadError } = await supabaseAdmin
    .from(INTERESTS_TABLE)
    .select("qualified_preview_count")
    .eq("subscriber_id", subscription.id)
    .eq("book_id", book.id)
    .maybeSingle<{ qualified_preview_count: number }>();

  if (interestReadError && !missingRelation(interestReadError)) {
    throw interestReadError;
  }

  if (existingInterest) {
    const { error } = await supabaseAdmin
      .from(INTERESTS_TABLE)
      .update({
        primary_niche: book.primary_niche,
        primary_category: book.primary_category,
        secondary_category: book.secondary_category,
        matched_preferences: preferences,
        last_seen_at: now,
        qualified_preview_count: Math.max(
          1,
          Number(existingInterest.qualified_preview_count || 0) + 1
        ),
      })
      .eq("subscriber_id", subscription.id)
      .eq("book_id", book.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from(INTERESTS_TABLE).insert({
    subscriber_id: subscription.id,
    book_id: book.id,
    primary_niche: book.primary_niche,
    primary_category: book.primary_category,
    secondary_category: book.secondary_category,
    matched_preferences: preferences,
    first_seen_at: now,
    last_seen_at: now,
    qualified_preview_count: 1,
  });
  if (error) throw error;
}

async function findSubscriptionByToken(subscriberToken: string) {
  const { data, error } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .select(
      "id, subscriber_token, email, email_normalized, whatsapp, whatsapp_opt_in, status, preferences"
    )
    .eq("subscriber_token", subscriberToken)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    if (missingRelation(error)) return { row: null, tableMissing: true };
    throw error;
  }

  return { row: data, tableMissing: false };
}

async function verifySubscriber(subscriberToken: string) {
  const lookup = await findSubscriptionByToken(subscriberToken);
  if (lookup.row?.status === "active") return true;

  const fallback = await findFallbackByToken(subscriberToken);
  return Boolean(fallback);
}

async function trackKnownSubscriber(
  subscriberToken: string,
  book: BookPreference,
  preferences: string[]
) {
  const lookup = await findSubscriptionByToken(subscriberToken);

  if (lookup.row?.status === "active") {
    try {
      await recordInterest({ subscription: lookup.row, book, preferences });
      return;
    } catch (error) {
      if (!missingRelation(error)) throw error;
    }
  }

  const fallback = await findFallbackByToken(subscriberToken);
  if (!fallback) throw new Error("Suscriptor no reconocido.");

  await logFallbackEvent({
    eventType: FALLBACK_EVENT_INTEREST,
    book,
    subscriberToken,
    preferences,
  });
}

async function subscribe(params: {
  email: string;
  whatsapp: string | null;
  book: BookPreference;
  preferences: string[];
}) {
  const normalizedEmail = params.email.toLocaleLowerCase("en-US");
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .select(
      "id, subscriber_token, email, email_normalized, whatsapp, whatsapp_opt_in, status, preferences"
    )
    .eq("email_normalized", normalizedEmail)
    .maybeSingle<SubscriptionRow>();

  if (existingError && missingRelation(existingError)) {
    const fallback = await findFallbackByEmail(normalizedEmail);
    const priorToken = text(fallback?.metadata?.subscriberToken, 80);
    const subscriberToken = priorToken || crypto.randomUUID();

    await logFallbackEvent({
      eventType: FALLBACK_EVENT_CREATED,
      book: params.book,
      subscriberToken,
      email: params.email,
      emailNormalized: normalizedEmail,
      whatsapp: params.whatsapp,
      preferences: params.preferences,
    });

    return subscriberToken;
  }

  if (existingError) throw existingError;

  let subscription: SubscriptionRow;

  if (existing) {
    const merged = mergePreferences(existing.preferences ?? [], params.preferences);
    const updatePayload: Record<string, unknown> = {
      email: params.email,
      email_opt_in: true,
      status: "active",
      unsubscribed_at: null,
      last_book_id: params.book.id,
      primary_niche: params.book.primary_niche,
      primary_category: params.book.primary_category,
      secondary_category: params.book.secondary_category,
      preferences: merged,
      last_seen_at: now,
    };

    if (params.whatsapp) {
      updatePayload.whatsapp = params.whatsapp;
      updatePayload.whatsapp_opt_in = true;
    }

    const { data, error } = await supabaseAdmin
      .from(SUBSCRIPTIONS_TABLE)
      .update(updatePayload)
      .eq("id", existing.id)
      .select(
        "id, subscriber_token, email, email_normalized, whatsapp, whatsapp_opt_in, status, preferences"
      )
      .single<SubscriptionRow>();

    if (error || !data) throw error ?? new Error("No se pudo actualizar el suscriptor.");
    subscription = data;
  } else {
    const subscriberToken = crypto.randomUUID();
    const { data, error } = await supabaseAdmin
      .from(SUBSCRIPTIONS_TABLE)
      .insert({
        subscriber_token: subscriberToken,
        email: params.email,
        email_normalized: normalizedEmail,
        whatsapp: params.whatsapp,
        email_opt_in: true,
        whatsapp_opt_in: Boolean(params.whatsapp),
        status: "active",
        source: "preview_gate",
        first_book_id: params.book.id,
        last_book_id: params.book.id,
        primary_niche: params.book.primary_niche,
        primary_category: params.book.primary_category,
        secondary_category: params.book.secondary_category,
        preferences: params.preferences,
        first_seen_at: now,
        last_seen_at: now,
      })
      .select(
        "id, subscriber_token, email, email_normalized, whatsapp, whatsapp_opt_in, status, preferences"
      )
      .single<SubscriptionRow>();

    if (error || !data) throw error ?? new Error("No se pudo crear el suscriptor.");
    subscription = data;
  }

  try {
    await recordInterest({
      subscription,
      book: params.book,
      preferences: params.preferences,
    });
  } catch (error) {
    if (!missingRelation(error)) throw error;
  }

  return subscription.subscriber_token;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 24) || "subscribe";
    const bookSlug = text(body.bookSlug, 180);
    const subscriberToken = text(body.subscriberToken, 80);

    if (!bookSlug) {
      return NextResponse.json({ ok: false, error: "Libro requerido." }, { status: 400 });
    }

    const book = await getBook(bookSlug);
    if (!book) {
      return NextResponse.json({ ok: false, error: "Libro no encontrado." }, { status: 404 });
    }

    const preferences = bookPreferences(book);

    if (action === "verify") {
      if (!subscriberToken) {
        return NextResponse.json({ ok: false, recognized: false }, { status: 200 });
      }

      const recognized = await verifySubscriber(subscriberToken);
      return NextResponse.json({ ok: true, recognized });
    }

    if (action === "track") {
      if (!subscriberToken) {
        return NextResponse.json({ ok: false, error: "Token requerido." }, { status: 400 });
      }

      await trackKnownSubscriber(subscriberToken, book, preferences);
      return NextResponse.json({ ok: true, recognized: true });
    }

    const email = text(body.email, 320);
    const normalizedEmail = emailNormalized(email);
    const whatsappRaw = text(body.whatsapp, 40);
    const whatsapp = normalizeWhatsApp(whatsappRaw);

    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json(
        { ok: false, error: "Escribe un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (whatsappRaw && !whatsapp) {
      return NextResponse.json(
        { ok: false, error: "El número de WhatsApp no parece válido." },
        { status: 400 }
      );
    }

    const token = await subscribe({
      email,
      whatsapp,
      book,
      preferences,
    });

    return NextResponse.json(
      {
        ok: true,
        subscriberToken: token,
        recognized: true,
        preferenceProfile: preferences.slice(0, 8),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/preview-subscriptions:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "No pudimos guardar tus datos. Inténtalo nuevamente.",
      },
      { status: 500 }
    );
  }
}