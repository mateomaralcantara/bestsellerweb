# Visual preview tipo Amazon/KDP

## 1) Instala dependencias

```bash
npm install pdfjs-dist @napi-rs/canvas
```

Si Next te da problemas empaquetando canvas, agrega en `next.config.mjs`:

```js
const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
```

## 2) Ejecuta el SQL

Ejecuta `supabase/sql/2026_book_visual_preview.sql` en Supabase SQL Editor.

## 3) Reemplaza archivos

Copia estos archivos sobre tu proyecto:

- `app/dashboard/books/new/page.tsx`
- `app/api/books/route.ts`
- `app/catalog/[slug]/page.tsx`
- `components/book-card.tsx`
- `components/books/BookPreviewModal.tsx`

## 4) Prueba

Crea un libro nuevo usando PDF. Deben generarse:

- 1 página de portada
- 17 páginas del PDF
- total esperado: 18 filas en `book_preview_pages`

Consulta rápida:

```sql
select book_id, count(*) as total_preview_pages
from book_preview_pages
group by book_id
order by total_preview_pages desc;
```
