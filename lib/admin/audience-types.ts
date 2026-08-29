export type AudienceStorageMode = "dedicated" | "fallback" | "hybrid";

export type AudienceBookInterest = {
  bookId: string;
  title: string;
  slug: string | null;
  qualifiedPreviewCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type AudienceLead = {
  id: string;
  subscriberToken: string;
  email: string;
  whatsapp: string | null;
  emailOptIn: boolean;
  whatsappOptIn: boolean;
  status: "active" | "unsubscribed" | "suppressed";
  source: string;
  primaryNiche: string | null;
  primaryCategory: string | null;
  secondaryCategory: string | null;
  preferences: string[];
  firstBookId: string | null;
  firstBookTitle: string | null;
  lastBookId: string | null;
  lastBookTitle: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  bookInterests: AudienceBookInterest[];
};

export type AudienceSegment = {
  key: string;
  label: string;
  leads: number;
  percentage: number;
};

export type AudienceBookPerformance = {
  bookId: string;
  title: string;
  slug: string | null;
  qualifiedLeads: number;
  qualifiedPreviews: number;
  previewStarts: number;
  previewCompletions: number;
  captureRate: number;
  verifiedSales: number;
  previewToPurchaseRate: number;
};

export type AudienceDailyPoint = {
  date: string;
  leads: number;
};

export type AudienceCenterStats = {
  total: number;
  active: number;
  newToday: number;
  newLast7Days: number;
  withWhatsapp: number;
  emailOnly: number;
  unsubscribed: number;
  suppressed: number;
};

export type AudienceCenterData = {
  generatedAt: string;
  storageMode: AudienceStorageMode;
  stats: AudienceCenterStats;
  daily: AudienceDailyPoint[];
  categories: AudienceSegment[];
  niches: AudienceSegment[];
  topBooks: AudienceBookPerformance[];
  leads: AudienceLead[];
};

export type AudienceFilters = {
  q?: string;
  status?: string;
  channel?: "all" | "email_only" | "whatsapp" | "both";
  category?: string;
  niche?: string;
  bookId?: string;
  from?: string;
  to?: string;
};
