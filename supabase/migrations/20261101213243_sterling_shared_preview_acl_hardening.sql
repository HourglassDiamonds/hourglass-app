-- Shared Preview inherited broad table privileges from postgres' legacy
-- public-schema defaults. Clear every application-role table privilege first,
-- then grant only the operations required by the Sterling executors.
-- Ownership and owner-level administrative privileges are intentionally intact.

revoke all on table public.continuum_candidate_suppression_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.continuum_candidate_suppression_events
  to service_role;

revoke all on table public.continuum_sterling_today_publications
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.continuum_sterling_today_publications
  to service_role;
