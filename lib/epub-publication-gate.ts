export const EPUB_PUBLICATION_PROFILE = "libroseller-10";
export const EPUB_PUBLICATION_MIN_SCORE = 90;

export type EpubPublicationAsset = {
  id: string | number;
  storage_path: string | null;
};

export type EpubPublicationReport = {
  id?: string | number | null;
  score: number | null;
  status: string | null;
  summary: unknown;
};

export type EpubPublicationGateCode =
  | "ready"
  | "epub_missing"
  | "preflight_missing"
  | "profile_outdated"
  | "asset_mismatch"
  | "file_mismatch"
  | "quality_not_passed"
  | "gate_unavailable";

export type EpubPublicationGateResult = {
  ready: boolean;
  code: EpubPublicationGateCode;
  message: string;
  assetId?: string;
  storagePath?: string;
  reportId?: string;
  score?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function evaluateEpubPublicationGate(
  asset: EpubPublicationAsset | null | undefined,
  report: EpubPublicationReport | null | undefined
): EpubPublicationGateResult {
  if (!asset) {
    return {
      ready: false,
      code: "epub_missing",
      message: "El libro no tiene un EPUB completo vigente para publicar.",
    };
  }

  const assetId = String(asset.id);
  const storagePath = asset.storage_path?.trim() || "";

  if (!storagePath) {
    return {
      ready: false,
      code: "epub_missing",
      message: "El EPUB vigente no tiene una ruta de almacenamiento válida.",
      assetId,
    };
  }

  if (!report) {
    return {
      ready: false,
      code: "preflight_missing",
      message: "Ejecuta LibroSeller Quality Gate 10/10 antes de publicar este EPUB.",
      assetId,
      storagePath,
    };
  }

  const summary = asRecord(report.summary);
  const profile = asNonEmptyString(summary.preflightProfile);
  const sourceAssetId = asNonEmptyString(summary.sourceAssetId);
  const sourceStoragePath = asNonEmptyString(summary.sourceStoragePath);
  const reportId = report.id == null ? undefined : String(report.id);
  const score = Number(report.score);

  if (profile !== EPUB_PUBLICATION_PROFILE) {
    return {
      ready: false,
      code: "profile_outdated",
      message: "El reporte editorial vigente no pertenece al perfil LibroSeller Quality Gate 10/10. Vuelve a auditar el EPUB.",
      assetId,
      storagePath,
      reportId,
      score: Number.isFinite(score) ? score : undefined,
    };
  }

  if (sourceAssetId !== assetId) {
    return {
      ready: false,
      code: "asset_mismatch",
      message: "El EPUB cambió después de la última auditoría. Ejecuta nuevamente el Quality Gate 10/10.",
      assetId,
      storagePath,
      reportId,
      score: Number.isFinite(score) ? score : undefined,
    };
  }

  if (sourceStoragePath !== storagePath) {
    return {
      ready: false,
      code: "file_mismatch",
      message: "El archivo EPUB vigente no coincide con el archivo auditado. Ejecuta nuevamente el Quality Gate 10/10.",
      assetId,
      storagePath,
      reportId,
      score: Number.isFinite(score) ? score : undefined,
    };
  }

  if (
    report.status !== "pass" ||
    !Number.isFinite(score) ||
    score < EPUB_PUBLICATION_MIN_SCORE
  ) {
    return {
      ready: false,
      code: "quality_not_passed",
      message: `El EPUB debe obtener al menos ${EPUB_PUBLICATION_MIN_SCORE}/100 y estado pass antes de publicarse.`,
      assetId,
      storagePath,
      reportId,
      score: Number.isFinite(score) ? score : undefined,
    };
  }

  return {
    ready: true,
    code: "ready",
    message: "EPUB aprobado para publicación por LibroSeller Quality Gate 10/10.",
    assetId,
    storagePath,
    reportId,
    score,
  };
}

export async function getEpubPublicationGate(
  bookId: string
): Promise<EpubPublicationGateResult> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: assets, error: assetError } = await supabaseAdmin
    .from("book_assets")
    .select("id, storage_path")
    .eq("book_id", bookId)
    .eq("asset_type", "epub")
    .order("sort_order", { ascending: true })
    .limit(1);

  if (assetError) {
    return {
      ready: false,
      code: "gate_unavailable",
      message: "No se pudo verificar el EPUB vigente para publicación.",
    };
  }

  const asset = (assets?.[0] ?? null) as EpubPublicationAsset | null;
  if (!asset) return evaluateEpubPublicationGate(null, null);

  const { data: reports, error: reportError } = await supabaseAdmin
    .from("epub_preflight_reports")
    .select("id, score, status, summary, created_at")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (reportError) {
    return {
      ready: false,
      code: "gate_unavailable",
      message: "No se pudo verificar el Quality Gate 10/10 en Supabase.",
      assetId: String(asset.id),
      storagePath: asset.storage_path || undefined,
    };
  }

  return evaluateEpubPublicationGate(
    asset,
    (reports?.[0] ?? null) as EpubPublicationReport | null
  );
}
