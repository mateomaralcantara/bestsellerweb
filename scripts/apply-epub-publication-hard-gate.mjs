import fs from "node:fs";

function patchFile(path, patches) {
  let text = fs.readFileSync(path, "utf8");
  let changed = false;

  for (const { label, before, after } of patches) {
    if (text.includes(after)) continue;
    if (!text.includes(before)) {
      throw new Error(`[${path}] No se encontró el bloque requerido: ${label}`);
    }
    text = text.replace(before, after);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, text);
  console.log(`${changed ? "PATCHED" : "OK"} ${path}`);
}

patchFile("app/api/books/[bookkey]/route.ts", [
  {
    label: "import publication gate",
    before: `} from "@/lib/book-social-proof";\n\nexport const runtime = "nodejs";`,
    after: `} from "@/lib/book-social-proof";\nimport { getEpubPublicationGate } from "@/lib/epub-publication-gate";\n\nexport const runtime = "nodejs";`,
  },
  {
    label: "owned book status",
    before: `  cover_url: string | null;\n  metadata: Record<string, unknown> | null;`,
    after: `  cover_url: string | null;\n  status: string;\n  metadata: Record<string, unknown> | null;`,
  },
  {
    label: "select book status",
    before: `.select("id, title, slug, owner_user_id, cover_url, metadata");`,
    after: `.select("id, title, slug, owner_user_id, cover_url, status, metadata");`,
  },
  {
    label: "hard gate before mutations",
    before: `    const { title, status, keywords } = validateMainFields(formData);\n\n    const price = parseRequiredPrice(formData);`,
    after: `    const { title, status, keywords } = validateMainFields(formData);\n    const fullEpub = getFileField(formData, ["epub_file", "epub"]);\n\n    if (status === "published" && fullEpub) {\n      return NextResponse.json(\n        {\n          ok: false,\n          error:\n            "Un EPUB nuevo no puede publicarse en la misma operación. Guárdalo en revisión, ejecuta LibroSeller Quality Gate 10/10 y luego publícalo.",\n          publicationGate: {\n            ready: false,\n            code: "new_epub_requires_preflight",\n          },\n        },\n        { status: 409 }\n      );\n    }\n\n    if (status === "published" && book.status !== "published") {\n      const publicationGate = await getEpubPublicationGate(book.id);\n      if (!publicationGate.ready) {\n        return NextResponse.json(\n          {\n            ok: false,\n            error: publicationGate.message,\n            publicationGate,\n          },\n          { status: 409 }\n        );\n      }\n    }\n\n    const price = parseRequiredPrice(formData);`,
  },
  {
    label: "reuse early epub field",
    before: `    const cover = getFileField(formData, ["cover"]);\n    const fullEpub = getFileField(formData, ["epub_file", "epub"]);\n    const previewEpub = getFileField(formData, ["preview_epub"]);`,
    after: `    const cover = getFileField(formData, ["cover"]);\n    const previewEpub = getFileField(formData, ["preview_epub"]);`,
  },
]);

patchFile("app/api/books/[bookkey]/preflight/route.ts", [
  {
    label: "import gate evaluator",
    before: `import { analyzeFixedLayoutQuality } from "@/lib/epub-fixed-layout-quality";\n`,
    after: `import { analyzeFixedLayoutQuality } from "@/lib/epub-fixed-layout-quality";\nimport { evaluateEpubPublicationGate } from "@/lib/epub-publication-gate";\n`,
  },
  {
    label: "bind report to exact epub",
    before: `        preflightProfile: "libroseller-10",\n        analyzedVariant,\n        qualityThreshold: 90,`,
    after: `        preflightProfile: "libroseller-10",\n        analyzedVariant,\n        sourceAssetId: String(asset.id),\n        sourceStorageBucket: asset.storage_bucket,\n        sourceStoragePath: asset.storage_path,\n        qualityThreshold: 90,`,
  },
  {
    label: "derive publication gate from exact artifact",
    before: `    const publicationGate = report.score >= 90 && report.status === "pass" ? "ready" : "editorial_review";\n\n    return NextResponse.json({`,
    after: `    const publicationGateDetail = evaluateEpubPublicationGate(\n      { id: asset.id, storage_path: asset.storage_path },\n      { id: stored.id, score: report.score, status: report.status, summary: report.summary }\n    );\n    const publicationGate = publicationGateDetail.ready ? "ready" : "editorial_review";\n\n    return NextResponse.json({`,
  },
  {
    label: "expose publication gate detail",
    before: `      publicationGate,\n      analyzedVariant,`,
    after: `      publicationGate,\n      publicationGateDetail,\n      analyzedVariant,`,
  },
]);

patchFile("app/api/books/[bookkey]/epub-upload/route.ts", [
  {
    label: "owned book status direct upload",
    before: `type OwnedBook = { id: string; slug: string; owner_user_id: string };`,
    after: `type OwnedBook = { id: string; slug: string; owner_user_id: string; status: string };`,
  },
  {
    label: "select status direct upload",
    before: `let query = supabaseAdmin.from("books").select("id, slug, owner_user_id").limit(1);`,
    after: `let query = supabaseAdmin.from("books").select("id, slug, owner_user_id, status").limit(1);`,
  },
  {
    label: "demote published book after epub replacement",
    before: `      .update({\n        preview_mode: "epub_preview",\n        preview_status: "ready",`,
    after: `      .update({\n        ...(access.book.status === "published" ? { status: "under_review" } : {}),\n        preview_mode: "epub_preview",\n        preview_status: "ready",`,
  },
  {
    label: "return quality requirement after replacement",
    before: `      normalization: {\n        status: normalization.status,\n        optimized: normalization.optimized,\n        report: normalization.report,\n        warning: normalization.error || null,\n      },\n    });`,
    after: `      normalization: {\n        status: normalization.status,\n        optimized: normalization.optimized,\n        report: normalization.report,\n        warning: normalization.error || null,\n      },\n      publicationGate: {\n        ready: false,\n        status: "editorial_review",\n        reason: "epub_replaced",\n        requiresQualityGate: true,\n        bookStatus: access.book.status === "published" ? "under_review" : access.book.status,\n      },\n    });`,
  },
]);

patchFile("app/api/admin/control/route.ts", [
  {
    label: "import publication gate admin",
    before: `import { refundPayPalCapture } from "@/lib/paypal/admin-refund";\n`,
    after: `import { refundPayPalCapture } from "@/lib/paypal/admin-refund";\nimport { getEpubPublicationGate } from "@/lib/epub-publication-gate";\n`,
  },
  {
    label: "admin publication gate",
    before: `  const before = await selectOne("books", "id", bookId);\n  if (!before) throw new AdminAccessError("Libro no encontrado.", 404);\n\n  const roundedPrice = Math.round(paypalPrice * 100) / 100;`,
    after: `  const before = await selectOne("books", "id", bookId);\n  if (!before) throw new AdminAccessError("Libro no encontrado.", 404);\n\n  if (status === "published" && before.status !== "published") {\n    const publicationGate = await getEpubPublicationGate(bookId);\n    if (!publicationGate.ready) {\n      throw new AdminAccessError(publicationGate.message, 409);\n    }\n  }\n\n  const roundedPrice = Math.round(paypalPrice * 100) / 100;`,
  },
]);
