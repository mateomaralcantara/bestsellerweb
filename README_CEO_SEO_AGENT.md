# Agente CEO/SEO diario de LibroSeller

## Qué hace

- Analiza un libro de enfoque por día y rota el catálogo para cubrir todos los libros.
- Usa compras, progreso de lectura y eventos agregados del catálogo.
- Crea un resumen ejecutivo, prioridades e ideas para Facebook e Instagram.
- Guarda un reporte diario para documentar el crecimiento.
- Incluye un grupo de enfoque sintético claramente separado de las reseñas reales.

El agente **no publica, no envía correos y no crea reseñas públicas**. Todo su
contenido es un borrador sujeto a aprobación humana. Los correos de la simulación
terminan en `.invalid` y no representan personas reales.

## Instalación

1. Ejecuta en Supabase SQL Editor:

   `supabase/migrations/20260818_ceo_seo_daily_agent.sql`

2. Agrega estas variables en Vercel para Production:

   ```env
   OPENAI_API_KEY=tu_clave_privada
   OPENAI_MODEL=gpt-5.4-mini
   CRON_SECRET=una_cadena_aleatoria_de_32_o_mas_caracteres
   CEO_SEO_ANALYZE_FULL_PDF=true
   ```

3. Vuelve a desplegar. El panel estará en:

   `/dashboard/ai-growth`

## Automatización

`vercel.json` programa una ejecución diaria a las `13:00 UTC`, equivalente a
las `9:00 a. m.` en República Dominicana. Vercel envía `CRON_SECRET` como token
Bearer y la ruta falla cerrada cuando el secreto falta o no coincide.

## Privacidad y control

- Los PDFs se comparten con la API de OpenAI mediante una URL firmada temporal.
- Solo se envían PDFs verificables de hasta 45 MB.
- Para impedir el envío del PDF completo, configura
  `CEO_SEO_ANALYZE_FULL_PDF=false`; el agente usará metadatos y extractos.
- Los eventos de interés no almacenan correos, nombres ni direcciones IP.
- El identificador anónimo solo evita contar repetidamente el mismo evento en
  un navegador durante el mismo día.
