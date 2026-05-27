<div className="grid gap-5">
  <label className="space-y-2 text-sm text-slate-800">
    <span>Introducción</span>
    <textarea
      name="introduction"
      rows={6}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="Pega aquí la introducción del libro"
    />
  </label>

  <label className="space-y-2 text-sm text-slate-800">
    <span>Primer capítulo / extracto</span>
    <textarea
      name="chapter_one_excerpt"
      rows={10}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="Pega aquí el capítulo 1 o un extracto"
    />
  </label>

  <label className="space-y-2 text-sm text-slate-800">
    <span>URL de muestra PDF (opcional)</span>
    <input
      name="sample_url"
      type="url"
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="https://..."
    />
  </label>
</div>