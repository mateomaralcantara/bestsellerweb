import { describe, expect, it } from "vitest";
import { buildAudienceAnalytics, filterAudienceLeads } from "../lib/admin/audience-analytics";
import type { AudienceLead } from "../lib/admin/audience-types";

const leads: AudienceLead[] = [
  {
    id: "1",
    subscriberToken: "a",
    email: "ana@example.com",
    whatsapp: "+18095550101",
    emailOptIn: true,
    whatsappOptIn: true,
    status: "active",
    source: "preview_gate",
    primaryNiche: "Negocios",
    primaryCategory: "Marketing",
    secondaryCategory: null,
    preferences: ["marketing", "ventas"],
    firstBookId: "b1",
    firstBookTitle: "Marketing 2026",
    lastBookId: "b1",
    lastBookTitle: "Marketing 2026",
    firstSeenAt: "2026-08-29T10:00:00-04:00",
    lastSeenAt: "2026-08-29T10:30:00-04:00",
    createdAt: "2026-08-29T10:00:00-04:00",
    updatedAt: "2026-08-29T10:30:00-04:00",
    bookInterests: [
      {
        bookId: "b1",
        title: "Marketing 2026",
        slug: "marketing-2026",
        qualifiedPreviewCount: 2,
        firstSeenAt: "2026-08-29T10:00:00-04:00",
        lastSeenAt: "2026-08-29T10:30:00-04:00",
      },
    ],
  },
  {
    id: "2",
    subscriberToken: "b",
    email: "leo@example.com",
    whatsapp: null,
    emailOptIn: true,
    whatsappOptIn: false,
    status: "active",
    source: "preview_gate",
    primaryNiche: "Tecnología",
    primaryCategory: "IA",
    secondaryCategory: null,
    preferences: ["ia"],
    firstBookId: "b2",
    firstBookTitle: "IA práctica",
    lastBookId: "b2",
    lastBookTitle: "IA práctica",
    firstSeenAt: "2026-08-28T09:00:00-04:00",
    lastSeenAt: "2026-08-28T09:00:00-04:00",
    createdAt: "2026-08-28T09:00:00-04:00",
    updatedAt: "2026-08-28T09:00:00-04:00",
    bookInterests: [
      {
        bookId: "b2",
        title: "IA práctica",
        slug: "ia-practica",
        qualifiedPreviewCount: 1,
        firstSeenAt: "2026-08-28T09:00:00-04:00",
        lastSeenAt: "2026-08-28T09:00:00-04:00",
      },
    ],
  },
];

describe("Audience Center analytics", () => {
  it("calcula métricas y ranking", () => {
    const analytics = buildAudienceAnalytics(leads, "2026-08-29T18:00:00-04:00");
    expect(analytics.stats.total).toBe(2);
    expect(analytics.stats.newToday).toBe(1);
    expect(analytics.stats.withWhatsapp).toBe(1);
    expect(analytics.topBooks[0].title).toBe("Marketing 2026");
    expect(analytics.topBooks[0].qualifiedPreviews).toBe(2);
  });

  it("filtra por canal y búsqueda", () => {
    expect(filterAudienceLeads(leads, { channel: "whatsapp" })).toHaveLength(1);
    expect(filterAudienceLeads(leads, { channel: "email_only" })).toHaveLength(1);
    expect(filterAudienceLeads(leads, { q: "IA práctica" })).toHaveLength(1);
    expect(filterAudienceLeads(leads, { category: "Marketing" })).toHaveLength(1);
  });
});
