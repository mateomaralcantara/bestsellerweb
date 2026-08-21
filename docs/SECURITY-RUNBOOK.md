# Runbook de blindaje y despliegue

## Orden obligatorio de instalación

1. Crea un respaldo de la base de datos en Supabase.
2. Ejecuta una sola vez `supabase/migrations/20260820_total_security_hardening.sql`
   en SQL Editor.
3. Verifica que existan:
   - `api_rate_limits`;
   - `paypal_webhook_events`;
   - `consume_api_rate_limit`;
   - `claim_paypal_webhook_event`;
   - `grant_book_purchase_atomic`.
   Confirma además que los buckets `book-files` y `book-previews` aparezcan
   como **Private** en Supabase Storage; el script los fuerza a privados si ya
   existen.
4. Agrega en Vercel Production `RATE_LIMIT_SECRET`, `HEALTHCHECK_SECRET` y
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Los dos secretos deben ser diferentes y
   tener al menos 32 caracteres. La Site Key de Turnstile sí es pública.
5. Despliega el código y confirma que CI y CodeQL estén verdes.
6. Prueba primero PayPal Sandbox y luego una compra Live con una cuenta de
   comprador distinta de la cuenta vendedora.
7. Activa la protección de `main` con
   `scripts/enable-github-protection.ps1` cuando el workflow CI ya exista.

## Controles del proveedor

En Supabase Auth, configura como mínimo:

- confirmación de correo obligatoria;
- contraseña mínima de 10 caracteres;
- Cloudflare Turnstile para registro e inicio de sesión. Primero despliega la
  Site Key en Vercel y confirma que el widget carga; después activa CAPTCHA en
  Supabase y pega allí el **Secret Key** de Turnstile;
- MFA obligatorio para administradores;
- URLs de redirección limitadas a `https://www.libroseller.com/**`;
- SMTP propio y límites de envío revisados.

En Supabase Database y Storage:

- activa copias diarias y, si el plan lo permite, recuperación a un punto en el
  tiempo;
- prueba una restauración al menos trimestralmente;
- conserva `book-files` y `book-previews` privados; `book-covers` puede ser
  público;
- no crees políticas públicas sobre objetos de `book-files` ni
  `book-previews`;
- las postulaciones de afiliados deben entrar solo por
  `/api/applications/affiliate`, con una sesión autenticada.

En Vercel:

- limita las variables reales al entorno **Production** que corresponda;
- activa protección de despliegues preview cuando contengan datos reales;
- revisa Firewall/Attack Challenge para picos anómalos;
- conserva logs sin cuerpos de webhooks, contraseñas ni secretos.

En GitHub:

- activa Secret Scanning y Push Protection si están disponibles;
- exige el check `verify` en `main`;
- prohíbe force-push y eliminación de la rama;
- revisa semanalmente las propuestas de Dependabot.

## Variables mínimas de producción

Usa `.env.example` como inventario. Nunca copies valores reales al repositorio.
En Vercel, todas deben estar en **Production** y luego debe hacerse un nuevo
deployment; cambiar una variable no modifica deployments anteriores.

Generación segura en PowerShell:

```powershell
$Bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
[Convert]::ToBase64String($Bytes)
```

Genera un valor distinto para cada secreto.

## Validación posterior

```powershell
curl.exe -I https://www.libroseller.com
curl.exe https://www.libroseller.com/api/health
curl.exe `
  -H "Authorization: Bearer TU_HEALTHCHECK_SECRET" `
  "https://www.libroseller.com/api/health?deep=1"
```

La primera respuesta debe incluir CSP, HSTS, `X-Frame-Options: DENY` y
`Cross-Origin-Opener-Policy: same-origin-allow-popups`. El health check profundo
debe responder HTTP 200 sin revelar valores de las variables.

Comprueba además que un libro en borrador responda 404 tanto en su página de
muestra como en `/api/books/SLUG/preview/0`, y que una postulación sin sesión o
sin `X-BestSeller-Request: 1` sea rechazada.

## PayPal

- El webhook de producción debe apuntar a
  `https://www.libroseller.com/api/payments/paypal/webhook`.
- Debe estar suscrito como mínimo a `PAYMENT.CAPTURE.COMPLETED`.
- `PAYPAL_WEBHOOK_ID` debe corresponder exactamente a ese webhook Live.
- No mezcles Client ID/Secret Sandbox con `PAYPAL_ENV=live`.
- Conserva `PayPal-Request-Id`; evita capturas duplicadas.

Consulta `paypal_webhook_events` cuando una compra no se acredite. Los estados
`failed` se reintentan; `completed` e `ignored` son idempotentes.

## Incidentes

1. Desactiva temporalmente el checkout si hay cobros inconsistentes.
2. Rota el secreto afectado en el proveedor y en Vercel.
3. Revoca la credencial anterior.
4. Revisa logs de Vercel, `paypal_orders`, `paypal_webhook_events` y PayPal.
5. Reconcilia pagos usando IDs de orden/captura; nunca usando solo el correo.
6. Documenta hora, impacto, alcance, corrección y pruebas.

## Recuperación

El código se revierte con `git revert` del commit de blindaje. Para retirar solo
las tablas auxiliares, revisa primero
`supabase/rollback/20260820_total_security_hardening_rollback.sql`. No ejecutes
el rollback SQL sin respaldo: elimina el ledger de webhooks y los contadores de
rate limit, aunque no elimina compras ni órdenes.
