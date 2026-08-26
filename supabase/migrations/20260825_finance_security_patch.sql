-- ============================================================
-- LIBROSELLER - FINANCE SECURITY PATCH
-- Objetivos:
-- 1) Impedir autoaprobacion de afiliados.
-- 2) Proteger status y tasas de comision contra cambios del usuario.
-- 3) Mantener finance_enable_affiliate compatible, pero solo para
--    perfiles previamente aprobados por el flujo administrativo.
-- 4) Documentar el motor financiero nuevo como fuente canonica.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- A. PROTECCION DE CAMPOS FINANCIEROS DEL PERFIL DE AFILIADO
-- ------------------------------------------------------------

create or replace function public.finance_guard_affiliate_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_privileged boolean := false;
begin
  v_is_privileged :=
    current_user in ('postgres', 'supabase_admin', 'service_role')
    or auth.role() = 'service_role'
    or coalesce(public.is_admin(v_uid), false);

  if v_is_privileged then
    return new;
  end if;

  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from v_uid then
      raise exception 'AFFILIATE_PROFILE_FORBIDDEN';
    end if;

    -- Un usuario puede crear su perfil, pero nunca aprobarse ni
    -- decidir su tasa de comision.
    if new.status::text <> 'pending'
       or new.approved_at is not null then
      raise exception 'AFFILIATE_APPROVAL_ADMIN_REQUIRED';
    end if;

    new.commission_rate := 10.00;
    new.commission_rate_override := null;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'AFFILIATE_PROFILE_ID_IMMUTABLE';
    end if;

    if new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.commission_rate is distinct from old.commission_rate
       or new.commission_rate_override is distinct from old.commission_rate_override then
      raise exception 'AFFILIATE_FINANCIAL_FIELDS_ADMIN_ONLY';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finance_guard_affiliate_profile
on public.affiliate_profiles;

create trigger trg_finance_guard_affiliate_profile
before insert or update
on public.affiliate_profiles
for each row
execute function public.finance_guard_affiliate_profile();

-- ------------------------------------------------------------
-- B. finance_enable_affiliate YA NO APRUEBA NI CAMBIA COMISIONES
-- ------------------------------------------------------------

create or replace function public.finance_enable_affiliate(
  p_code text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_status text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    referral_code,
    status::text
  into
    v_code,
    v_status
  from public.affiliate_profiles
  where id = v_user;

  if not found then
    raise exception 'AFFILIATE_APPLICATION_REQUIRED';
  end if;

  if v_status <> 'approved' then
    raise exception 'AFFILIATE_NOT_APPROVED';
  end if;

  -- p_code se conserva en la firma solo por compatibilidad.
  -- Un afiliado aprobado no puede reescribir su codigo desde este RPC.
  return v_code;
end;
$$;

revoke all
on function public.finance_enable_affiliate(text)
from public;

grant execute
on function public.finance_enable_affiliate(text)
to authenticated;

-- ------------------------------------------------------------
-- C. DOCUMENTAR FUENTE CANONICA DE RETIROS
-- ------------------------------------------------------------

comment on table public.financial_ledger is
'LIBROSELLER CANONICAL ACCOUNTING LEDGER. Fuente de verdad para movimientos financieros del motor nuevo.';

comment on table public.financial_payouts is
'LIBROSELLER CANONICAL PAYOUT WORKFLOW para el motor financiero nuevo, enlazado con financial_ledger.';

comment on table public.payouts is
'LEGACY PAYOUT TABLE. Conservar por compatibilidad/historico; el motor financiero nuevo no debe crear retiros aqui.';

comment on table public.payout_items is
'LEGACY PAYOUT ITEMS. Conservar por compatibilidad/historico; el motor financiero nuevo no debe crear movimientos aqui.';

commit;