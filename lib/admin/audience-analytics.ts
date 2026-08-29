import type {
  AudienceBookPerformance,
  AudienceCenterStats,
  AudienceDailyPoint,
  AudienceFilters,
  AudienceLead,
  AudienceSegment,
} from "./audience-types";

const REPORT_TIME_ZONE = "America/Santo_Domingo";

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

export function dayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function buildSegments(
  leads: AudienceLead[],
  selector: (lead: AudienceLead) => string | null
): AudienceSegment[] {
  const counts = new Map<string, { label: string; leads: number }>();

  for (const lead of leads) {
    const raw = selector(lead)?.trim();
    if (!raw) continue;
    const key = normalize(raw);
    if (!key) continue;
    const current = counts.get(key) ?? { label: raw, leads: 0 };
    current.leads += 1;
    counts.set(key, current);
  }

  return [...counts.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      leads: value.leads,
      percentage: percentage(value.leads, leads.length),
    }))
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label))
    .slice(0, 20);
}

function buildTopBooks(leads: AudienceLead[]): AudienceBookPerformance[] {
  const books = new Map<
    string,
    {
      title: string;
      slug: string | null;
      tokens: Set<string>;
      qualifiedPreviews: number;
    }
  >();

  for (const lead of leads) {
    for (const interest of lead.bookInterests) {
      const current = books.get(interest.bookId) ?? {
        title: interest.title,
        slug: interest.slug,
        tokens: new Set<string>(),
        qualifiedPreviews: 0,
      };
      current.tokens.add(lead.subscriberToken || lead.id);
      current.qualifiedPreviews += Math.max(1, interest.qualifiedPreviewCount || 1);
      books.set(interest.bookId, current);
    }

    if (lead.bookInterests.length === 0 && lead.firstBookId) {
      const current = books.get(lead.firstBookId) ?? {
        title: lead.firstBookTitle || "Libro sin título",
        slug: null,
        tokens: new Set<string>(),
        qualifiedPreviews: 0,
      };
      current.tokens.add(lead.subscriberToken || lead.id);
      current.qualifiedPreviews += 1;
      books.set(lead.firstBookId, current);
    }
  }

  return [...books.entries()]
    .map(([bookId, value]) => ({
      bookId,
      title: value.title,
      slug: value.slug,
      qualifiedLeads: value.tokens.size,
      qualifiedPreviews: value.qualifiedPreviews,
      previewStarts: 0,
      previewCompletions: 0,
      captureRate: 0,
      verifiedSales: 0,
      previewToPurchaseRate: 0,
    }))
    .sort(
      (a, b) =>
        b.qualifiedLeads - a.qualifiedLeads ||
        b.qualifiedPreviews - a.qualifiedPreviews ||
        a.title.localeCompare(b.title)
    )
    .slice(0, 20);
}

function buildDaily(leads: AudienceLead[], now: Date): AudienceDailyPoint[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.createdAt ? dayKey(lead.createdAt) : "";
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: AudienceDailyPoint[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * 86_400_000);
    const key = dayKey(date);
    points.push({ date: key, leads: counts.get(key) ?? 0 });
  }
  return points;
}

export function buildAudienceAnalytics(
  leads: AudienceLead[],
  nowIso = new Date().toISOString()
) {
  const now = new Date(nowIso);
  const today = dayKey(now);
  const sevenDaysAgo = now.getTime() - 7 * 86_400_000;

  const stats: AudienceCenterStats = {
    total: leads.length,
    active: 0,
    newToday: 0,
    newLast7Days: 0,
    withWhatsapp: 0,
    emailOnly: 0,
    unsubscribed: 0,
    suppressed: 0,
  };

  for (const lead of leads) {
    if (lead.status === "active") stats.active += 1;
    if (lead.status === "unsubscribed") stats.unsubscribed += 1;
    if (lead.status === "suppressed") stats.suppressed += 1;

    if (lead.whatsapp && lead.whatsappOptIn) stats.withWhatsapp += 1;
    else stats.emailOnly += 1;

    if (lead.createdAt && dayKey(lead.createdAt) === today) stats.newToday += 1;
    if (lead.createdAt) {
      const created = new Date(lead.createdAt).getTime();
      if (!Number.isNaN(created) && created >= sevenDaysAgo) stats.newLast7Days += 1;
    }
  }

  return {
    stats,
    daily: buildDaily(leads, now),
    categories: buildSegments(leads, (lead) => lead.primaryCategory),
    niches: buildSegments(leads, (lead) => lead.primaryNiche),
    topBooks: buildTopBooks(leads),
  };
}

export function filterAudienceLeads(
  leads: AudienceLead[],
  filters: AudienceFilters
): AudienceLead[] {
  const q = normalize(filters.q);
  const status = normalize(filters.status);
  const category = normalize(filters.category);
  const niche = normalize(filters.niche);
  const bookId = String(filters.bookId ?? "").trim();

  return leads.filter((lead) => {
    if (status && status !== "all" && lead.status !== status) return false;

    if (filters.channel === "whatsapp" && !(lead.whatsapp && lead.whatsappOptIn)) {
      return false;
    }
    if (
      filters.channel === "email_only" &&
      !(lead.emailOptIn && !(lead.whatsapp && lead.whatsappOptIn))
    ) {
      return false;
    }
    if (
      filters.channel === "both" &&
      !(lead.emailOptIn && lead.whatsapp && lead.whatsappOptIn)
    ) {
      return false;
    }

    if (category && normalize(lead.primaryCategory) !== category) return false;
    if (niche && normalize(lead.primaryNiche) !== niche) return false;
    if (bookId && !lead.bookInterests.some((item) => item.bookId === bookId)) {
      return false;
    }

    if (filters.from && lead.createdAt && dayKey(lead.createdAt) < filters.from) {
      return false;
    }
    if (filters.to && lead.createdAt && dayKey(lead.createdAt) > filters.to) {
      return false;
    }

    if (q) {
      const haystack = normalize(
        [
          lead.email,
          lead.whatsapp,
          lead.primaryNiche,
          lead.primaryCategory,
          lead.secondaryCategory,
          ...lead.preferences,
          ...lead.bookInterests.map((item) => item.title),
        ].join(" ")
      );
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}
