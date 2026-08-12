begin;

create extension if not exists pgcrypto;

alter table if exists public.books
  add column if not exists paypal_price numeric(12, 2),
  add column if not exists paypal_currency text default 'USD';

alter table if exists public.book_editions
  add column if not exists paypal_price numeric(12, 2),
  add column if not exists paypal_currency text default 'USD';

create table if not exists public.paypal_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete restrict,
  paypal_order_id text,
  paypal_capture_id text,
  status text not null default 'creating',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  payer_email text,
  failure_reason text,
  webhook_event_id text,
  raw_create jsonb,
  raw_capture jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists paypal_orders_paypal_order_id_uidx
  on public.paypal_orders(paypal_order_id)
  where paypal_order_id is not null;

create unique index if not exists paypal_orders_capture_id_uidx
  on public.paypal_orders(paypal_capture_id)
  where paypal_capture_id is not null;

create index if not exists paypal_orders_user_id_idx
  on public.paypal_orders(user_id);

create index if not exists paypal_orders_book_id_idx
  on public.paypal_orders(book_id);

create table if not exists public.book_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete restrict,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.book_purchases
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists provider_order_id text,
  add column if not exists amount_paid numeric(12, 2),
  add column if not exists currency text,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists book_purchases_user_book_idx
  on public.book_purchases(user_id, book_id);

create index if not exists book_purchases_payment_reference_idx
  on public.book_purchases(payment_reference);

alter table public.paypal_orders enable row level security;
alter table public.book_purchases enable row level security;

drop policy if exists "Users can view their PayPal orders"
  on public.paypal_orders;

create policy "Users can view their PayPal orders"
  on public.paypal_orders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their book purchases"
  on public.book_purchases;

create policy "Users can view their book purchases"
  on public.book_purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.paypal_orders is
  'Órdenes PayPal verificadas por el servidor.';

comment on column public.books.paypal_price is
  'Precio enviado a PayPal. Se recomienda USD para el lanzamiento.';

comment on column public.books.paypal_currency is
  'Código ISO de moneda utilizado en PayPal.';

commit;
