begin;

create extension if not exists pgcrypto;

create table if not exists public.book_reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  current_page integer not null default 1 check (current_page >= 1),
  total_pages integer not null default 1 check (total_pages >= 1),
  progress_percent numeric(5, 2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  location_type text not null default 'pdf_page',
  current_location text,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_reading_progress_user_book_unique
    unique (user_id, book_id)
);

create index if not exists book_reading_progress_user_updated_idx
  on public.book_reading_progress(user_id, updated_at desc);

create index if not exists book_reading_progress_book_idx
  on public.book_reading_progress(book_id);

create or replace function public.set_book_reading_progress_updated_at()
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

drop trigger if exists set_book_reading_progress_updated_at
  on public.book_reading_progress;

create trigger set_book_reading_progress_updated_at
before update on public.book_reading_progress
for each row
execute function public.set_book_reading_progress_updated_at();

alter table public.book_reading_progress enable row level security;

drop policy if exists "Users can read their own book progress"
  on public.book_reading_progress;

create policy "Users can read their own book progress"
  on public.book_reading_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own book progress"
  on public.book_reading_progress;

create policy "Users can insert their own book progress"
  on public.book_reading_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own book progress"
  on public.book_reading_progress;

create policy "Users can update their own book progress"
  on public.book_reading_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.book_reading_progress to authenticated;

comment on table public.book_reading_progress is
  'Última página leída por cada usuario y libro para continuar automáticamente.';

comment on column public.book_reading_progress.current_location is
  'Localizador extensible. Para PDF utiliza el formato page:N.';

commit;
