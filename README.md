# BestSeller
Starter premium para una plataforma editorial y tienda de libros con Next.js + TypeScript + Tailwind + Supabase.

## Incluye
- Home moderna
- Catálogo y detalle de libro
- Carrito y checkout que guarda pedidos en Supabase
- Formularios para autores y afiliados
- Auth base con Supabase
- Dashboard demo
- SQL de schema + seed

## Pasos
1. `npm install`
2. Copia `.env.example` a `.env.local`
3. Ejecuta `supabase/schema.sql` y luego `supabase/seed.sql` en Supabase SQL Editor
4. `npm run dev`

## Nota
La pasarela de pago no viene conectada. El checkout guarda pedidos y deja el proyecto listo para integrar AZUL o CardNET.
