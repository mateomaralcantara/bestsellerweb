begin;

create extension if not exists pgcrypto;

create table if not exists public.preview_reader_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_token uuid not null default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  whatsapp text,
  email_opt_in boolean not null default true,
  whatsapp_opt_in boolean not null default false,
  status text not null default 'active',
  source text not null default 'preview_gate',
  first_book_id uuid references public.books(id) on delete set null,
  last_book_id uuid references public.books(id) on delete set null,
  primary_niche text,
  primary_category text,
  secondary_category text,
  preferences text[] not null default '{}'::text[],
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint preview_reader_subscriptions_token_uidx unique (subscriber_token),
  constraint preview_reader_subscriptions_email_uidx unique (email_normalized),
  constraint preview_reader_subscriptions_status_check
    check (status in ('active', 'unsubscribed', 'suppressed')),
  constraint preview_reader_subscriptions_email_length_check
    check (char_length(email) between 3 and 320),
  constraint preview_reader_subscriptions_whatsapp_length_check
    check (whatsapp is null or char_length(whatsapp) between 7 and 32)
);

create index if not exists preview_reader_subscriptions_last_seen_idx
  on public.preview_reader_subscriptions(last_seen_at desc);

create index if not exists preview_reader_subscriptions_category_idx
  on public.preview_reader_subscriptions(primary_category, primary_niche)
  where status = 'active';

create index if not exists preview_reader_subscriptions_preferences_gin_idx
  on public.preview_reader_subscriptions using gin(preferences);

create table if not exists public.preview_reader_subscription_interests (
  subscriber_id uuid not null references public.preview_reader_subscriptions(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  primary_niche text,
  primary_category text,
  secondary_category text,
  matched_preferences text[] not null default '{}'::text[],
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  qualified_preview_count integer not null default 1 check (qualified_preview_count > 0),

  constraint preview_reader_subscription_interests_pk
    primary key (subscriber_id, book_id)
);

create index if not exists preview_reader_subscription_interests_book_idx
  on public.preview_reader_subscription_interests(book_id, last_seen_at desc);

create index if not exists preview_reader_subscription_interests_category_idx
  on public.preview_reader_subscription_interests(primary_category, primary_niche);

create or replace function public.touch_preview_reader_subscription_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists preview_reader_subscriptions_touch_updated_at
  on public.preview_reader_subscriptions;

create trigger preview_reader_subscriptions_touch_updated_at
before update on public.preview_reader_subscriptions
for each row
execute function public.touch_preview_reader_subscription_updated_at();

alter table public.preview_reader_subscriptions enable row level security;
alter table public.preview_reader_subscription_interests enable row level security;

-- Los datos de marketing contienen PII y solo se escriben/leen mediante API de servidor.
revoke all on table public.preview_reader_subscriptions from anon, authenticated;
revoke all on table public.preview_reader_subscription_interests from anon, authenticated;
grant all on table public.preview_reader_subscriptions to service_role;
grant all on table public.preview_reader_subscription_interests to service_role;

comment on table public.preview_reader_subscriptions is
  'Leads cualificados que entregan su correo al superar cinco páginas de un preview.';

comment on column public.preview_reader_subscriptions.preferences is
  'Taxonomía acumulada de nichos, categorías y palabras clave para futuras notificaciones editoriales.';

comment on table public.preview_reader_subscription_interests is
  'Historial de libros que cada suscriptor exploró suficientemente como para inferir preferencia.';

commit;