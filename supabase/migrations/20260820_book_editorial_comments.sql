begin;

create extension if not exists pgcrypto;

create table if not exists public.book_editorial_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  display_order smallint not null,
  comment_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint book_editorial_comments_order_check
    check (display_order between 1 and 5),

  constraint book_editorial_comments_text_check
    check (char_length(btrim(comment_text)) between 20 and 1000),

  constraint book_editorial_comments_book_order_unique
    unique (book_id, display_order)
);

create index if not exists book_editorial_comments_book_order_idx
  on public.book_editorial_comments(book_id, display_order);

create or replace function public.seed_book_editorial_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.book_editorial_comments (
    book_id,
    display_order,
    comment_text,
    updated_at
  )
  values
    (
      new.id,
      1,
      format(
        'La propuesta editorial de «%s» invita a descubrir sus ideas centrales y profundizar en una temática con potencial para conectar con distintos lectores.',
        new.title
      ),
      now()
    ),
    (
      new.id,
      2,
      format(
        'La presentación de «%s» despierta curiosidad y ofrece un punto de partida atractivo para quienes desean conocer mejor el tema que desarrolla.',
        new.title
      ),
      now()
    ),
    (
      new.id,
      3,
      format(
        '«%s» es una propuesta pensada para lectores interesados en explorar nuevas ideas mediante una lectura clara, reflexiva y accesible.',
        new.title
      ),
      now()
    ),
    (
      new.id,
      4,
      format(
        'El enfoque editorial de «%s» tiene potencial para generar conversación, reflexión y nuevas perspectivas alrededor de su temática principal.',
        new.title
      ),
      now()
    ),
    (
      new.id,
      5,
      format(
        '«%s» se dirige a quienes buscan contenido interesante, bien enfocado y capaz de acompañarlos en el descubrimiento de nuevas perspectivas.',
        new.title
      ),
      now()
    )
  on conflict (book_id, display_order)
  do update set
    comment_text = excluded.comment_text,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists seed_book_editorial_comments_after_write
  on public.books;

create trigger seed_book_editorial_comments_after_write
after insert or update of title on public.books
for each row
execute function public.seed_book_editorial_comments();

-- Agrega los cinco comentarios editoriales a todos los libros existentes.
insert into public.book_editorial_comments (
  book_id,
  display_order,
  comment_text,
  updated_at
)
select
  book.id,
  template.display_order,
  case template.display_order
    when 1 then format(
      'La propuesta editorial de «%s» invita a descubrir sus ideas centrales y profundizar en una temática con potencial para conectar con distintos lectores.',
      book.title
    )
    when 2 then format(
      'La presentación de «%s» despierta curiosidad y ofrece un punto de partida atractivo para quienes desean conocer mejor el tema que desarrolla.',
      book.title
    )
    when 3 then format(
      '«%s» es una propuesta pensada para lectores interesados en explorar nuevas ideas mediante una lectura clara, reflexiva y accesible.',
      book.title
    )
    when 4 then format(
      'El enfoque editorial de «%s» tiene potencial para generar conversación, reflexión y nuevas perspectivas alrededor de su temática principal.',
      book.title
    )
    else format(
      '«%s» se dirige a quienes buscan contenido interesante, bien enfocado y capaz de acompañarlos en el descubrimiento de nuevas perspectivas.',
      book.title
    )
  end,
  now()
from public.books as book
cross join (
  values (1), (2), (3), (4), (5)
) as template(display_order)
on conflict (book_id, display_order)
do update set
  comment_text = excluded.comment_text,
  updated_at = excluded.updated_at;

alter table public.book_editorial_comments enable row level security;

revoke all on table public.book_editorial_comments from anon, authenticated;
grant all on table public.book_editorial_comments to service_role;

comment on table public.book_editorial_comments is
  'Textos editoriales automáticos claramente separados de las reseñas reales.';

comment on column public.book_editorial_comments.comment_text is
  'No representa la experiencia ni la opinión de un comprador.';

commit;
