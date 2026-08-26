import { getAdminAudit } from "@/lib/admin/admin-data";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdminPage("audit.read");
  const rows = await getAdminAudit();

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">
        Trazabilidad
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        Auditoría administrativa
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Registro inmutable de cambios críticos con administrador, objetivo y motivo.
      </p>

      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{row.action}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.module} · {row.target_type || "sistema"} · {row.target_id || "-"}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(row.created_at).toLocaleString("es-DO")}
              </p>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              {row.reason || "Sin motivo registrado"}
            </p>
            <p className="mt-2 break-all text-xs text-slate-400">
              Admin: {row.admin_user_id || "sistema"} · request {row.request_id}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
