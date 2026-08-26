-- ============================================================
-- LIBROSELLER SUPERADMIN - FINANCIAL SUMMARY CONTROLS
-- 2026-08-26
--
-- Objetivo:
-- Permitir que SUPERADMIN establezca valores exactos de:
--   benefits_total
--   available_to_withdraw
--   pending_earnings
--   author_earnings_total
--   affiliate_earnings_total
--   paid_out_total
--
-- El ledger sigue siendo append-only.
-- No se actualiza ni elimina ningun movimiento historico.
-- ============================================================

begin;

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
      and not (
        event_type = 'adjustment'
        and role_context = 'customer'
        and account_bucket = 'earnings'
        and coalesce(metadata->>'summary_metric','') in (
          'available_to_withdraw',
          'pending_earnings'
        )
      )
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

  greatest(
    0,
    coalesce(sum(
      case
        when event_type = 'payout'
         and status = 'paid'
         and direction = 'debit'
        then amount
        when event_type = 'payout'
         and status = 'paid'
         and direction = 'credit'
        then -amount
        else 0
      end
    ),0)
  )::numeric(14,2) as paid_out_total,

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

comment on view public.financial_user_summary is
'Resumen financiero derivado del ledger inmutable. Soporta ajustes SUPERADMIN por summary_metric sin sobrescribir historial.';

commit;
