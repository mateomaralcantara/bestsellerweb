create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-previews',
  'book-previews',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.book_preview_pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  page_index integer not null,
  source_page_number integer,
  kind text not null default 'pdf_page',
  image_path text not null,
  width integer,
  height integer,
  created_at timestamptz not null default now(),

  constraint book_preview_pages_kind_check
    check (kind in ('cover', 'pdf_page')),

  constraint book_preview_pages_page_index_check
    check (page_index >= 0),

  constraint book_preview_pages_unique
    unique (book_id, page_index)
);

create index if not exists idx_book_preview_pages_book_id
on public.book_preview_pages(book_id);

create index if not exists idx_book_preview_pages_order
on public.book_preview_pages(book_id, page_index);

alter table public.books
add column if not exists preview_status text default 'pending',
add column if not exists preview_page_count integer default 17,
add column if not exists preview_mode text default 'first_pages',
add column if not exists preview_generated_at timestamptz,
add column if not exists preview_error text;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read book previews'
  ) then
    create policy "Public can read book previews"
    on storage.objects
    for select
    using (bucket_id = 'book-previews');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service role can manage book previews'
  ) then
    create policy "Service role can manage book previews"
    on storage.objects
    for all
    to service_role
    using (bucket_id = 'book-previews')
    with check (bucket_id = 'book-previews');
  end if;
end $$;
