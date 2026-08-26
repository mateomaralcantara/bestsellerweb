-- ============================================================
-- LIBROSELLER SUPERADMIN CONTROL CENTER
-- 2026-08-26
-- Seguridad, auditoria, permisos y controles administrativos.
-- Mantiene financial_ledger como fuente contable inmutable.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_permissions_permission_check
    check (length(trim(permission)) between 1 and 100),
  unique (admin_user_id, permission)
);

create index if not exists admin_permissions_user_idx
  on public.admin_permissions(admin_user_id);

insert into public.admin_permissions(admin_user_id, permission)
select ur.user_id, '*'
from public.user_roles ur
where ur.role::text = 'admin'
on conflict (admin_user_id, permission) do nothing;

create table if not exists public.admin_user_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  purchase_blocked boolean not null default false,
  payout_blocked boolean not null default false,
  notes text null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  module text not null,
  target_type text null,
  target_id text null,
  reason text null,
  before_data jsonb null,
  after_data jsonb null,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_admin_created_idx
  on public.admin_audit_log(admin_user_id, created_at desc);

create index if not exists admin_audit_target_idx
  on public.admin_audit_log(target_type, target_id, created_at desc);

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'ADMIN_AUDIT_LOG_IMMUTABLE';
end;
$$;

drop trigger if exists admin_audit_no_update on public.admin_audit_log;
create trigger admin_audit_no_update
before update on public.admin_audit_log
for each row execute function public.prevent_admin_audit_mutation();

drop trigger if exists admin_audit_no_delete on public.admin_audit_log;
create trigger admin_audit_no_delete
before delete on public.admin_audit_log
for each row execute function public.prevent_admin_audit_mutation();

alter table public.admin_permissions enable row level security;
alter table public.admin_user_controls enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.admin_permissions from anon, authenticated;
revoke all on public.admin_user_controls from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

grant select, insert, update, delete on public.admin_permissions to service_role;
grant select, insert, update, delete on public.admin_user_controls to service_role;
revoke update, delete on public.admin_audit_log from service_role;
grant select, insert on public.admin_audit_log to service_role;

create or replace view public.financial_user_summary
with (security_invoker = true)
as
select
  user_id,
  currency,

  coalesce(sum(
    case
      when event_type in (
        'author_royalty',
        'affiliate_commission',
        'refund',
        'credit',
        'discount',
        'adjustment'
      )
      and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as benefits_total,

  coalesce(sum(
    case
      when role_context = 'author'
       and account_bucket = 'earnings'
       and event_type in ('author_royalty','adjustment')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as author_earnings_total,

  coalesce(sum(
    case
      when role_context = 'affiliate'
       and account_bucket = 'earnings'
       and event_type in ('affiliate_commission','adjustment')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as affiliate_earnings_total,

  coalesce(sum(
    case
      when account_bucket = 'earnings'
       and effective_status in ('available','processing','paid')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as available_to_withdraw,

  coalesce(sum(
    case
      when account_bucket = 'earnings'
       and effective_status = 'pending'
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as pending_earnings,

  coalesce(sum(
    case
      when role_context = 'author'
       and account_bucket = 'earnings'
       and effective_status in ('available','processing','paid')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as author_available,

  coalesce(sum(
    case
      when role_context = 'author'
       and account_bucket = 'earnings'
       and effective_status = 'pending'
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as author_pending,

  coalesce(sum(
    case
      when role_context = 'affiliate'
       and account_bucket = 'earnings'
       and effective_status in ('available','processing','paid')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as affiliate_available,

  coalesce(sum(
    case
      when role_context = 'affiliate'
       and account_bucket = 'earnings'
       and effective_status = 'pending'
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as affiliate_pending,

  coalesce(sum(
    case
      when event_type = 'payout'
       and direction = 'debit'
       and status = 'paid'
      then amount else 0
    end
  ),0)::numeric(14,2) as paid_out_total,

  greatest(
    0,
    -coalesce(sum(
      case
        when account_bucket = 'spend'
         and status not in ('failed','cancelled')
        then signed_amount else 0
      end
    ),0)
  )::numeric(14,2) as buyer_net_spend,

  coalesce(sum(
    case
      when role_context = 'customer'
       and account_bucket = 'benefit'
       and event_type in ('refund','credit','discount','adjustment')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as buyer_benefits_total,

  coalesce(sum(
    case
      when role_context = 'customer'
       and direction = 'credit'
       and event_type = 'refund'
       and status not in ('failed','cancelled')
      then amount else 0
    end
  ),0)::numeric(14,2) as refunds_total,

  coalesce(sum(
    case
      when role_context = 'customer'
       and account_bucket = 'benefit'
       and event_type in ('credit','discount','adjustment')
       and status not in ('failed','cancelled')
      then signed_amount else 0
    end
  ),0)::numeric(14,2) as credits_discounts_total,

  count(*)::bigint as transactions_count

from public.financial_ledger_effective
where user_id is not null
group by user_id, currency;

grant select on public.financial_user_summary to authenticated;

comment on table public.admin_audit_log is
'LIBROSELLER SUPERADMIN IMMUTABLE AUDIT LOG. Cada cambio sensible debe registrar antes/despues y motivo.';

comment on table public.admin_permissions is
'Permisos finos del panel administrativo. El permiso * concede control total.';

comment on table public.admin_user_controls is
'Bloqueos operativos administrados desde SUPERADMIN: compras y retiros.';

commit;
