-- LibroSeller Finance Engine - COMPATIBLE con el esquema afiliado existente
-- 2026-08-25
--
-- Este archivo REEMPLAZA la migracion anterior 20260825_finance_engine.sql.
-- Respeta:
--   affiliate_profiles.id                = user id
--   affiliate_profiles.referral_code     = codigo canonico
--   affiliate_profiles.commission_rate   = porcentaje (ej. 10.00 = 10%)
--   affiliate_profiles.status            = application_status (pending/approved/rejected)
--   affiliate_clicks existente            = NO SE TOCA
--
-- Los clicks del nuevo motor se guardan en finance_affiliate_clicks.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. CONFIGURACION
-- ============================================================

create table if not exists public.finance_config (
  singleton boolean primary key default true check (singleton = true),
  default_author_rate numeric(7,6) not null default 0.800000
    check (default_author_rate >= 0 and default_author_rate <= 1),
  default_affiliate_rate numeric(7,6) not null default 0.100000
    check (default_affiliate_rate >= 0 and default_affiliate_rate <= 1),
  earnings_hold_days integer not null default 7
    check (earnings_hold_days >= 0 and earnings_hold_days <= 180),
  minimum_payout numeric(14,2) not null default 10.00
    check (minimum_payout >= 0),
  updated_at timestamptz not null default now(),
  constraint finance_config_rates_check
    check ((default_author_rate + default_affiliate_rate) <= 1)
);

insert into public.finance_config(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.book_finance_rules (
  book_id uuid primary key references public.books(id) on delete cascade,
  author_rate numeric(7,6) null
    check (author_rate is null or (author_rate >= 0 and author_rate <= 1)),
  affiliate_rate numeric(7,6) null
    check (affiliate_rate is null or (affiliate_rate >= 0 and affiliate_rate <= 1)),
  hold_days integer null
    check (hold_days is null or (hold_days >= 0 and hold_days <= 180)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_finance_rules_book_idx
on public.book_finance_rules(book_id);

-- ============================================================
-- 2. COMPATIBILIDAD CON affiliate_profiles EXISTENTE
-- ============================================================

-- La tabla ya existe en LibroSeller con:
-- id, referral_code, commission_rate, status, etc.
-- Solo agregamos el override fraccional del motor nuevo si falta.
alter table public.affiliate_profiles
  add column if not exists commission_rate_override numeric(7,6);

-- El parche anterior pudo crear "code"; la conservamos, pero
-- referral_code sigue siendo la columna canonica.
alter table public.affiliate_profiles
  add column if not exists code text;

update public.affiliate_profiles
set code = referral_code
where code is null;

create unique index if not exists affiliate_profiles_code_upper_idx
on public.affiliate_profiles(upper(code));

-- ============================================================
-- 3. CLICKS DEL MOTOR FINANCIERO (SIN CHOCAR CON affiliate_clicks)
-- ============================================================

create table if not exists public.finance_affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  visitor_key text not null,
  book_slug text null,
  landing_path text null,
  referrer text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists finance_affiliate_clicks_affiliate_created_idx
on public.finance_affiliate_clicks(affiliate_id, created_at desc);

-- Atribucion opcional en orden PayPal.
alter table if exists public.paypal_orders
  add column if not exists affiliate_user_id uuid null references auth.users(id) on delete set null;

alter table if exists public.paypal_orders
  add column if not exists affiliate_code text null;

create index if not exists paypal_orders_affiliate_user_idx
on public.paypal_orders(affiliate_user_id);

-- ============================================================
-- 4. LEDGER
-- ============================================================

create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid null references auth.users(id) on delete set null,

  role_context text not null
    check (role_context in ('customer','author','affiliate','platform')),

  account_bucket text not null
    check (account_bucket in ('spend','earnings','benefit','platform')),

  event_type text not null
    check (
      event_type in (
        'purchase',
        'author_royalty',
        'affiliate_commission',
        'platform_fee',
        'payment_fee',
        'discount',
        'credit',
        'refund',
        'reversal',
        'payout',
        'adjustment'
      )
    ),

  direction text not null
    check (direction in ('credit','debit')),

  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),

  amount numeric(14,2) not null
    check (amount >= 0),

  gross_amount numeric(14,2) null
    check (gross_amount is null or gross_amount >= 0),

  fee_amount numeric(14,2) not null default 0
    check (fee_amount >= 0),

  net_amount numeric(14,2) not null default 0
    check (net_amount >= 0),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'available',
        'processing',
        'paid',
        'reversed',
        'refunded',
        'failed',
        'cancelled'
      )
    ),

  source_type text not null,
  source_id text not null,
  idempotency_key text not null unique,

  description text null,
  reference text null,

  book_id uuid null references public.books(id) on delete set null,
  purchase_id uuid null references public.book_purchases(id) on delete set null,

  paypal_order_id text null,
  paypal_capture_id text null,

  available_at timestamptz null,
  settled_at timestamptz null,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_user_created_idx
on public.financial_ledger(user_id, created_at desc);

create index if not exists financial_ledger_user_currency_idx
on public.financial_ledger(user_id, currency);

create index if not exists financial_ledger_role_idx
on public.financial_ledger(user_id, role_context, created_at desc);

create index if not exists financial_ledger_purchase_idx
on public.financial_ledger(purchase_id);

create index if not exists financial_ledger_capture_idx
on public.financial_ledger(paypal_capture_id);

create index if not exists financial_ledger_status_available_idx
on public.financial_ledger(status, available_at);

create or replace function public.prevent_financial_ledger_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'financial_ledger es inmutable: usa refund/reversal/adjustment';
end;
$$;

drop trigger if exists financial_ledger_no_delete
on public.financial_ledger;

create trigger financial_ledger_no_delete
before delete on public.financial_ledger
for each row
execute function public.prevent_financial_ledger_delete();

-- ============================================================
-- 5. RETIROS
-- ============================================================

create table if not exists public.financial_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_context text not null default 'author'
    check (role_context in ('author','affiliate')),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  fee_amount numeric(14,2) not null default 0 check (fee_amount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  method text not null,
  destination_masked text null,
  status text not null default 'requested'
    check (
      status in (
        'requested',
        'processing',
        'paid',
        'failed',
        'cancelled'
      )
    ),
  payout_reference text null,
  failure_reason text null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.financial_payouts
  add column if not exists role_context text not null default 'author';

create index if not exists financial_payouts_user_created_idx
on public.financial_payouts(user_id, requested_at desc);

-- ============================================================
-- 6. VISTAS
-- ============================================================

drop view if exists public.financial_user_summary;
drop view if exists public.financial_ledger_effective;

create view public.financial_ledger_effective
with (security_invoker = true)
as
select
  l.*,
  case
    when l.direction = 'credit' then l.amount
    else -l.amount
  end as signed_amount,
  case
    when l.status = 'pending'
      and l.available_at is not null
      and l.available_at <= now()
    then 'available'
    else l.status
  end as effective_status
from public.financial_ledger l;

create view public.financial_user_summary
with (security_invoker = true)
as
select
  user_id,
  currency,

  coalesce(sum(
    case
      when direction = 'credit'
       and event_type in (
         'author_royalty',
         'affiliate_commission',
         'refund',
         'credit',
         'discount'
       )
       and status not in ('failed','cancelled')
      then amount else 0
    end
  ),0)::numeric(14,2) as benefits_total,

  coalesce(sum(
    case
      when role_context = 'author'
       and direction = 'credit'
       and event_type = 'author_royalty'
       and status not in ('failed','cancelled')
      then amount else 0
    end
  ),0)::numeric(14,2) as author_earnings_total,

  coalesce(sum(
    case
      when role_context = 'affiliate'
       and direction = 'credit'
       and event_type = 'affiliate_commission'
       and status not in ('failed','cancelled')
      then amount else 0
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
       and direction = 'credit'
       and event_type in ('refund','credit','discount')
       and status not in ('failed','cancelled')
      then amount else 0
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
       and direction = 'credit'
       and event_type in ('credit','discount')
       and status not in ('failed','cancelled')
      then amount else 0
    end
  ),0)::numeric(14,2) as credits_discounts_total,

  count(*)::bigint as transactions_count

from public.financial_ledger_effective
where user_id is not null
group by user_id, currency;

-- ============================================================
-- 7. RLS
-- ============================================================

alter table public.finance_config enable row level security;
alter table public.book_finance_rules enable row level security;
alter table public.finance_affiliate_clicks enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.financial_payouts enable row level security;

drop policy if exists "Finance affiliates read own clicks"
on public.finance_affiliate_clicks;

create policy "Finance affiliates read own clicks"
on public.finance_affiliate_clicks
for select
to authenticated
using (auth.uid() = affiliate_id);

drop policy if exists "Users read own ledger"
on public.financial_ledger;

create policy "Users read own ledger"
on public.financial_ledger
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own payouts"
on public.financial_payouts;

create policy "Users read own payouts"
on public.financial_payouts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authors read own finance rules"
on public.book_finance_rules;

create policy "Authors read own finance rules"
on public.book_finance_rules
for select
to authenticated
using (
  exists (
    select 1
    from public.books b
    where b.id = book_finance_rules.book_id
      and b.owner_user_id = auth.uid()
  )
);

grant select on public.finance_affiliate_clicks to authenticated;
grant select on public.financial_ledger to authenticated;
grant select on public.financial_payouts to authenticated;
grant select on public.book_finance_rules to authenticated;
grant select on public.financial_ledger_effective to authenticated;
grant select on public.financial_user_summary to authenticated;

revoke insert, update, delete on public.financial_ledger from authenticated;
revoke insert, update, delete on public.financial_payouts from authenticated;
revoke insert, update, delete on public.finance_affiliate_clicks from authenticated;

-- ============================================================
-- 8. ACTIVAR AFILIADO USANDO EL ESQUEMA EXISTENTE
-- ============================================================

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
  v_requested text;
  v_code text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_requested := upper(
    regexp_replace(coalesce(trim(p_code), ''), '[^A-Za-z0-9_-]', '', 'g')
  );

  if length(v_requested) > 0 and length(v_requested) < 4 then
    raise exception 'AFFILIATE_CODE_TOO_SHORT';
  end if;

  select referral_code
  into v_code
  from public.affiliate_profiles
  where id = v_user;

  if found then
    if length(v_requested) >= 4 then
      update public.affiliate_profiles
      set
        referral_code = v_requested,
        code = v_requested,
        status = 'approved',
        updated_at = now()
      where id = v_user
      returning referral_code into v_code;
    else
      update public.affiliate_profiles
      set
        code = coalesce(code, referral_code),
        status = 'approved',
        updated_at = now()
      where id = v_user
      returning referral_code into v_code;
    end if;
  else
    if length(v_requested) >= 4 then
      v_code := v_requested;
    else
      v_code := 'LS-' || upper(substr(replace(v_user::text, '-', ''), 1, 10));
    end if;

    insert into public.affiliate_profiles(
      id,
      referral_code,
      code,
      status
    )
    values (
      v_user,
      v_code,
      v_code,
      'approved'
    );
  end if;

  insert into public.user_roles(user_id, role)
  values (v_user, 'affiliate')
  on conflict (user_id, role) do nothing;

  return v_code;
end;
$$;

revoke all on function public.finance_enable_affiliate(text) from public;
grant execute on function public.finance_enable_affiliate(text) to authenticated;

-- ============================================================
-- 9. REGISTRAR VENTA
-- ============================================================

create or replace function public.finance_record_book_sale(
  p_purchase_id uuid,
  p_buyer_user_id uuid,
  p_book_id uuid,
  p_amount numeric,
  p_currency text,
  p_paypal_order_id text,
  p_paypal_capture_id text,
  p_affiliate_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_user_id uuid;
  v_title text;
  v_author_rate numeric(7,6);
  v_affiliate_rate numeric(7,6);
  v_hold_days integer;
  v_author_amount numeric(14,2);
  v_affiliate_amount numeric(14,2);
  v_platform_amount numeric(14,2);
  v_currency text;
  v_available_at timestamptz;
  v_earnings_status text;
  v_affiliate_active boolean := false;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_paypal_capture_id is null or length(trim(p_paypal_capture_id)) = 0 then
    raise exception 'CAPTURE_ID_REQUIRED';
  end if;

  v_currency := upper(trim(p_currency));

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY';
  end if;

  select b.owner_user_id, b.title
  into v_author_user_id, v_title
  from public.books b
  where b.id = p_book_id;

  if not found then
    raise exception 'BOOK_NOT_FOUND';
  end if;

  select
    coalesce(r.author_rate, c.default_author_rate),
    coalesce(r.affiliate_rate, c.default_affiliate_rate),
    coalesce(r.hold_days, c.earnings_hold_days)
  into
    v_author_rate,
    v_affiliate_rate,
    v_hold_days
  from public.finance_config c
  left join public.book_finance_rules r
    on r.book_id = p_book_id
  where c.singleton = true;

  if p_affiliate_user_id is not null
     and p_affiliate_user_id <> p_buyer_user_id then

    select exists (
      select 1
      from public.affiliate_profiles a
      where a.id = p_affiliate_user_id
        and a.status = 'approved'
    )
    into v_affiliate_active;

    if v_affiliate_active then
      select
        coalesce(
          a.commission_rate_override,
          (a.commission_rate / 100.0),
          v_affiliate_rate
        )
      into v_affiliate_rate
      from public.affiliate_profiles a
      where a.id = p_affiliate_user_id;
    end if;
  end if;

  if not v_affiliate_active then
    p_affiliate_user_id := null;
    v_affiliate_rate := 0;
  end if;

  if v_author_user_id is null then
    v_author_rate := 0;
  end if;

  if v_author_rate < 0
     or v_affiliate_rate < 0
     or (v_author_rate + v_affiliate_rate) > 1 then
    raise exception 'INVALID_REVENUE_SPLIT';
  end if;

  v_author_amount := round((p_amount * v_author_rate)::numeric, 2);
  v_affiliate_amount := round((p_amount * v_affiliate_rate)::numeric, 2);
  v_platform_amount := round(
    (p_amount - v_author_amount - v_affiliate_amount)::numeric,
    2
  );

  v_available_at := now() + make_interval(days => v_hold_days);
  v_earnings_status := case
    when v_hold_days = 0 then 'available'
    else 'pending'
  end;

  insert into public.financial_ledger(
    user_id, role_context, account_bucket, event_type, direction,
    currency, amount, gross_amount, net_amount, status,
    source_type, source_id, idempotency_key,
    description, reference, book_id, purchase_id,
    paypal_order_id, paypal_capture_id, settled_at, metadata
  )
  values (
    p_buyer_user_id, 'customer', 'spend', 'purchase', 'debit',
    v_currency, round(p_amount,2), round(p_amount,2), round(p_amount,2), 'paid',
    'book_sale', p_purchase_id::text,
    'sale:' || p_paypal_capture_id || ':customer',
    'Compra de ' || coalesce(v_title, 'libro'),
    p_paypal_capture_id, p_book_id, p_purchase_id,
    p_paypal_order_id, p_paypal_capture_id, now(),
    jsonb_build_object('book_title', v_title)
  )
  on conflict (idempotency_key) do nothing;

  if v_author_user_id is not null and v_author_amount > 0 then
    insert into public.financial_ledger(
      user_id, role_context, account_bucket, event_type, direction,
      currency, amount, gross_amount, fee_amount, net_amount, status,
      source_type, source_id, idempotency_key,
      description, reference, book_id, purchase_id,
      paypal_order_id, paypal_capture_id, available_at, metadata
    )
    values (
      v_author_user_id, 'author', 'earnings', 'author_royalty', 'credit',
      v_currency, v_author_amount, round(p_amount,2),
      round((p_amount - v_author_amount)::numeric,2),
      v_author_amount, v_earnings_status,
      'book_sale', p_purchase_id::text,
      'sale:' || p_paypal_capture_id || ':author:' || v_author_user_id::text,
      'Regalía por venta de ' || coalesce(v_title, 'libro'),
      p_paypal_capture_id, p_book_id, p_purchase_id,
      p_paypal_order_id, p_paypal_capture_id, v_available_at,
      jsonb_build_object('rate', v_author_rate, 'book_title', v_title)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if p_affiliate_user_id is not null and v_affiliate_amount > 0 then
    insert into public.financial_ledger(
      user_id, role_context, account_bucket, event_type, direction,
      currency, amount, gross_amount, fee_amount, net_amount, status,
      source_type, source_id, idempotency_key,
      description, reference, book_id, purchase_id,
      paypal_order_id, paypal_capture_id, available_at, metadata
    )
    values (
      p_affiliate_user_id, 'affiliate', 'earnings', 'affiliate_commission', 'credit',
      v_currency, v_affiliate_amount, round(p_amount,2),
      round((p_amount - v_affiliate_amount)::numeric,2),
      v_affiliate_amount, v_earnings_status,
      'book_sale', p_purchase_id::text,
      'sale:' || p_paypal_capture_id || ':affiliate:' || p_affiliate_user_id::text,
      'Comisión de afiliado por ' || coalesce(v_title, 'libro'),
      p_paypal_capture_id, p_book_id, p_purchase_id,
      p_paypal_order_id, p_paypal_capture_id, v_available_at,
      jsonb_build_object('rate', v_affiliate_rate, 'book_title', v_title)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if v_platform_amount > 0 then
    insert into public.financial_ledger(
      user_id, role_context, account_bucket, event_type, direction,
      currency, amount, gross_amount, net_amount, status,
      source_type, source_id, idempotency_key,
      description, reference, book_id, purchase_id,
      paypal_order_id, paypal_capture_id, settled_at, metadata
    )
    values (
      null, 'platform', 'platform', 'platform_fee', 'credit',
      v_currency, v_platform_amount, round(p_amount,2), v_platform_amount, 'paid',
      'book_sale', p_purchase_id::text,
      'sale:' || p_paypal_capture_id || ':platform',
      'Participación de plataforma por ' || coalesce(v_title, 'libro'),
      p_paypal_capture_id, p_book_id, p_purchase_id,
      p_paypal_order_id, p_paypal_capture_id, now(),
      jsonb_build_object(
        'author_rate', v_author_rate,
        'affiliate_rate', v_affiliate_rate,
        'book_title', v_title
      )
    )
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

revoke all on function public.finance_record_book_sale(
  uuid,uuid,uuid,numeric,text,text,text,uuid
) from public;

grant execute on function public.finance_record_book_sale(
  uuid,uuid,uuid,numeric,text,text,text,uuid
) to service_role;

-- ============================================================
-- 10. REEMBOLSOS
-- ============================================================

create or replace function public.finance_record_refund(
  p_purchase_id uuid,
  p_refund_amount numeric,
  p_refund_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original_purchase numeric(14,2);
  v_already_refunded numeric(14,2);
  v_remaining numeric(14,2);
  v_ratio numeric;
  r record;
  v_reverse_amount numeric(14,2);
begin
  if p_refund_amount is null or p_refund_amount <= 0 then
    raise exception 'INVALID_REFUND_AMOUNT';
  end if;

  if p_refund_reference is null or length(trim(p_refund_reference)) = 0 then
    raise exception 'REFUND_REFERENCE_REQUIRED';
  end if;

  select amount
  into v_original_purchase
  from public.financial_ledger
  where purchase_id = p_purchase_id
    and role_context = 'customer'
    and event_type = 'purchase'
    and direction = 'debit'
  order by created_at asc
  limit 1;

  if v_original_purchase is null or v_original_purchase <= 0 then
    raise exception 'ORIGINAL_PURCHASE_NOT_FOUND';
  end if;

  select coalesce(sum(amount),0)
  into v_already_refunded
  from public.financial_ledger
  where purchase_id = p_purchase_id
    and role_context = 'customer'
    and event_type = 'refund'
    and direction = 'credit'
    and status not in ('failed','cancelled');

  v_remaining := greatest(0, v_original_purchase - v_already_refunded);

  if p_refund_amount > v_remaining then
    raise exception 'REFUND_EXCEEDS_REMAINING_%', v_remaining;
  end if;

  v_ratio := p_refund_amount / v_original_purchase;

  for r in
    select *
    from public.financial_ledger
    where purchase_id = p_purchase_id
      and event_type in (
        'purchase',
        'author_royalty',
        'affiliate_commission',
        'platform_fee'
      )
  loop
    v_reverse_amount := round((r.amount * v_ratio)::numeric, 2);

    if v_reverse_amount <= 0 then
      continue;
    end if;

    insert into public.financial_ledger(
      user_id, role_context, account_bucket, event_type, direction,
      currency, amount, gross_amount, net_amount, status,
      source_type, source_id, idempotency_key,
      description, reference, book_id, purchase_id,
      paypal_order_id, paypal_capture_id, settled_at, metadata
    )
    values (
      r.user_id,
      r.role_context,
      r.account_bucket,
      case when r.role_context = 'customer' then 'refund' else 'reversal' end,
      case when r.direction = 'credit' then 'debit' else 'credit' end,
      r.currency,
      v_reverse_amount,
      r.gross_amount,
      v_reverse_amount,
      'paid',
      'refund',
      p_refund_reference,
      'refund:' || p_refund_reference || ':' || r.id::text,
      case
        when r.role_context = 'customer' then 'Reembolso de compra'
        else 'Reverso por reembolso'
      end,
      p_refund_reference,
      r.book_id,
      r.purchase_id,
      r.paypal_order_id,
      r.paypal_capture_id,
      now(),
      jsonb_build_object(
        'reverses_ledger_id', r.id,
        'refund_ratio', v_ratio
      )
    )
    on conflict (idempotency_key) do nothing;
  end loop;
end;
$$;

revoke all on function public.finance_record_refund(uuid,numeric,text) from public;
grant execute on function public.finance_record_refund(uuid,numeric,text) to service_role;

-- ============================================================
-- 11. RETIROS POR ROL
-- ============================================================

create or replace function public.finance_request_payout(
  p_amount numeric,
  p_currency text default 'USD',
  p_method text default 'paypal',
  p_role_context text default 'author'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_currency text := upper(trim(p_currency));
  v_available numeric(14,2);
  v_minimum numeric(14,2);
  v_payout_id uuid;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_role_context not in ('author','affiliate') then
    raise exception 'INVALID_PAYOUT_ROLE';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_PAYOUT_AMOUNT';
  end if;

  select minimum_payout
  into v_minimum
  from public.finance_config
  where singleton = true;

  if p_amount < v_minimum then
    raise exception 'MINIMUM_PAYOUT_%', v_minimum;
  end if;

  select coalesce(sum(
    case
      when direction = 'credit' then amount
      else -amount
    end
  ),0)
  into v_available
  from public.financial_ledger
  where user_id = v_user
    and currency = v_currency
    and role_context = p_role_context
    and account_bucket = 'earnings'
    and status not in ('failed','cancelled')
    and (
      status in ('available','processing','paid')
      or (
        status = 'pending'
        and available_at is not null
        and available_at <= now()
      )
    );

  if p_amount > v_available then
    raise exception 'INSUFFICIENT_AVAILABLE_BALANCE';
  end if;

  insert into public.financial_payouts(
    user_id,
    role_context,
    currency,
    requested_amount,
    fee_amount,
    net_amount,
    method,
    status
  )
  values (
    v_user,
    p_role_context,
    v_currency,
    round(p_amount,2),
    0,
    round(p_amount,2),
    lower(trim(p_method)),
    'requested'
  )
  returning id into v_payout_id;

  insert into public.financial_ledger(
    user_id, role_context, account_bucket, event_type, direction,
    currency, amount, gross_amount, net_amount, status,
    source_type, source_id, idempotency_key,
    description, reference, metadata
  )
  values (
    v_user,
    p_role_context,
    'earnings',
    'payout',
    'debit',
    v_currency,
    round(p_amount,2),
    round(p_amount,2),
    round(p_amount,2),
    'processing',
    'payout',
    v_payout_id::text,
    'payout:' || v_payout_id::text,
    'Retiro solicitado',
    v_payout_id::text,
    jsonb_build_object(
      'method', lower(trim(p_method)),
      'role_context', p_role_context
    )
  );

  return v_payout_id;
end;
$$;

revoke all on function public.finance_request_payout(numeric,text,text,text) from public;
grant execute on function public.finance_request_payout(numeric,text,text,text) to authenticated;

create or replace function public.finance_set_payout_status(
  p_payout_id uuid,
  p_status text,
  p_reference text default null,
  p_failure_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_status text;
begin
  if p_status not in ('processing','paid','failed','cancelled') then
    raise exception 'INVALID_PAYOUT_STATUS';
  end if;

  update public.financial_payouts
  set
    status = p_status,
    payout_reference = coalesce(p_reference, payout_reference),
    failure_reason = p_failure_reason,
    processed_at = case
      when p_status in ('paid','failed','cancelled') then now()
      else processed_at
    end,
    updated_at = now()
  where id = p_payout_id;

  if not found then
    raise exception 'PAYOUT_NOT_FOUND';
  end if;

  v_ledger_status := case
    when p_status = 'paid' then 'paid'
    when p_status in ('failed','cancelled') then p_status
    else 'processing'
  end;

  update public.financial_ledger
  set
    status = v_ledger_status,
    reference = coalesce(p_reference, reference),
    settled_at = case when p_status = 'paid' then now() else settled_at end,
    metadata = metadata || jsonb_build_object(
      'payout_status', p_status,
      'failure_reason', p_failure_reason
    )
  where source_type = 'payout'
    and source_id = p_payout_id::text
    and event_type = 'payout';
end;
$$;

revoke all on function public.finance_set_payout_status(uuid,text,text,text) from public;
grant execute on function public.finance_set_payout_status(uuid,text,text,text) to service_role;
