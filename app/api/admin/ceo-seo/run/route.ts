import { getAdminAccess } from "@/lib/admin-access";
import { runDailyCeoSeoAgent } from "@/lib/ceo-seo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const access = await getAdminAccess();

  if (!access.user) {
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  if (!access.isAdmin) {
    return Response.json({ error: "Acceso administrativo requerido." }, { status: 403 });
  }

  try {
    const report = await runDailyCeoSeoAgent({ force: true });

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
    console.error("Error ejecutando Agente CEO/SEO:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar el agente.",
      },
      { status: 500 }
    );
  }
}
