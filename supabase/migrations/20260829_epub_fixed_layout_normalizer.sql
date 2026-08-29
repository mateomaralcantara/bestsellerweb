create table if not exists public.epub_normalizations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  source_asset_id uuid references public.book_assets(id) on delete set null,
  source_sha256 text not null,
  normalized_sha256 text,
  storage_bucket text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending','normalized','skipped','error')),
  mode text not null default 'original' check (mode in ('original','canonical-fixed-image')),
  report jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists epub_normalizations_book_source_uidx
  on public.epub_normalizations(book_id, source_sha256);

create index if not exists epub_normalizations_book_current_idx
  on public.epub_normalizations(book_id, is_current, created_at desc);

alter table public.epub_normalizations enable row level security;

revoke all on table public.epub_normalizations from anon;
revoke all on table public.epub_normalizations from authenticated;

grant all on table public.epub_normalizations to service_role;

notify pgrst, 'reload schema';
