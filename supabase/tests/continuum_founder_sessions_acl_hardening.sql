-- Rollback-only runtime contract for the founder-session fresh/upgrade paths.
-- Run only after 20260916094016 and 20261110203600 are installed.

begin;

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
    raise exception 'founder-session service_role privilege contract failed';
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
    raise exception 'founder-session browser-role denial failed';
  end if;
end
$$;

set local role service_role;

insert into public.continuum_founder_sessions (
  session_id, founder_user_id, issued_at, expires_at, revoked_at
) values (
  'release-packet-rollback-only',
  'release-packet-founder',
  '2026-11-10T20:45:00Z',
  '2026-11-10T21:45:00Z',
  null
);

do $$
begin
  if not exists (
    select 1
    from public.continuum_founder_sessions
    where session_id = 'release-packet-rollback-only'
      and revoked_at is null
  ) then
    raise exception 'founder-session lookup failed';
  end if;
end
$$;

update public.continuum_founder_sessions
set revoked_at = '2026-11-10T20:46:00Z'
where session_id = 'release-packet-rollback-only';

delete from public.continuum_founder_sessions
where session_id = 'release-packet-rollback-only'
  and expires_at < '2026-11-11T00:00:00Z';

do $$
begin
  if exists (
    select 1
    from public.continuum_founder_sessions
    where session_id = 'release-packet-rollback-only'
  ) then
    raise exception 'founder-session expired cleanup failed';
  end if;
end
$$;

reset role;

rollback;

select 'CONTINUUM_FOUNDER_SESSIONS_ACL_ROLLBACK_PASS' as result;
