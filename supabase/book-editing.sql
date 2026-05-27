alter table public.books
add column if not exists subtitle text,
add column if not exists publisher_name text,
add column if not exists primary_niche text,
add column if not exists primary_category text,
add column if not exists secondary_category text,
add column if not exists keywords text[] default '{}',
add column if not exists target_audience text,
add column if not exists reader_promise text,
add column if not exists sales_hook text,
add column if not exists comparable_books text,
add column if not exists meta_title text,
add column if not exists meta_description text,
add column if not exists marketing_angle text,
add column if not exists language_code text default 'es',
add column if not exists updated_at timestamptz default now();

alter table public.book_editions
add column if not exists compare_at_price numeric(10, 2),
add column if not exists page_count integer,
add column if not exists isbn text,
add column if not exists affiliate_enabled boolean default false,
add column if not exists affiliate_commission_percentage numeric(5, 2),
add column if not exists download_allowed boolean default false,
add column if not exists updated_at timestamptz default now();

alter table public.book_editions
alter column file_url drop not null;

create table if not exists public.book_revisions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  edition_id uuid null references public.book_editions(id) on delete set null,
  changed_by_user_id uuid null references auth.users(id) on delete set null,

  revision_type text not null default 'minor_update',
  change_note text null,

  storage_bucket text null,
  storage_path text null,
  file_name text null,
  mime_type text null,

  created_at timestamptz not null default now(),

  constraint book_revisions_revision_type_check check (
    revision_type in ('minor_update', 'major_update', 'metadata_update', 'cover_update')
  )
);

create index if not exists book_revisions_book_id_idx
on public.book_revisions(book_id);

create index if not exists book_revisions_created_at_idx
on public.book_revisions(created_at);