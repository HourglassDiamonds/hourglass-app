
revoke all on table public.continuum_today_snapshots
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.continuum_today_snapshots
to service_role;
;
