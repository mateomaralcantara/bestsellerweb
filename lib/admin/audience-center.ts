import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAudienceAnalytics } from "./audience-analytics";
import type {
  AudienceBookInterest,
  AudienceBookPerformance,
  AudienceCenterData,
  AudienceLead,
  AudienceStorageMode,
} from "./audience-types";

const SUBSCRIPTIONS_TABLE = "preview_reader_subscriptions";
const INTERESTS_TABLE = "preview_reader_subscription_interests";
const FALLBACK_CREATED = "preview_subscription_created";
const FALLBACK_INTEREST = "preview_subscription_interest";
const READ_PAGE_SIZE = 1000;
const MAX_LEADS = 50000;
const MAX_INTERESTS = 100000;
const MAX_FALLBACK_EVENTS = 100000;

type BookRow = {
  id: string;
  title: string | null;
  slug: string | null;
};

type DedicatedSubscriptionRow = {
  id: string;
  subscriber_token: string;
  email: string;
  whatsapp: string | null;
  email_opt_in: boolean;
  whatsapp_opt_in: boolean;
  status: string;
  source: string;
  first_book_id: string | null;
  last_book_id: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  preferences: string[] | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DedicatedInterestRow = {
  subscriber_id: string;
  book_id: string;
  matched_preferences: string[] | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  qualified_preview_count: number | null;
};

type FallbackEventRow = {
  id: number | string;
  book_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string | null;
};

type BookMetricRow = {
  book_id: string;
  verified_sales_count: number | string | null;
  preview_starts: number | string | null;
  preview_completions: number | string | null;
  preview_to_purchase_rate: number | string | null;
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const valueText = text(item, 160);
    if (valueText) seen.add(valueText);
    if (seen.size >= 60) break;
  }
  return [...seen];
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function leadStatus(value: unknown): AudienceLead["status"] {
  return value === "unsubscribed" || value === "suppressed" ? value : "active";
}

function missingRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = text(record.code, 50);
  const message = text(record.message, 1000).toLocaleLowerCase("en");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizedEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function earlier(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function later(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function mergeLead(primary: AudienceLead, secondary: AudienceLead): AudienceLead {
  const interests = new Map<string, AudienceBookInterest>();
  for (const item of secondary.bookInterests) interests.set(item.bookId, item);
  for (const item of primary.bookInterests) interests.set(item.bookId, item);

  return {
    ...secondary,
    ...primary,
    email: primary.email || secondary.email,
    whatsapp: primary.whatsapp || secondary.whatsapp,
    emailOptIn: primary.emailOptIn || secondary.emailOptIn,
    whatsappOptIn: primary.whatsappOptIn || secondary.whatsappOptIn,
    primaryNiche: primary.primaryNiche || secondary.primaryNiche,
    primaryCategory: primary.primaryCategory || secondary.primaryCategory,
    secondaryCategory: primary.secondaryCategory || secondary.secondaryCategory,
    preferences: unique([...primary.preferences, ...secondary.preferences]).slice(0, 60),
    firstBookId: primary.firstBookId || secondary.firstBookId,
    firstBookTitle: primary.firstBookTitle || secondary.firstBookTitle,
    lastBookId: primary.lastBookId || secondary.lastBookId,
    lastBookTitle: primary.lastBookTitle || secondary.lastBookTitle,
    firstSeenAt: earlier(primary.firstSeenAt, secondary.firstSeenAt),
    lastSeenAt: later(primary.lastSeenAt, secondary.lastSeenAt),
    createdAt: earlier(primary.createdAt, secondary.createdAt),
    updatedAt: later(primary.updatedAt, secondary.updatedAt),
    bookInterests: [...interests.values()].sort((a, b) =>
      String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))
    ),
  };
}

async function enrichBookPerformance(
  books: AudienceBookPerformance[]
): Promise<AudienceBookPerformance[]> {
  if (books.length === 0) return books;

  const ids = books.map((book) => book.bookId);
  const metrics = new Map<string, BookMetricRow>();

  for (let start = 0; start < ids.length; start += 200) {
    const batch = ids.slice(start, start + 200);
    const { data, error } = await supabaseAdmin
      .from("book_verified_metrics")
      .select(
        "book_id,verified_sales_count,preview_starts,preview_completions,preview_to_purchase_rate"
      )
      .in("book_id", batch);

    if (error) {
      // Rendimiento editorial es enriquecimiento: nunca debe impedir abrir Captación.
      return books;
    }

    for (const row of (data ?? []) as BookMetricRow[]) metrics.set(row.book_id, row);
  }

  return books.map((book) => {
    const metric = metrics.get(book.bookId);
    const previewStarts = Math.max(0, Number(metric?.preview_starts || 0));
    const previewCompletions = Math.max(0, Number(metric?.preview_completions || 0));
    const verifiedSales = Math.max(0, Number(metric?.verified_sales_count || 0));
    const captureRate =
      previewStarts > 0
        ? Math.round((book.qualifiedLeads / previewStarts) * 10_000) / 100
        : 0;

    return {
      ...book,
      previewStarts,
      previewCompletions,
      captureRate,
      verifiedSales,
      previewToPurchaseRate: Math.max(0, Number(metric?.preview_to_purchase_rate || 0)),
    };
  });
}

function mergeDedicatedAndFallback(
  dedicated: AudienceLead[],
  fallback: AudienceLead[]
): AudienceLead[] {
  const byEmail = new Map<string, AudienceLead>();

  for (const lead of fallback) {
    const key = normalizedEmail(lead.email);
    if (key) byEmail.set(key, lead);
  }

  for (const lead of dedicated) {
    const key = normalizedEmail(lead.email);
    if (!key) continue;
    const existing = byEmail.get(key);
    byEmail.set(key, existing ? mergeLead(lead, existing) : lead);
  }

  return [...byEmail.values()].sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

async function loadBooks(bookIds: string[]) {
  const ids = unique(bookIds.filter(Boolean));
  const map = new Map<string, BookRow>();
  if (ids.length === 0) return map;

  for (let start = 0; start < ids.length; start += 500) {
    const batch = ids.slice(start, start + 500);
    const { data, error } = await supabaseAdmin
      .from("books")
      .select("id,title,slug")
      .in("id", batch);

    if (error) throw new Error(`No se pudieron resolver libros de captación: ${error.message}`);
    for (const row of (data ?? []) as BookRow[]) map.set(row.id, row);
  }

  return map;
}

function interestView(
  row: DedicatedInterestRow,
  books: Map<string, BookRow>
): AudienceBookInterest {
  const book = books.get(row.book_id);
  return {
    bookId: row.book_id,
    title: book?.title || "Libro sin título",
    slug: book?.slug ?? null,
    qualifiedPreviewCount: Math.max(1, Number(row.qualified_preview_count || 1)),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

async function loadDedicatedLeads(): Promise<AudienceLead[] | null> {
  const subscriptions: DedicatedSubscriptionRow[] = [];

  for (let start = 0; start < MAX_LEADS; start += READ_PAGE_SIZE) {
    const end = Math.min(MAX_LEADS - 1, start + READ_PAGE_SIZE - 1);
    const { data, error } = await supabaseAdmin
      .from(SUBSCRIPTIONS_TABLE)
      .select(
        "id,subscriber_token,email,whatsapp,email_opt_in,whatsapp_opt_in,status,source,first_book_id,last_book_id,primary_niche,primary_category,secondary_category,preferences,first_seen_at,last_seen_at,created_at,updated_at"
      )
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) {
      if (missingRelation(error)) return null;
      throw new Error(`No se pudieron cargar suscriptores de preview: ${error.message}`);
    }

    const page = (data ?? []) as DedicatedSubscriptionRow[];
    subscriptions.push(...page);
    if (page.length < READ_PAGE_SIZE) break;
  }
  const subscriberIds = subscriptions.map((row) => row.id);
  let interests: DedicatedInterestRow[] = [];

  if (subscriberIds.length > 0) {
    let interestsTableMissing = false;

    for (let batchStart = 0; batchStart < subscriberIds.length; batchStart += 300) {
      if (interests.length >= MAX_INTERESTS || interestsTableMissing) break;
      const batch = subscriberIds.slice(batchStart, batchStart + 300);

      for (let pageStart = 0; interests.length < MAX_INTERESTS; pageStart += READ_PAGE_SIZE) {
        const pageEnd = Math.min(
          pageStart + READ_PAGE_SIZE - 1,
          pageStart + (MAX_INTERESTS - interests.length) - 1
        );
        const { data: interestData, error: interestError } = await supabaseAdmin
          .from(INTERESTS_TABLE)
          .select(
            "subscriber_id,book_id,matched_preferences,first_seen_at,last_seen_at,qualified_preview_count"
          )
          .in("subscriber_id", batch)
          .order("last_seen_at", { ascending: false })
          .range(pageStart, pageEnd);

        if (interestError) {
          if (missingRelation(interestError)) {
            interests = [];
            interestsTableMissing = true;
            break;
          }
          throw new Error(`No se pudieron cargar intereses de audiencia: ${interestError.message}`);
        }

        const page = (interestData ?? []) as DedicatedInterestRow[];
        interests.push(...page);
        if (page.length < READ_PAGE_SIZE) break;
      }
    }
  }

  const bookIds = [
    ...subscriptions.flatMap((row) => [row.first_book_id, row.last_book_id]),
    ...interests.map((row) => row.book_id),
  ].filter((value): value is string => Boolean(value));
  const books = await loadBooks(bookIds);

  const interestsBySubscriber = new Map<string, DedicatedInterestRow[]>();
  for (const row of interests) {
    const list = interestsBySubscriber.get(row.subscriber_id) ?? [];
    list.push(row);
    interestsBySubscriber.set(row.subscriber_id, list);
  }

  return subscriptions.map((row) => {
    const rowInterests = interestsBySubscriber.get(row.id) ?? [];
    const interestPreferences = rowInterests.flatMap((item) => strings(item.matched_preferences));
    const firstBook = row.first_book_id ? books.get(row.first_book_id) : null;
    const lastBook = row.last_book_id ? books.get(row.last_book_id) : null;

    return {
      id: row.id,
      subscriberToken: row.subscriber_token,
      email: row.email,
      whatsapp: row.whatsapp,
      emailOptIn: Boolean(row.email_opt_in),
      whatsappOptIn: Boolean(row.whatsapp_opt_in),
      status: leadStatus(row.status),
      source: row.source || "preview_gate",
      primaryNiche: row.primary_niche,
      primaryCategory: row.primary_category,
      secondaryCategory: row.secondary_category,
      preferences: unique([...strings(row.preferences), ...interestPreferences]).slice(0, 60),
      firstBookId: row.first_book_id,
      firstBookTitle: firstBook?.title ?? null,
      lastBookId: row.last_book_id,
      lastBookTitle: lastBook?.title ?? null,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      bookInterests: rowInterests
        .map((item) => interestView(item, books))
        .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))),
    } satisfies AudienceLead;
  });
}

async function loadFallbackLeads(): Promise<AudienceLead[]> {
  const newestFirst: FallbackEventRow[] = [];

  for (let start = 0; start < MAX_FALLBACK_EVENTS; start += READ_PAGE_SIZE) {
    const end = Math.min(MAX_FALLBACK_EVENTS - 1, start + READ_PAGE_SIZE - 1);
    const { data, error } = await supabaseAdmin
      .from("marketplace_events")
      .select("id,book_id,event_type,metadata,occurred_at")
      .in("event_type", [FALLBACK_CREATED, FALLBACK_INTEREST])
      .order("occurred_at", { ascending: false })
      .range(start, end);

    if (error) throw new Error(`No se pudo leer el respaldo de captación: ${error.message}`);
    const page = (data ?? []) as FallbackEventRow[];
    newestFirst.push(...page);
    if (page.length < READ_PAGE_SIZE) break;
  }

  const events = newestFirst.reverse();
  const books = await loadBooks(
    events.map((row) => row.book_id).filter((value): value is string => Boolean(value))
  );

  type Accumulator = {
    token: string;
    email: string;
    whatsapp: string | null;
    emailOptIn: boolean;
    whatsappOptIn: boolean;
    preferences: string[];
    primaryNiche: string | null;
    primaryCategory: string | null;
    secondaryCategory: string | null;
    firstBookId: string | null;
    lastBookId: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    createdAt: string | null;
    interests: Map<string, AudienceBookInterest>;
  };

  const byToken = new Map<string, Accumulator>();

  for (const event of events) {
    const metadata = event.metadata ?? {};
    const token = text(metadata.subscriberToken, 100);
    if (!token) continue;

    let current = byToken.get(token);
    const occurredAt = event.occurred_at;

    if (!current) {
      current = {
        token,
        email: "",
        whatsapp: null,
        emailOptIn: false,
        whatsappOptIn: false,
        preferences: [],
        primaryNiche: null,
        primaryCategory: null,
        secondaryCategory: null,
        firstBookId: null,
        lastBookId: null,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
        createdAt: null,
        interests: new Map(),
      };
      byToken.set(token, current);
    }

    if (occurredAt && (!current.firstSeenAt || occurredAt < current.firstSeenAt)) {
      current.firstSeenAt = occurredAt;
    }
    if (occurredAt && (!current.lastSeenAt || occurredAt > current.lastSeenAt)) {
      current.lastSeenAt = occurredAt;
    }

    const metadataPreferences = strings(metadata.preferences);
    current.preferences = unique([...current.preferences, ...metadataPreferences]).slice(0, 60);
    current.primaryNiche = text(metadata.primaryNiche, 160) || current.primaryNiche;
    current.primaryCategory = text(metadata.primaryCategory, 160) || current.primaryCategory;
    current.secondaryCategory = text(metadata.secondaryCategory, 160) || current.secondaryCategory;

    if (event.event_type === FALLBACK_CREATED) {
      current.email = text(metadata.email, 320) || current.email;
      current.whatsapp = text(metadata.whatsapp, 50) || current.whatsapp;
      current.emailOptIn = booleanValue(metadata.emailOptIn, Boolean(current.email));
      current.whatsappOptIn = booleanValue(metadata.whatsappOptIn, Boolean(current.whatsapp));
      current.firstBookId = current.firstBookId || event.book_id;
      current.lastBookId = event.book_id || current.lastBookId;
      current.createdAt = current.createdAt || occurredAt;
    } else {
      current.lastBookId = event.book_id || current.lastBookId;
    }

    if (event.book_id) {
      const book = books.get(event.book_id);
      const existing = current.interests.get(event.book_id);
      if (existing) {
        existing.qualifiedPreviewCount += 1;
        existing.lastSeenAt = occurredAt || existing.lastSeenAt;
      } else {
        current.interests.set(event.book_id, {
          bookId: event.book_id,
          title: book?.title || "Libro sin título",
          slug: book?.slug ?? null,
          qualifiedPreviewCount: 1,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt,
        });
      }
    }
  }

  return [...byToken.values()]
    .filter((row) => Boolean(row.email))
    .map((row) => ({
      id: `fallback:${row.token}`,
      subscriberToken: row.token,
      email: row.email,
      whatsapp: row.whatsapp,
      emailOptIn: row.emailOptIn,
      whatsappOptIn: row.whatsappOptIn,
      status: "active" as const,
      source: "preview_gate:fallback",
      primaryNiche: row.primaryNiche,
      primaryCategory: row.primaryCategory,
      secondaryCategory: row.secondaryCategory,
      preferences: row.preferences,
      firstBookId: row.firstBookId,
      firstBookTitle: row.firstBookId ? books.get(row.firstBookId)?.title ?? null : null,
      lastBookId: row.lastBookId,
      lastBookTitle: row.lastBookId ? books.get(row.lastBookId)?.title ?? null : null,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt || row.firstSeenAt,
      updatedAt: row.lastSeenAt,
      bookInterests: [...row.interests.values()].sort((a, b) =>
        String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))
      ),
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getAudienceCenterData(): Promise<AudienceCenterData> {
  const dedicated = await loadDedicatedLeads();
  const fallback = await loadFallbackLeads();

  let storageMode: AudienceStorageMode;
  let leads: AudienceLead[];

  if (dedicated === null) {
    storageMode = "fallback";
    leads = fallback;
  } else if (fallback.length > 0) {
    storageMode = "hybrid";
    leads = mergeDedicatedAndFallback(dedicated, fallback);
  } else {
    storageMode = "dedicated";
    leads = dedicated;
  }

  const generatedAt = new Date().toISOString();
  const analytics = buildAudienceAnalytics(leads, generatedAt);
  const topBooks = await enrichBookPerformance(analytics.topBooks);

  return {
    generatedAt,
    storageMode,
    ...analytics,
    topBooks,
    leads,
  };
}
