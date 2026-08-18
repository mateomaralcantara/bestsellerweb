begin;

create extension if not exists pgcrypto;

create table if not exists public.book_interest_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text not null
    check (char_length(anonymous_session_id) between 16 and 120),
  event_type text not null
    check (
      event_type in (
        'book_view',
        'preview_open',
        'add_to_cart',
        'checkout_start'
      )
    ),
  source text not null default 'catalog',
  event_date date not null default
    ((now() at time zone 'America/Santo_Domingo')::date),
  created_at timestamptz not null default now(),
  constraint book_interest_events_daily_unique unique (
    book_id,
    event_type,
    anonymous_session_id,
    event_date
  )
);

create index if not exists book_interest_events_created_idx
  on public.book_interest_events(created_at desc);

create index if not exists book_interest_events_book_created_idx
  on public.book_interest_events(book_id, created_at desc);

create index if not exists book_interest_events_type_date_idx
  on public.book_interest_events(event_type, event_date desc);

alter table public.book_interest_events enable row level security;

revoke all on table public.book_interest_events from anon, authenticated;

comment on table public.book_interest_events is
  'Señales agregadas de interés del catálogo. No almacena correos, nombres ni direcciones IP.';

comment on column public.book_interest_events.anonymous_session_id is
  'Identificador aleatorio del navegador utilizado solo para evitar duplicados diarios.';

create table if not exists public.ceo_seo_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  status text not null default 'completed'
    check (status in ('completed', 'demo', 'failed')),
  source_mode text not null default 'demo',
  model text,
  focus_book_id uuid references public.books(id) on delete set null,
  summary text not null default '',
  analysis jsonb not null default '{}'::jsonb,
  growth_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ceo_seo_daily_reports_generated_idx
  on public.ceo_seo_daily_reports(generated_at desc);

create or replace function public.set_ceo_seo_daily_reports_updated_at()
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

drop trigger if exists set_ceo_seo_daily_reports_updated_at
  on public.ceo_seo_daily_reports;

create trigger set_ceo_seo_daily_reports_updated_at
before update on public.ceo_seo_daily_reports
for each row
execute function public.set_ceo_seo_daily_reports_updated_at();

alter table public.ceo_seo_daily_reports enable row level security;

revoke all on table public.ceo_seo_daily_reports from anon, authenticated;

comment on table public.ceo_seo_daily_reports is
  'Reportes internos diarios del Agente CEO/SEO. Solo el servidor con service_role puede acceder.';

comment on column public.ceo_seo_daily_reports.analysis is
  'Incluye borradores de contenido y grupo de enfoque sintético; nunca reseñas reales.';

commit;
