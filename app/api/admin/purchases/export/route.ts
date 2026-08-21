import { getAdminAccess } from "@/lib/admin-access";
import { getActivePurchaseRows } from "@/lib/admin-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const access = await getAdminAccess();

  if (!access.user) {
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  if (!access.isAdmin) {
    return Response.json({ error: "Acceso denegado." }, { status: 403 });
  }

  try {
    const rows = await getActivePurchaseRows();
    const header = [
      "Usuario",
      "Correo",
      "User ID",
      "Libro",
      "Book ID",
      "Estado",
      "Proveedor",
      "Referencia de pago",
      "Orden del proveedor",
      "Monto",
      "Moneda",
      "Fecha de pago",
    ];

    const csvRows = rows.map((row) => [
      row.userName,
      row.userEmail,
      row.userId,
      row.bookTitle,
      row.bookId,
      "Activa",
      row.paymentProvider,
      row.paymentReference,
      row.providerOrderId,
      row.amountPaid,
      row.currency,
      row.paidAt,
    ]);

    const csv = [header, ...csvRows]
      .map((row) => row.map(safeCsvCell).join(","))
      .join("\r\n");

    const date = new Date().toISOString().slice(0, 10);

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="compras-activas-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo exportar el registro.",
      },
      { status: 500 }
    );
  }
}
