begin;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;

create table if not exists private.paypal_rate_limits (
  route text not null,
  actor_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (route, actor_hash, window_start)
);

create index if not exists paypal_rate_limits_updated_at_idx
  on private.paypal_rate_limits(updated_at);

revoke all on table private.paypal_rate_limits from public;
revoke all on table private.paypal_rate_limits from anon;
revoke all on table private.paypal_rate_limits from authenticated;
revoke all on table private.paypal_rate_limits from service_role;

create or replace function public.consume_paypal_rate_limit(
  p_route text,
  p_actor_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if p_route not in ('paypal:create-order', 'paypal:capture-order') then
    raise exception 'Unsupported rate-limit route.';
  end if;

  if p_actor_hash is null or length(p_actor_hash) < 32 then
    raise exception 'Invalid actor hash.';
  end if;

  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid rate limit.';
  end if;

  if p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window.';
  end if;

  v_window_start :=
    to_timestamp(
      floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
    );

  insert into private.paypal_rate_limits (
    route,
    actor_hash,
    window_start,
    request_count,
    updated_at
  )
  values (
    p_route,
    p_actor_hash,
    v_window_start,
    1,
    v_now
  )
  on conflict (route, actor_hash, window_start)
  do update
    set request_count =
          private.paypal_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_count;

  v_retry_after :=
    greatest(
      1,
      ceil(
        extract(
          epoch from (
            v_window_start +
            make_interval(secs => p_window_seconds) -
            v_now
          )
        )
      )::integer
    );

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  retry_after := v_retry_after;

  return next;
end;
$$;

revoke execute on function public.consume_paypal_rate_limit(
  text,
  text,
  integer,
  integer
) from public;

revoke execute on function public.consume_paypal_rate_limit(
  text,
  text,
  integer,
  integer
) from anon;

revoke execute on function public.consume_paypal_rate_limit(
  text,
  text,
  integer,
  integer
) from authenticated;

grant execute on function public.consume_paypal_rate_limit(
  text,
  text,
  integer,
  integer
) to service_role;

comment on table private.paypal_rate_limits is
  'Contadores distribuidos para limitar las rutas PayPal. No expuesta al Data API.';

comment on function public.consume_paypal_rate_limit(
  text,
  text,
  integer,
  integer
) is
  'Incrementa atÃ³micamente un lÃ­mite fijo por ruta/actor. Ejecutable solo por service_role.';

commit;
