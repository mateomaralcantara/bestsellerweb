import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import { analyzeEpubBuffer } from "@/lib/epub-preflight";
import { analyzeFixedLayoutQuality } from "@/lib/epub-fixed-layout-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bookkey: string }> };

function safeKey(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function getBook(bookkey: string) {
  let query = supabaseAdmin
    .from("books")
    .select("id, slug, title, owner_user_id, author_id")
    .limit(1);

  query = isUuid(bookkey) ? query.eq("id", bookkey) : query.eq("slug", bookkey);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function authorize(bookkey: string) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return { error: "Debes iniciar sesión.", status: 401, user: null, book: null };

  const book = await getBook(bookkey);
  if (!book) return { error: "Libro no encontrado.", status: 404, user: null, book: null };

  if (book.owner_user_id === auth.user.id) {
    return { error: null, status: 200, user: auth.user, book };
  }

  const access = await getAuthorPublishingAccess(auth.user.id);
  if (access.authorId && access.authorId === book.author_id) {
    return { error: null, status: 200, user: auth.user, book };
  }

  return { error: "No tienes permiso para auditar este libro.", status: 403, user: null, book: null };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const access = await authorize(bookkey);
    if (access.error || !access.book) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data, error } = await supabaseAdmin
      .from("epub_preflight_reports")
      .select("id, score, status, epub_version, layout, summary, findings, source_sha256, created_at")
      .eq("book_id", access.book.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: "El módulo Preflight aún no está habilitado en Supabase." }, { status: 503 });
    }

    return NextResponse.json({ book: access.book, reports: data ?? [] });
  } catch (error) {
    console.error("GET preflight:", error);
    return NextResponse.json({ error: "No se pudo cargar el historial editorial." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const access = await authorize(bookkey);
    if (access.error || !access.book || !access.user) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data: assets, error: assetError } = await supabaseAdmin
      .from("book_assets")
      .select("id, edition_id, storage_bucket, storage_path, asset_type, created_at")
      .eq("book_id", access.book.id)
      .eq("asset_type", "epub")
      .order("created_at", { ascending: false })
      .limit(1);

    if (assetError || !assets?.length) {
      return NextResponse.json({ error: "No se encontró el EPUB privado del libro." }, { status: 404 });
    }

    const asset = assets[0];
    if (!asset.storage_bucket || !asset.storage_path) {
      return NextResponse.json({ error: "El asset EPUB no tiene una ruta de almacenamiento válida." }, { status: 422 });
    }

    const { data: originalBlob, error: downloadError } = await supabaseAdmin.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (downloadError || !originalBlob) {
      return NextResponse.json({ error: "No se pudo descargar el EPUB para auditarlo." }, { status: 502 });
    }

    let analysisBlob = originalBlob;
    let analyzedVariant: "original" | "optimized" = "original";

    const { data: normalization } = await supabaseAdmin
      .from("epub_normalizations")
      .select("source_asset_id, storage_bucket, storage_path, status, is_current")
      .eq("book_id", access.book.id)
      .eq("is_current", true)
      .maybeSingle();

    if (
      normalization?.status === "normalized" &&
      normalization.storage_bucket &&
      normalization.storage_path &&
      (!normalization.source_asset_id || normalization.source_asset_id === asset.id)
    ) {
      const { data: optimizedBlob } = await supabaseAdmin.storage
        .from(normalization.storage_bucket)
        .download(normalization.storage_path);
      if (optimizedBlob) {
        analysisBlob = optimizedBlob;
        analyzedVariant = "optimized";
      }
    }

    const analysisBytes = await analysisBlob.arrayBuffer();
    const baseReport = await analyzeEpubBuffer(analysisBytes);
    const fixedLayoutQuality = await analyzeFixedLayoutQuality(analysisBytes);

    const findings = baseReport.findings.filter((item) => item.code !== "EPUB_READY");
    findings.push(...fixedLayoutQuality.findings);

    const score = clamp(baseReport.score - fixedLayoutQuality.penalty, 0, 100);
    const hasErrors = findings.some((item) => item.severity === "error");
    const status: "pass" | "warning" | "fail" =
      hasErrors || score < 60 ? "fail" : score < 90 ? "warning" : "pass";

    if (status === "pass") {
      findings.push({
        code: "EPUB_QUALITY_GATE_10",
        severity: "info",
        message: "EPUB aprobado por LibroSeller Quality Gate 10/10.",
        detail: analyzedVariant === "optimized" ? "La auditoría evaluó la variante optimizada servida al lector." : "La auditoría evaluó el EPUB original.",
      });
    }

    const report = {
      ...baseReport,
      score,
      status,
      findings,
      summary: {
        ...baseReport.summary,
        preflightProfile: "libroseller-10",
        analyzedVariant,
        qualityThreshold: 90,
        fixedLayoutQuality: fixedLayoutQuality.applicable ? fixedLayoutQuality.metrics : null,
      },
    };

    const { data: stored, error: storeError } = await supabaseAdmin
      .from("epub_preflight_reports")
      .insert({
        book_id: access.book.id,
        edition_id: asset.edition_id ?? null,
        source_sha256: report.checksumSha256,
        epub_version: report.epubVersion,
        layout: report.layout,
        score: report.score,
        status: report.status,
        summary: report.summary,
        findings: report.findings,
        created_by: access.user.id,
      })
      .select("id")
      .single();

    if (storeError) {
      return NextResponse.json(
        { error: "El análisis terminó, pero Supabase no tiene aplicada la migración Preflight.", report },
        { status: 503 }
      );
    }

    const { data: current } = await supabaseAdmin
      .from("book_editorial_versions")
      .select("id, version_number, checksum_sha256")
      .eq("book_id", access.book.id)
      .eq("is_current", true)
      .maybeSingle();

    let version = current;
    if (!current || current.checksum_sha256 !== report.checksumSha256) {
      const { data: latest } = await supabaseAdmin
        .from("book_editorial_versions")
        .select("version_number")
        .eq("book_id", access.book.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: createdVersion } = await supabaseAdmin
        .from("book_editorial_versions")
        .insert({
          book_id: access.book.id,
          edition_id: asset.edition_id ?? null,
          version_number: Number(latest?.version_number || 0) + 1,
          checksum_sha256: report.checksumSha256,
          preflight_report_id: stored.id,
          change_notes: `Versión auditada por LibroSeller Quality Gate 10/10 (${analyzedVariant}).`,
          is_current: true,
          created_by: access.user.id,
        })
        .select("id, version_number, checksum_sha256")
        .maybeSingle();
      version = createdVersion ?? current;
    }

    const publicationGate = report.score >= 90 && report.status === "pass" ? "ready" : "editorial_review";

    return NextResponse.json({
      book: { id: access.book.id, slug: access.book.slug, title: access.book.title },
      report: { ...report, id: stored.id },
      version,
      publicationGate,
      analyzedVariant,
    });
  } catch (error) {
    console.error("POST preflight:", error);
    return NextResponse.json({ error: "No se pudo completar el análisis EPUB." }, { status: 500 });
  }
}
