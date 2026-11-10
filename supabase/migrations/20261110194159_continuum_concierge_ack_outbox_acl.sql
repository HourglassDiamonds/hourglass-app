-- Continuum Concierge acknowledgement outbox ACL hardening.
--
-- Follow-up for environments where the P0.9 persistence migration is already
-- recorded. Supabase's legacy public-schema default privileges can grant
-- service_role privileges beyond the intended read/append/update contract.
-- Revoke those inherited object grants before restoring the exact allow-list.

begin;

do $$
begin
  if to_regclass('public.continuum_concierge_ack_outbox') is null then
    raise exception 'continuum_concierge_ack_outbox is required';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.continuum_concierge_ack_outbox'::regclass
      and relrowsecurity
      and relforcerowsecurity
  ) then
    raise exception 'continuum_concierge_ack_outbox must have forced RLS';
  end if;

  if to_regprocedure(
    'public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)'
  ) is null or to_regprocedure(
    'public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)'
  ) is null then
    raise exception 'Concierge persistence RPCs are required';
  end if;
end
$$;

revoke all
on table public.continuum_concierge_ack_outbox
from service_role;

grant select, insert, update
on table public.continuum_concierge_ack_outbox
to service_role;

do $$
begin
  if not has_table_privilege(
    'service_role',
    'public.continuum_concierge_ack_outbox',
    'SELECT,INSERT,UPDATE'
  ) or has_table_privilege(
    'service_role',
    'public.continuum_concierge_ack_outbox',
    'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'unexpected effective service_role outbox privileges';
  end if;
end
$$;

commit;
