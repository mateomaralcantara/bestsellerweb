import { runDailyCeoSeoAgent } from "@/lib/ceo-seo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const report = await runDailyCeoSeoAgent();

    return Response.json(
      {
        ok: true,
        reportDate: report.reportDate,
        status: report.status,
        sourceMode: report.sourceMode,
        generatedAt: report.generatedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Cron del Agente CEO/SEO falló:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el reporte diario.",
      },
      { status: 500 }
    );
  }
}
