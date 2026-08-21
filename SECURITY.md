# Seguridad de BestSeller

## Reportar una vulnerabilidad

No publiques credenciales, datos de tarjetas, tokens, enlaces firmados ni datos
personales en un issue público. Informa el problema de forma privada al
propietario del repositorio e incluye:

- ruta o componente afectado;
- impacto observado;
- pasos mínimos para reproducirlo;
- fecha y entorno (sandbox o producción);
- identificadores de PayPal parcialmente ocultos.

No incluyas secretos completos ni datos bancarios reales.

## Alcance de los controles

- CSP con nonce por solicitud y protección contra framing.
- Validación de origen y tamaño en mutaciones del navegador.
- Rate limiting distribuido mediante Supabase, con respaldo local temporal.
- Verificación, deduplicación y registro de webhooks PayPal.
- Acreditación atómica de compras.
- Validación de firmas internas de PDF, EPUB e imágenes.
- Manuscritos y muestras visuales en buckets privados, servidos tras validar
  compra, autoría o estado publicado.
- Postulaciones con sesión, validación del servidor y límite de frecuencia.
- CI, CodeQL, Dependabot y auditoría de dependencias.

## Versiones soportadas

Solo la rama `main` desplegada y el último commit de seguridad reciben soporte.
No se deben desplegar archivos `.env`, respaldos ni diagnósticos.
