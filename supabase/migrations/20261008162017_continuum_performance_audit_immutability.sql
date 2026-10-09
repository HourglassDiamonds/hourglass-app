-- Audit rows are append-only. Sensitive values live in the separately mutable
-- evidence table so retention cleanup never rewrites provenance history.
create or replace function public.continuum_performance_reject_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'continuum_performance_audit_is_immutable';
end;
$$;

revoke execute on function public.continuum_performance_reject_audit_mutation() from public, anon, authenticated, service_role;

drop trigger if exists continuum_performance_audit_immutable on public.continuum_performance_audit;
create trigger continuum_performance_audit_immutable
before update or delete on public.continuum_performance_audit
for each row execute function public.continuum_performance_reject_audit_mutation();
