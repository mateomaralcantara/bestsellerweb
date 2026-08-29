export const DEFAULT_BOOK_DISPLAY_RATING = 0;
export const DEFAULT_BOOK_DISPLAY_SALES_COUNT = 0;

export type BookSocialProof = {
  rating: number;
  salesCount: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeDisplayRating(
  value: unknown,
  fallback = DEFAULT_BOOK_DISPLAY_RATING
): number {
  const parsed = toFiniteNumber(value);

  if (parsed === null || parsed < 0 || parsed > 5) {
    return fallback;
  }

  return Math.round(parsed * 10) / 10;
}

export function normalizeDisplaySalesCount(
  value: unknown,
  fallback = DEFAULT_BOOK_DISPLAY_SALES_COUNT
): number {
  const parsed = toFiniteNumber(value);

  if (parsed === null || parsed < 0) {
    return fallback;
  }

  return Math.round(parsed);
}

export function getBookSocialProof(
  metadata: Record<string, unknown> | null | undefined
): BookSocialProof {
  const safeMetadata = metadata ?? {};

  return {
    rating: normalizeDisplayRating(
      safeMetadata.verified_rating ?? safeMetadata.rating
    ),
    salesCount: normalizeDisplaySalesCount(
      safeMetadata.verified_sales_count ?? safeMetadata.sales_count
    ),
  };
}

export function mergeBookSocialProofMetadata(
  metadata: Record<string, unknown> | null | undefined,
  socialProof: BookSocialProof
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    verified_rating: normalizeDisplayRating(socialProof.rating),
    verified_sales_count: normalizeDisplaySalesCount(socialProof.salesCount),
    display_metrics_source: "verified",
  };
}
