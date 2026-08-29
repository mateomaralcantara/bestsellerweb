begin;

-- Compatibilidad para instalaciones donde public.reader_annotations ya existía
-- antes del esquema persistente actual del lector EPUB. CREATE TABLE IF NOT EXISTS
-- no agrega columnas a una tabla preexistente, por lo que esta migración añade
-- únicamente lo que falte y conserva los datos existentes.

create table if not exists public.reader_annotations (
  user_id uuid references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  id text,
  kind text,
  section_signature text,
  start_offset integer,
  end_offset integer,
  selected_text text,
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reader_annotations
  add column if not exists user_id uuid,
  add column if not exists book_id uuid,
  add column if not exists id text,
  add column if not exists kind text,
  add column if not exists section_signature text,
  add column if not exists start_offset integer,
  add column if not exists end_offset integer,
  add column if not exists selected_text text,
  add column if not exists note text default '',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Defaults seguros para las escrituras nuevas. Las filas heredadas se conservan.
alter table public.reader_annotations
  alter column note set default '',
  alter column created_at set default now(),
  alter column updated_at set default now();

-- IMPORTANTE: instalaciones antiguas pueden tener id como uuid. Se convierte a
-- texto únicamente para construir la firma legacy y evitar que PostgreSQL intente
-- convertir '' a uuid dentro de COALESCE.
update public.reader_annotations
set
  kind = coalesce(nullif(kind::text, ''), 'highlight'),
  section_signature = coalesce(
    nullif(section_signature, ''),
    'legacy:' || md5(
      coalesce(user_id::text, '') || ':' ||
      coalesce(book_id::text, '') || ':' ||
      coalesce(id::text, '') || ':' ||
      coalesce(created_at::text, '')
    )
  ),
  start_offset = greatest(coalesce(start_offset, 0), 0),
  end_offset = greatest(coalesce(end_offset, 1), greatest(coalesce(start_offset, 0), 0) + 1),
  selected_text = coalesce(nullif(selected_text, ''), '[anotación heredada]'),
  note = coalesce(note, ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

-- El API usa upsert(..., { onConflict: "user_id,book_id,id" }).
-- Un índice UNIQUE sobre esas tres columnas permite inferir correctamente
-- ese conflicto sin eliminar filas heredadas con claves nulas.
create unique index if not exists reader_annotations_user_book_id_uidx
  on public.reader_annotations(user_id, book_id, id);

create index if not exists reader_annotations_user_book_created_idx
  on public.reader_annotations(user_id, book_id, created_at desc);

create index if not exists reader_annotations_book_idx
  on public.reader_annotations(book_id);

create or replace function public.touch_reader_annotations_updated_at()
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

drop trigger if exists reader_annotations_touch_updated_at
  on public.reader_annotations;

create trigger reader_annotations_touch_updated_at
before update on public.reader_annotations
for each row
execute function public.touch_reader_annotations_updated_at();

alter table public.reader_annotations enable row level security;

revoke all on table public.reader_annotations from anon, authenticated;
grant all on table public.reader_annotations to service_role;

comment on table public.reader_annotations is
  'Resaltados, subrayados y comentarios privados persistentes por usuario y libro.';

comment on column public.reader_annotations.section_signature is
  'Firma estable del texto de la sección EPUB usada para reanclar anotaciones tras repaginación.';

commit;
