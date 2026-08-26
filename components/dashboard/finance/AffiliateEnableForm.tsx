"use client";

import { FormEvent, useState } from "react";

export default function AffiliateEnableForm() {
  const [code,setCode] = useState("");
  const [message,setMessage] = useState<string | null>(null);
  const [busy,setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/finance/affiliate/enable", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({code}),
      });
      const body = await response.json().catch(()=>null) as {ok?:boolean;code?:string;error?:string}|null;
      if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo activar el afiliado.");
      setMessage(`Código activo: ${body.code}`); window.location.reload();
    } catch(error) { setMessage(error instanceof Error ? error.message : "Error activando afiliado."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <h3 className="font-black text-slate-950">Activar afiliado-vendedor</h3>
    <p className="mt-1 text-sm text-slate-600">Elige un código o déjalo vacío para generar uno automático.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <input value={code} onChange={(e)=>setCode(e.target.value)} placeholder="Ej. MARTIN10" className="min-w-[240px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2" />
      <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{busy ? "Activando..." : "Activar"}</button>
    </div>
    {message ? <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p> : null}
  </form>;
}