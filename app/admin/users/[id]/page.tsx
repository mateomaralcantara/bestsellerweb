import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBooksClient from "@/components/admin/AdminBooksClient";
import AdminPayoutsClient from "@/components/admin/AdminPayoutsClient";
import AdminPurchasesClient from "@/components/admin/AdminPurchasesClient";
import AdminUsersClient from "@/components/admin/AdminUsersClient";
import AdminUser360ExtraClient from "@/components/admin/AdminUser360ExtraClient";
import { getAdminUser360 } from "@/lib/admin/user-360";
import { requireAdminPage } from "@/lib/admin/superadmin";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 sm:p-6"><h2 className="text-2xl font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>;
}

export default async function AdminUser360Page({ params }: Props) {
  await requireAdminPage("users.read");
  const { id } = await params;
  const data = await getAdminUser360(id);
  if (!data) notFound();

  return <div className="space-y-6">
    <div className="rounded-[32px] bg-slate-950 p-6 text-white">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">USER 360 CONTROL CENTER</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-3xl font-black">{data.user.fullName || data.user.email || "Usuario"}</h2><p className="mt-2 text-sm text-slate-300">{data.user.email}</p><p className="mt-1 break-all text-xs text-slate-500">{data.user.id}</p></div><Link href="/admin/users" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold">Volver a usuarios</Link></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[["Roles",data.user.roles.length],["Libros",data.books.length],["Compras",data.purchases.length],["Retiros",data.payouts.length],["Ledger",data.ledger.length],["Estado",data.user.banned ? "Suspendido" : "Activo"]].map(([label,value]) => <div key={String(label)} className="rounded-2xl bg-white/5 p-4"><p className="text-xs uppercase text-slate-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div>
    </div>

    <Box title="Identidad, roles, suspension y bloqueos"><AdminUsersClient rows={[data.user]} /></Box>

    <Box title="Credenciales, metadata, finanzas y biblioteca"><AdminUser360ExtraClient userId={data.user.id} userMetadata={data.userMetadata as Record<string, unknown>} appMetadata={data.appMetadata as Record<string, unknown>} purchases={data.purchases} summaries={data.summaries} /></Box>

    <Box title="Perfil de autor y afiliado"><div className="grid gap-4 xl:grid-cols-2"><div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><p className="font-black">Autor</p>{data.author ? <><p className="mt-2 text-sm">{data.author.display_name || data.author.pen_name}</p><p className="text-xs text-slate-500">/{data.author.slug} - {data.author.approval_status}</p><Link href="/admin/authors" className="mt-3 inline-block rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white">Modificar autor</Link></> : <p className="mt-2 text-sm text-slate-500">Sin perfil. Puedes agregar el rol y gestionar su alta desde Autores.</p>}</div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-black">Afiliado</p>{data.affiliate ? <><p className="mt-2 text-sm">{data.affiliate.display_name || data.affiliate.handle}</p><p className="text-xs text-slate-500">{data.affiliate.referral_code || data.affiliate.code} - {data.affiliate.status} - {Number(data.affiliate.commission_rate || 0).toFixed(2)}%</p><Link href="/admin/affiliates" className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Modificar afiliado</Link></> : <p className="mt-2 text-sm text-slate-500">Sin perfil. Puedes gestionar su alta desde Afiliados.</p>}</div></div></Box>

    <Box title="Libros del usuario">{data.books.length ? <AdminBooksClient rows={data.books} /> : <p className="text-sm text-slate-500">No posee libros.</p>}</Box>
    <Box title="Reembolsos de compras activas">{data.activePurchases.length ? <AdminPurchasesClient rows={data.activePurchases} /> : <p className="text-sm text-slate-500">No hay compras activas reembolsables.</p>}</Box>
    <Box title="Retiros del usuario">{data.payouts.length ? <AdminPayoutsClient rows={data.payouts} /> : <p className="text-sm text-slate-500">No tiene retiros.</p>}</Box>

    <Box title="Ledger financiero - solo lectura"><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[850px] w-full text-sm"><thead className="bg-slate-100 text-left"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Detalle</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{data.ledger.map((row) => <tr key={row.id}><td className="px-4 py-3 text-slate-500">{new Date(row.createdAt).toLocaleString("es-DO")}</td><td className="px-4 py-3">{row.roleContext}</td><td className="px-4 py-3 font-bold">{row.eventType}</td><td className="px-4 py-3">{row.description || row.reference || "Movimiento"}</td><td className={row.signedAmount >= 0 ? "px-4 py-3 text-right font-black text-emerald-700" : "px-4 py-3 text-right font-black text-rose-700"}>{row.currency} {row.signedAmount.toFixed(2)}</td><td className="px-4 py-3">{row.effectiveStatus}</td></tr>)}</tbody></table></div></Box>

    <Box title="Auditoria sobre el usuario"><div className="space-y-3">{data.audit.length ? data.audit.map((row) => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex justify-between gap-3"><p className="font-black">{row.action}</p><p className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleString("es-DO")}</p></div><p className="mt-1 text-xs text-slate-500">{row.module} - admin {row.adminUserId || "sistema"}</p><p className="mt-2 text-sm">{row.reason || "Sin motivo"}</p></article>) : <p className="text-sm text-slate-500">Sin acciones administrativas registradas.</p>}</div></Box>
  </div>;
}