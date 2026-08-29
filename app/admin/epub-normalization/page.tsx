import { requireAdminPage } from "@/lib/admin/superadmin";
import EpubNormalizationAdminClient from "./EpubNormalizationAdminClient";

export const dynamic = "force-dynamic";

export default async function EpubNormalizationAdminPage() {
  await requireAdminPage("*");

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">LibroSeller Editorial Engine</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Fixed Layout Normalizer</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Reprocesa el catálogo por lotes. Solo transforma EPUB fixed-layout de una imagen por página con alta confianza; los EPUB reflowable o complejos se conservan intactos. El original nunca se elimina.
      </p>
      <div className="mt-8">
        <EpubNormalizationAdminClient />
      </div>
    </main>
  );
}
