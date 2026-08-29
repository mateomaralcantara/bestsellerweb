import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import EpubQualityClient from "./EpubQualityClient";

export const dynamic = "force-dynamic";

export default async function EpubQualityPage() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();

  if (error || !auth.user) {
    redirect(`/auth?next=${encodeURIComponent("/dashboard/epub-quality")}`);
  }

  const { data } = await supabaseAdmin
    .from("books")
    .select("id, slug, title, status")
    .eq("owner_user_id", auth.user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">LibroSeller Editorial Engine</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">EPUB Quality Gate 10/10</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
        Audita OPF, spine, navegación, recursos y metadata, y en fixed-layout mide resolución raster, geometría, relación de aspecto, viewport, clipping y estiramiento. La aprobación editorial exige 90/100 o más y cero errores técnicos; cuando existe una variante optimizada, el gate valida exactamente la versión servida al lector.
      </p>
      <div className="mt-8">
        <EpubQualityClient books={(data ?? []).map((book) => ({ id: String(book.id), slug: String(book.slug), title: String(book.title), status: book.status ? String(book.status) : null }))} />
      </div>
    </main>
  );
}
