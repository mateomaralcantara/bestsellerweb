begin;

-- El índice de una sola versión actual se valida antes del AFTER trigger.
-- Convertimos el trigger a BEFORE para cerrar la versión anterior antes de insertar.
drop trigger if exists book_editorial_versions_current on public.book_editorial_versions;
create trigger book_editorial_versions_current
before insert or update of is_current
on public.book_editorial_versions
for each row execute function public.set_book_editorial_version_current();

-- Las reseñas públicas se exponen por una vista sin user_id/purchase_id.
create or replace view public.book_reviews_public
with (security_barrier = true)
as
select
  id,
  book_id,
  rating,
  title,
  review,
  verified_purchase,
  helpful_count,
  created_at
from public.book_reviews
where status = 'published';

revoke all on table public.book_reviews from anon, authenticated;
grant all on table public.book_reviews to service_role;
grant select on public.book_reviews_public to anon, authenticated, service_role;

-- Las escrituras pasan exclusivamente por las APIs server-side de LibroSeller.
drop policy if exists "Public can read published book reviews" on public.book_reviews;
drop policy if exists "Users can manage own reviews" on public.book_reviews;

comment on view public.book_reviews_public is
  'Proyección pública de reseñas sin identificadores internos de usuario ni compra.';

commit;
