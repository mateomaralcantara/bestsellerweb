begin;

create extension if not exists pgcrypto;

-- ============================================================
-- TAXONOMÍA NORMALIZADA DE LIBROS
-- Nicho -> Categoría -> Libro
-- Mantiene compatibilidad con books.primary_niche,
-- books.primary_category y books.secondary_category.
-- ============================================================

create table if not exists public.book_niches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  name_key text generated always as (lower(btrim(name))) stored,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name_key)
);

create table if not exists public.book_categories (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references public.book_niches(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  name_key text generated always as (lower(btrim(name))) stored,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (niche_id, name_key)
);

create table if not exists public.book_category_assignments (
  book_id uuid not null references public.books(id) on delete cascade,
  category_id uuid not null references public.book_categories(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (book_id, category_id)
);

create index if not exists book_categories_niche_idx
  on public.book_categories(niche_id, sort_order, name);

create index if not exists book_category_assignments_category_idx
  on public.book_category_assignments(category_id, book_id);

create unique index if not exists book_category_assignments_one_primary_idx
  on public.book_category_assignments(book_id)
  where is_primary;

-- ============================================================
-- SINCRONIZACIÓN AUTOMÁTICA DESDE LAS COLUMNAS LEGACY
-- ============================================================

create or replace function public.sync_book_category_taxonomy(
  p_book_id uuid,
  p_niche text,
  p_primary_category text,
  p_secondary_category text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_niche_id uuid;
  v_primary_id uuid;
  v_secondary_id uuid;
  v_niche text := nullif(btrim(coalesce(p_niche, '')), '');
  v_primary text := nullif(btrim(coalesce(p_primary_category, '')), '');
  v_secondary text := nullif(btrim(coalesce(p_secondary_category, '')), '');
begin
  if p_book_id is null then
    return;
  end if;

  delete from public.book_category_assignments
   where book_id = p_book_id;

  if v_niche is null or v_primary is null then
    return;
  end if;

  insert into public.book_niches(name, updated_at)
  values (v_niche, now())
  on conflict (name_key)
  do update set
    name = excluded.name,
    is_active = true,
    updated_at = now()
  returning id into v_niche_id;

  insert into public.book_categories(niche_id, name, updated_at)
  values (v_niche_id, v_primary, now())
  on conflict (niche_id, name_key)
  do update set
    name = excluded.name,
    is_active = true,
    updated_at = now()
  returning id into v_primary_id;

  insert into public.book_category_assignments(book_id, category_id, is_primary)
  values (p_book_id, v_primary_id, true)
  on conflict (book_id, category_id)
  do update set is_primary = true;

  if v_secondary is not null and lower(v_secondary) <> lower(v_primary) then
    insert into public.book_categories(niche_id, name, updated_at)
    values (v_niche_id, v_secondary, now())
    on conflict (niche_id, name_key)
    do update set
      name = excluded.name,
      is_active = true,
      updated_at = now()
    returning id into v_secondary_id;

    insert into public.book_category_assignments(book_id, category_id, is_primary)
    values (p_book_id, v_secondary_id, false)
    on conflict (book_id, category_id)
    do update set is_primary = false;
  end if;
end;
$$;

create or replace function public.sync_book_category_taxonomy_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_book_category_taxonomy(
    new.id,
    new.primary_niche,
    new.primary_category,
    new.secondary_category
  );
  return new;
end;
$$;

drop trigger if exists books_sync_category_taxonomy on public.books;
create trigger books_sync_category_taxonomy
after insert or update of primary_niche, primary_category, secondary_category
on public.books
for each row execute function public.sync_book_category_taxonomy_trigger();

-- Backfill de los libros ya existentes sin modificar sus datos.
do $$
declare
  r record;
begin
  for r in
    select id, primary_niche, primary_category, secondary_category
      from public.books
     where nullif(btrim(coalesce(primary_niche, '')), '') is not null
       and nullif(btrim(coalesce(primary_category, '')), '') is not null
  loop
    perform public.sync_book_category_taxonomy(
      r.id,
      r.primary_niche,
      r.primary_category,
      r.secondary_category
    );
  end loop;
end;
$$;

-- ============================================================
-- RLS: lectura pública; escritura controlada por backend/service role
-- ============================================================

alter table public.book_niches enable row level security;
alter table public.book_categories enable row level security;
alter table public.book_category_assignments enable row level security;

drop policy if exists book_niches_public_read on public.book_niches;
create policy book_niches_public_read
on public.book_niches
for select
using (is_active = true);

drop policy if exists book_categories_public_read on public.book_categories;
create policy book_categories_public_read
on public.book_categories
for select
using (is_active = true);

drop policy if exists book_category_assignments_public_read on public.book_category_assignments;
create policy book_category_assignments_public_read
on public.book_category_assignments
for select
using (true);

grant select on public.book_niches to anon, authenticated;
grant select on public.book_categories to anon, authenticated;
grant select on public.book_category_assignments to anon, authenticated;

grant execute on function public.sync_book_category_taxonomy(uuid, text, text, text) to service_role;

commit;
