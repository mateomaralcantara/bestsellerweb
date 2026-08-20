begin;

create extension if not exists pgcrypto;

create table if not exists public.book_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  comment_text text not null,
  status text not null default 'published',
  is_verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint book_comments_rating_check
    check (rating between 1 and 5),

  constraint book_comments_text_length_check
    check (char_length(btrim(comment_text)) between 10 and 1500),

  constraint book_comments_status_check
    check (status in ('published', 'pending', 'hidden', 'rejected')),

  constraint book_comments_user_book_unique
    unique (book_id, user_id)
);

create index if not exists book_comments_book_status_created_idx
  on public.book_comments(book_id, status, created_at desc);

create index if not exists book_comments_user_id_idx
  on public.book_comments(user_id);

create or replace function public.touch_book_comments_updated_at()
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

drop trigger if exists book_comments_touch_updated_at
  on public.book_comments;

create trigger book_comments_touch_updated_at
before update on public.book_comments
for each row
execute function public.touch_book_comments_updated_at();

alter table public.book_comments enable row level security;

-- Toda lectura y escritura pública pasa por la API protegida de Next.js.
-- La clave pública del navegador no tiene acceso directo a esta tabla.
revoke all on table public.book_comments from anon, authenticated;
grant all on table public.book_comments to service_role;

comment on table public.book_comments is
  'Reseñas públicas de libros, gestionadas exclusivamente por la API segura.';

comment on column public.book_comments.is_verified_purchase is
  'Se calcula en el servidor utilizando una compra activa del usuario.';

commit;
