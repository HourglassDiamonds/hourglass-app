-- Continuum founder-session least-privilege hardening.
--
-- Fresh installs apply this after 20260916094016. Environments that already
-- recorded the historical migration apply only this additive correction.

begin;

do $$
begin
  if to_regclass('public.continuum_founder_sessions') is null then
    raise exception 'continuum_founder_sessions is required';
  end if;

  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'continuum_founder_sessions'
  ) then
    raise exception 'continuum_founder_sessions must retain RLS';
  end if;
end
$$;

revoke all on table public.continuum_founder_sessions from public;
revoke all on table public.continuum_founder_sessions from anon;
revoke all on table public.continuum_founder_sessions from authenticated;
revoke all on table public.continuum_founder_sessions from service_role;

grant select, insert, update, delete
on table public.continuum_founder_sessions
to service_role;

do $$
begin
  if not has_table_privilege(
    'service_role', 'public.continuum_founder_sessions', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.continuum_founder_sessions', 'INSERT'
  ) or not has_table_privilege(
    'service_role', 'public.continuum_founder_sessions', 'UPDATE'
  ) or not has_table_privilege(
    'service_role', 'public.continuum_founder_sessions', 'DELETE'
  ) or has_table_privilege(
    'service_role',
    'public.continuum_founder_sessions',
    'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'unexpected effective service_role founder-session privileges';
  end if;

  if has_table_privilege(
    'anon',
    'public.continuum_founder_sessions',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) or has_table_privilege(
    'authenticated',
    'public.continuum_founder_sessions',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'browser roles must not access founder sessions';
  end if;
end
$$;

commit;
