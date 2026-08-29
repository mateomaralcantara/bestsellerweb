begin;

create table if not exists public.reader_annotations (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  id text not null,
  kind text not null,
  section_signature text not null,
  start_offset integer not null,
  end_offset integer not null,
  selected_text text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reader_annotations_primary_key
    primary key (user_id, book_id, id),

  constraint reader_annotations_kind_check
    check (kind in ('highlight', 'underline', 'comment')),

  constraint reader_annotations_id_length_check
    check (char_length(id) between 1 and 128),

  constraint reader_annotations_signature_length_check
    check (char_length(section_signature) between 1 and 160),

  constraint reader_annotations_offsets_check
    check (
      start_offset >= 0
      and end_offset > start_offset
      and end_offset - start_offset <= 1000000
    ),

  constraint reader_annotations_selected_text_check
    check (char_length(selected_text) between 1 and 5000),

  constraint reader_annotations_note_check
    check (char_length(note) <= 3000)
);

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

-- Las anotaciones privadas pasan por la API segura del lector. La API valida
-- sesión y acceso al libro antes de utilizar la clave service_role.
revoke all on table public.reader_annotations from anon, authenticated;
grant all on table public.reader_annotations to service_role;

comment on table public.reader_annotations is
  'Resaltados, subrayados y comentarios privados persistentes por usuario y libro.';

comment on column public.reader_annotations.section_signature is
  'Firma estable del texto de la sección EPUB usada para reanclar anotaciones tras repaginación.';

commit;
