import { getAudienceCenterData } from "@/lib/admin/audience-center";
import { filterAudienceLeads } from "@/lib/admin/audience-analytics";
import { AdminAccessError, requireAdminApi } from "@/lib/admin/superadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    await requireAdminApi("audience.export");
    const url = new URL(request.url);
    const data = await getAudienceCenterData();
    const rows = filterAudienceLeads(data.leads, {
      q: url.searchParams.get("q") || undefined,
      status: url.searchParams.get("status") || undefined,
      channel: (url.searchParams.get("channel") || "all") as
        | "all"
        | "email_only"
        | "whatsapp"
        | "both",
      category: url.searchParams.get("category") || undefined,
      niche: url.searchParams.get("niche") || undefined,
      bookId: url.searchParams.get("bookId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });

    const header = [
      "Correo",
      "WhatsApp",
      "Correo autorizado",
      "WhatsApp autorizado",
      "Estado",
      "Nicho principal",
      "Categoría principal",
      "Categoría secundaria",
      "Preferencias",
      "Libro de captación",
      "Último libro",
      "Libros explorados",
      "Previews cualificados",
      "Primera captación",
      "Última actividad",
      "Fuente",
    ];

    const csvRows = rows.map((row) => [
      row.email,
      row.whatsapp,
      row.emailOptIn ? "Sí" : "No",
      row.whatsappOptIn ? "Sí" : "No",
      row.status,
      row.primaryNiche,
      row.primaryCategory,
      row.secondaryCategory,
      row.preferences.join(" | "),
      row.firstBookTitle,
      row.lastBookTitle,
      row.bookInterests.map((item) => item.title).join(" | "),
      row.bookInterests.reduce((sum, item) => sum + item.qualifiedPreviewCount, 0),
      row.createdAt,
      row.lastSeenAt,
      row.source,
    ]);

    const csv = [header, ...csvRows]
      .map((row) => row.map(safeCsvCell).join(","))
      .join("\r\n");
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="libroseller-captacion-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      {
        error: error instanceof Error ? error.message : "No se pudo exportar Captación.",
      },
      { status: 500 }
    );
  }
}
