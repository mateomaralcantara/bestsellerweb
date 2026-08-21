-- SOLO PARA RECUPERACIÓN MANUAL Y DESPUÉS DE CREAR UN RESPALDO.
-- No elimina compras, órdenes PayPal ni accesos existentes.

begin;

drop function if exists public.consume_api_rate_limit(text, text, integer, integer);
drop function if exists public.claim_paypal_webhook_event(text, text, text, jsonb);
drop function if exists public.grant_book_purchase_atomic(uuid, uuid, numeric, text, text, text);

drop table if exists public.paypal_webhook_events;
drop table if exists public.api_rate_limits;

alter table if exists public.paypal_orders
  drop constraint if exists paypal_orders_currency_format_check;
alter table if exists public.book_purchases
  drop constraint if exists book_purchases_currency_format_check;

-- Se conservan RLS y los permisos restrictivos deliberadamente.

commit;
