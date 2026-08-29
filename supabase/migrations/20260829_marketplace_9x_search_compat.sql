begin;

create extension if not exists pg_trgm;

-- ============================================================
-- LibroSeller Marketplace 9.x - Search/RPC compatibility repair
--
-- Motivo:
-- Algunas instalaciones históricas de `books.keywords` no garantizan
-- exactamente el mismo tipo PostgreSQL. El motor inicial usaba
-- array_to_string(b.keywords, ' '), que solo es válido para arrays.
-- Esta reparación convierte keywords a su representación textual,
-- válida para text[], json/jsonb o text, sin modificar datos.
-- ============================================================

drop function if exists public.search_marketplace_books(text,text,integer,integer);

create function public.search_marketplace_books(
  p_query text,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  book_id uuid,
  slug text,
  title text,
  subtitle text,
  cover_url text,
  primary_category text,
  primary_niche text,
  verified_rating numeric,
  verified_sales_count bigint,
  bestseller_score numeric,
  relevance numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with query_parts as (
    select
      nullif(trim(coalesce(p_query, '')), '') as raw_q,
      case
        when nullif(trim(coalesce(p_query, '')), '') is null then null::tsquery
        else websearch_to_tsquery('simple', trim(p_query))
      end as tsq
  ),
  candidates as (
    select
      b.id,
      b.slug::text as slug,
      b.title::text as title,
      b.subtitle::text as subtitle,
      b.cover_url::text as cover_url,
      b.primary_category::text as primary_category,
      b.primary_niche::text as primary_niche,
      coalesce(vm.verified_rating, 0)::numeric as verified_rating,
      coalesce(vm.verified_sales_count, 0)::bigint as verified_sales_count,
      coalesce(bs.bestseller_score, 0)::numeric as bestseller_score,
      (
        setweight(to_tsvector('simple', coalesce(b.title::text, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(b.subtitle::text, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(b.keywords::text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(b.primary_category::text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(b.primary_niche::text, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(b.description_short::text, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(b.description_long::text, '')), 'D')
      ) as document,
      qp.raw_q,
      qp.tsq
    from public.books b
    cross join query_parts qp
    left join public.book_verified_metrics vm on vm.book_id = b.id
    left join public.book_bestseller_scores bs on bs.book_id = b.id
    where lower(coalesce(b.status::text, '')) = 'published'
      and (
        p_category is null
        or trim(p_category) = ''
        or lower(coalesce(b.primary_category::text, '')) = lower(trim(p_category))
        or lower(coalesce(b.primary_niche::text, '')) = lower(trim(p_category))
        or lower(coalesce(b.secondary_category::text, '')) = lower(trim(p_category))
      )
  ),
  scored as (
    select
      c.*,
      case
        when c.raw_q is null then c.bestseller_score
        else round((
            coalesce(ts_rank_cd(c.document, c.tsq, 32), 0) * 100
          + similarity(lower(coalesce(c.title, '')), lower(c.raw_q)) * 40
          + similarity(lower(coalesce(c.subtitle, '')), lower(c.raw_q)) * 15
          + least(c.bestseller_score, 100) * 0.05
        )::numeric, 4)
      end as computed_relevance
    from candidates c
  )
  select
    s.id::uuid as book_id,
    s.slug,
    s.title,
    s.subtitle,
    s.cover_url,
    s.primary_category,
    s.primary_niche,
    s.verified_rating,
    s.verified_sales_count,
    s.bestseller_score,
    s.computed_relevance as relevance
  from scored s
  where
    s.raw_q is null
    or s.document @@ s.tsq
    or similarity(lower(coalesce(s.title, '')), lower(s.raw_q)) > 0.15
    or similarity(lower(coalesce(s.subtitle, '')), lower(s.raw_q)) > 0.15
  order by s.computed_relevance desc, s.title asc
  limit greatest(1, least(coalesce(p_limit, 24), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Reparamos también recomendaciones porque se crea después de Search 2.0
-- en la migración principal y puede faltar si esa ejecución se detuvo.
drop function if exists public.recommend_marketplace_books(uuid,integer);

create function public.recommend_marketplace_books(
  p_user_id uuid,
  p_limit integer default 12
)
returns table (
  book_id uuid,
  slug text,
  title text,
  cover_url text,
  reason text,
  score numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with purchased as (
    select distinct
      b.primary_category::text as primary_category,
      b.primary_niche::text as primary_niche
    from public.book_purchases bp
    join public.books b on b.id = bp.book_id
    where bp.user_id = p_user_id
      and lower(coalesce(bp.status::text, '')) in ('paid','completed','approved','succeeded')
  ),
  already_owned as (
    select distinct bp.book_id
    from public.book_purchases bp
    where bp.user_id = p_user_id
      and lower(coalesce(bp.status::text, '')) in ('paid','completed','approved','succeeded')
  )
  select
    b.id::uuid as book_id,
    b.slug::text as slug,
    b.title::text as title,
    b.cover_url::text as cover_url,
    case
      when exists (
        select 1
        from purchased p
        where nullif(p.primary_category, '') is not null
          and lower(p.primary_category) = lower(coalesce(b.primary_category::text, ''))
      ) then 'Porque lees esta categoría'
      when exists (
        select 1
        from purchased p
        where nullif(p.primary_niche, '') is not null
          and lower(p.primary_niche) = lower(coalesce(b.primary_niche::text, ''))
      ) then 'Relacionado con tus lecturas'
      else 'Tendencia en LibroSeller'
    end::text as reason,
    round((
        coalesce(bs.bestseller_score, 0)::numeric * 0.55
      + coalesce(vm.verified_rating, 0)::numeric * 5 * 0.15
      + case when exists (
          select 1
          from purchased p
          where lower(coalesce(p.primary_category, '')) = lower(coalesce(b.primary_category::text, ''))
        ) then 20 else 0 end
      + case when exists (
          select 1
          from purchased p
          where lower(coalesce(p.primary_niche, '')) = lower(coalesce(b.primary_niche::text, ''))
        ) then 10 else 0 end
    )::numeric, 4) as score
  from public.books b
  left join public.book_bestseller_scores bs on bs.book_id = b.id
  left join public.book_verified_metrics vm on vm.book_id = b.id
  where lower(coalesce(b.status::text, '')) = 'published'
    and not exists (
      select 1 from already_owned ao where ao.book_id = b.id
    )
  order by score desc, b.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

grant execute on function public.search_marketplace_books(text,text,integer,integer)
  to anon, authenticated, service_role;

grant execute on function public.recommend_marketplace_books(uuid,integer)
  to authenticated, service_role;

comment on function public.search_marketplace_books(text,text,integer,integer) is
  'LibroSeller Search 2.0 compatible con keywords text, text[], json o jsonb; FTS + trigram + señales verificadas.';

comment on function public.recommend_marketplace_books(uuid,integer) is
  'Recomendaciones V1 explicables basadas en compras/categorías y señales verificadas.';

-- Solicita a PostgREST refrescar el catálogo de funciones tras el commit.
notify pgrst, 'reload schema';

commit;
