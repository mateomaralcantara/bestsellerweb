-- LibroSeller Editorial Engine · Fixed Layout Normalizer v2
-- Idempotente y no destructivo: conserva originales y reportes históricos.

-- Si una instalación histórica dejó más de un registro current por libro,
-- conserva como current únicamente el más reciente.
with ranked as (
  select
    id,
    row_number() over (
      partition by book_id
      order by updated_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.epub_normalizations
  where is_current = true
)
update public.epub_normalizations n
set is_current = false,
    updated_at = now()
from ranked r
where n.id = r.id
  and r.rn > 1;

create unique index if not exists epub_normalizations_one_current_per_book_uidx
  on public.epub_normalizations(book_id)
  where is_current = true;

create index if not exists epub_normalizations_status_current_idx
  on public.epub_normalizations(status, is_current, updated_at desc);

create or replace view public.epub_normalization_fleet as
select
  b.id as book_id,
  b.slug,
  b.title,
  b.status as book_status,
  a.id as source_asset_id,
  a.storage_path as source_storage_path,
  n.id as normalization_id,
  n.status as normalization_status,
  n.mode as normalization_mode,
  n.source_sha256,
  n.normalized_sha256,
  n.storage_path as optimized_storage_path,
  n.report,
  n.updated_at as normalized_at
from public.books b
join public.book_assets a
  on a.book_id = b.id
 and a.asset_type = 'epub'
left join public.epub_normalizations n
  on n.book_id = b.id
 and n.is_current = true;

revoke all on public.epub_normalization_fleet from anon;
revoke all on public.epub_normalization_fleet from authenticated;
grant select on public.epub_normalization_fleet to service_role;

notify pgrst, 'reload schema';
