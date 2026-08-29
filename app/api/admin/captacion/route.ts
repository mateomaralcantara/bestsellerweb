import { NextResponse } from "next/server";
import { getAudienceCenterData } from "@/lib/admin/audience-center";
import { filterAudienceLeads } from "@/lib/admin/audience-analytics";
import { AdminAccessError, requireAdminApi } from "@/lib/admin/superadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminApi("audience.read");
    const url = new URL(request.url);
    const data = await getAudienceCenterData();
    const leads = filterAudienceLeads(data.leads, {
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

    return NextResponse.json(
      {
        ok: true,
        ...data,
        leads,
        filteredTotal: leads.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo cargar Captación.",
      },
      { status: 500 }
    );
  }
}
