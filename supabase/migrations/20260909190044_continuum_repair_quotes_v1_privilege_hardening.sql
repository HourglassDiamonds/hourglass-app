revoke all on table public.continuum_repair_quotes from public;
revoke all on table public.continuum_repair_quotes from anon;
revoke all on table public.continuum_repair_quotes from authenticated;
revoke all on table public.continuum_repair_quotes from service_role;
grant select, insert, update on table public.continuum_repair_quotes to service_role;

revoke all on table public.continuum_repair_quote_mutations from public;
revoke all on table public.continuum_repair_quote_mutations from anon;
revoke all on table public.continuum_repair_quote_mutations from authenticated;
revoke all on table public.continuum_repair_quote_mutations from service_role;
grant select, insert on table public.continuum_repair_quote_mutations to service_role;

revoke all on function public.continuum_repair_quotes_protect_issued() from public;
revoke all on function public.continuum_repair_quotes_protect_issued() from anon;
revoke all on function public.continuum_repair_quotes_protect_issued() from authenticated;
grant execute on function public.continuum_repair_quotes_protect_issued() to service_role;;
