create extension if not exists pgcrypto;

create table if not exists public.book_purchases (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,

  -- Lo dejo como text para evitar choque si tu orders.id no es uuid.
  order_id text null,

  status text not null default 'paid',
  payment_provider text null,
  payment_reference text null,

  paid_at timestamptz null default now(),
  revoked_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint book_purchases_status_check check (
    status in ('paid', 'completed', 'approved', 'succeeded', 'refunded', 'revoked', 'cancelled')
  ),

  constraint book_purchases_user_book_unique unique (user_id, book_id)
);

create index if not exists book_purchases_user_id_idx
on public.book_purchases(user_id);

create index if not exists book_purchases_book_id_idx
on public.book_purchases(book_id);

create index if not exists book_purchases_status_idx
on public.book_purchases(status);

alter table public.book_purchases enable row level security;

drop policy if exists "Users can read their own book purchases"
on public.book_purchases;

create policy "Users can read their own book purchases"
on public.book_purchases
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Service role can manage book purchases"
on public.book_purchases;

create policy "Service role can manage book purchases"
on public.book_purchases
for all
to service_role
using (true)
with check (true);

create or replace function public.set_book_purchases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_book_purchases_updated_at
on public.book_purchases;

create trigger set_book_purchases_updated_at
before update on public.book_purchases
for each row
execute function public.set_book_purchases_updated_at();