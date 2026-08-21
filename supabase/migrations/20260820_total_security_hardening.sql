begin;

-- Los manuscritos completos se entregan únicamente mediante rutas que validan
-- autoría o compra. Una URL pública del bucket anularía ese control.
update storage.buckets
set public = false,
    updated_at = now()
where id in ('book-files', 'book-previews');

update storage.buckets
set file_size_limit = least(coalesce(file_size_limit, 15728640), 15728640),
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
    updated_at = now()
where id = 'book-previews';

drop policy if exists "Public can read book previews" on storage.objects;

do $$
begin
  if to_regclass('public.book_preview_pages') is not null then
    execute 'alter table public.book_preview_pages enable row level security';
    execute 'alter table public.book_preview_pages force row level security';
    execute 'revoke all on table public.book_preview_pages from anon, authenticated';
    execute 'grant all on table public.book_preview_pages to service_role';
  end if;
end;
$$;

update public.book_assets
set is_public = false,
    updated_at = now()
where asset_type in ('epub', 'pdf', 'manuscript', 'manuscript_pdf');

alter table if exists public.book_purchases
  add column if not exists revoked_at timestamptz;

-- Conserva el historial, pero deja un solo acceso activo por usuario/libro.
-- Los pagos duplicados siguen auditables en paypal_orders.
with ranked_active_purchases as (
  select
    id,
    row_number() over (
      partition by user_id, book_id
      order by coalesce(paid_at, created_at) desc, id desc
    ) as duplicate_position
  from public.book_purchases
  where revoked_at is null
    and status in ('paid', 'completed', 'approved', 'succeeded')
)
update public.book_purchases as purchase
set revoked_at = now(),
    updated_at = now()
from ranked_active_purchases as ranked
where purchase.id = ranked.id
  and ranked.duplicate_position > 1;

create unique index if not exists book_purchases_one_active_access_uidx
  on public.book_purchases (user_id, book_id)
  where revoked_at is null
    and status in ('paid', 'completed', 'approved', 'succeeded');

alter table if exists public.paypal_orders enable row level security;
alter table if exists public.paypal_orders force row level security;
alter table if exists public.book_purchases enable row level security;
alter table if exists public.book_purchases force row level security;
alter table if exists public.books enable row level security;
alter table if exists public.books force row level security;
alter table if exists public.book_editions enable row level security;
alter table if exists public.book_editions force row level security;
alter table if exists public.book_assets enable row level security;
alter table if exists public.book_assets force row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.orders force row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.order_items force row level security;
alter table if exists public.author_applications enable row level security;
alter table if exists public.author_applications force row level security;
alter table if exists public.affiliate_applications enable row level security;
alter table if exists public.affiliate_applications force row level security;

revoke all on table public.paypal_orders from anon, authenticated;
grant all on table public.paypal_orders to service_role;

revoke all on table public.book_purchases from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.book_purchases from authenticated;
grant select on table public.book_purchases to authenticated;
grant all on table public.book_purchases to service_role;

-- El catálogo puede leerse con RLS, pero toda mutación editorial pasa por la
-- API autenticada para validar propiedad, estado, precio y archivos.
revoke insert, update, delete, truncate, references, trigger
  on table public.books from anon, authenticated;
grant select on table public.books to anon, authenticated;
grant all on table public.books to service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.book_editions from anon, authenticated;
grant select on table public.book_editions to anon, authenticated;
grant all on table public.book_editions to service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.book_assets from anon, authenticated;
grant select on table public.book_assets to anon, authenticated;
grant all on table public.book_assets to service_role;

drop policy if exists "bestseller_books_read_hardened" on public.books;
create policy "bestseller_books_read_hardened"
  on public.books
  for select
  using (status = 'published' or owner_user_id = auth.uid());

drop policy if exists "bestseller_book_editions_read_hardened"
  on public.book_editions;
create policy "bestseller_book_editions_read_hardened"
  on public.book_editions
  for select
  using (
    exists (
      select 1
      from public.books as book
      where book.id = book_editions.book_id
        and (book.status = 'published' or book.owner_user_id = auth.uid())
    )
  );

drop policy if exists "bestseller_book_assets_read_hardened"
  on public.book_assets;
create policy "bestseller_book_assets_read_hardened"
  on public.book_assets
  for select
  using (
    is_public = true
    or exists (
      select 1
      from public.books as book
      where book.id = book_assets.book_id
        and book.owner_user_id = auth.uid()
    )
  );

-- Los precios y estados de pedidos nunca deben ser aceptados directamente
-- desde el navegador. El checkout activo los valida en las rutas del servidor.
revoke all on table public.orders from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.orders from authenticated;
grant select on table public.orders to authenticated;
grant all on table public.orders to service_role;

revoke all on table public.order_items from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.order_items from authenticated;
grant select on table public.order_items to authenticated;
grant all on table public.order_items to service_role;

-- Las postulaciones contienen datos personales y se reciben únicamente por
-- rutas autenticadas, validadas y limitadas del servidor.
drop policy if exists "anon insert author applications"
  on public.author_applications;
drop policy if exists "author_applications_insert_own"
  on public.author_applications;
drop policy if exists "author_applications_select_own_or_admin"
  on public.author_applications;
drop policy if exists "author_applications_update_admin"
  on public.author_applications;
revoke all on table public.author_applications from anon, authenticated;
grant all on table public.author_applications to service_role;

drop policy if exists "anon insert affiliate applications"
  on public.affiliate_applications;
drop policy if exists "affiliate_applications_insert_own"
  on public.affiliate_applications;
drop policy if exists "affiliate_applications_select_own_or_admin"
  on public.affiliate_applications;
drop policy if exists "affiliate_applications_update_admin"
  on public.affiliate_applications;
revoke all on table public.affiliate_applications from anon, authenticated;
grant all on table public.affiliate_applications to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'paypal_orders_currency_format_check'
      and conrelid = 'public.paypal_orders'::regclass
  ) then
    alter table public.paypal_orders
      add constraint paypal_orders_currency_format_check
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'book_purchases_currency_format_check'
      and conrelid = 'public.book_purchases'::regclass
  ) then
    alter table public.book_purchases
      add constraint book_purchases_currency_format_check
      check (currency is null or currency ~ '^[A-Z]{3}$') not valid;
  end if;
end;
$$;

create table if not exists public.api_rate_limits (
  bucket text not null,
  identifier_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, identifier_hash, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_bucket !~ '^[a-z0-9:_-]{1,80}$'
     or p_identifier_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Parámetros de rate limit inválidos';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (
    bucket,
    identifier_hash,
    window_start,
    request_count,
    updated_at
  ) values (
    p_bucket,
    p_identifier_hash,
    v_window_start,
    1,
    v_now
  )
  on conflict (bucket, identifier_hash, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_count;

  allowed := v_count <= p_limit;
  remaining := greatest(0, p_limit - v_count);
  retry_after_seconds := greatest(
    1,
    ceil(
      extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now))
    )::integer
  );

  if random() < 0.01 then
    delete from public.api_rate_limits
    where window_start < v_now - interval '2 days';
  end if;

  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

create table if not exists public.paypal_webhook_events (
  event_id text primary key,
  event_type text,
  resource_id text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed', 'ignored')),
  attempts integer not null default 1 check (attempts > 0),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  verified_at timestamptz,
  processed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.paypal_webhook_events enable row level security;
revoke all on table public.paypal_webhook_events from anon, authenticated;

create or replace function public.claim_paypal_webhook_event(
  p_event_id text,
  p_event_type text,
  p_resource_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_updated_at timestamptz;
begin
  if p_event_id is null or length(p_event_id) < 8 or length(p_event_id) > 80 then
    raise exception 'event_id inválido';
  end if;

  insert into public.paypal_webhook_events (
    event_id,
    event_type,
    resource_id,
    payload,
    verified_at
  ) values (
    p_event_id,
    left(p_event_type, 120),
    left(p_resource_id, 120),
    p_payload,
    now()
  )
  on conflict (event_id) do nothing;

  if found then
    return true;
  end if;

  select status, updated_at into v_status, v_updated_at
  from public.paypal_webhook_events
  where event_id = p_event_id
  for update;

  if v_status in ('completed', 'ignored') then
    update public.paypal_webhook_events
    set attempts = attempts + 1, updated_at = now()
    where event_id = p_event_id;
    return false;
  end if;

  if v_status = 'processing' and v_updated_at > now() - interval '5 minutes' then
    update public.paypal_webhook_events
    set attempts = attempts + 1
    where event_id = p_event_id;
    return false;
  end if;

  update public.paypal_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null,
      updated_at = now()
  where event_id = p_event_id;

  return true;
end;
$$;

revoke all on function public.claim_paypal_webhook_event(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_paypal_webhook_event(text, text, text, jsonb)
  to service_role;

create or replace function public.grant_book_purchase_atomic(
  p_user_id uuid,
  p_book_id uuid,
  p_amount numeric,
  p_currency text,
  p_paypal_order_id text,
  p_paypal_capture_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_id uuid;
  v_now timestamptz := now();
begin
  if p_amount <= 0
     or p_currency !~ '^[A-Z]{3}$'
     or length(p_paypal_order_id) < 8
     or length(p_paypal_capture_id) < 8 then
    raise exception 'Datos de compra inválidos';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_book_id::text, 0)
  );

  select id into v_purchase_id
  from public.book_purchases
  where user_id = p_user_id and book_id = p_book_id
  order by
    (
      revoked_at is null
      and status in ('paid', 'completed', 'approved', 'succeeded')
    ) desc,
    created_at asc,
    id asc
  limit 1
  for update;

  if v_purchase_id is null then
    insert into public.book_purchases (
      user_id,
      book_id,
      status,
      payment_provider,
      payment_reference,
      provider_order_id,
      amount_paid,
      currency,
      paid_at,
      updated_at
    ) values (
      p_user_id,
      p_book_id,
      'paid',
      'paypal',
      p_paypal_capture_id,
      p_paypal_order_id,
      p_amount,
      p_currency,
      v_now,
      v_now
    )
    returning id into v_purchase_id;
  else
    update public.book_purchases
    set status = 'paid',
        payment_provider = 'paypal',
        payment_reference = p_paypal_capture_id,
        provider_order_id = p_paypal_order_id,
        amount_paid = p_amount,
        currency = p_currency,
        paid_at = coalesce(paid_at, v_now),
        revoked_at = null,
        updated_at = v_now
    where id = v_purchase_id;
  end if;

  return v_purchase_id;
end;
$$;

revoke all on function public.grant_book_purchase_atomic(uuid, uuid, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_book_purchase_atomic(uuid, uuid, numeric, text, text, text)
  to service_role;

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at);
create index if not exists paypal_webhook_events_status_idx
  on public.paypal_webhook_events (status, received_at desc);

commit;
