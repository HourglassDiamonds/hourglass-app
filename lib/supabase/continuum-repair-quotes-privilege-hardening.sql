-- APPLIED TO PRODUCTION 2026-09-09. Historical record. Do not re-run against production.
-- Production migration: 20260909190044 continuum_repair_quotes_v1_privilege_hardening
-- Records already-applied privilege hardening after continuum_repair_quotes_v1
-- (20260909190009). Does not change tables, columns, checks, pricing, or row data.
-- No catalog table. RLS remains enabled. Service-role-only application access.
-- Does not create policies. Does not broaden grants beyond the service-role contract.

REVOKE ALL ON TABLE
public.continuum_repair_quotes
FROM public, anon, authenticated;

REVOKE ALL ON TABLE
public.continuum_repair_quote_mutations
FROM public, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE
public.continuum_repair_quotes
TO service_role;

GRANT SELECT, INSERT ON TABLE
public.continuum_repair_quote_mutations
TO service_role;

REVOKE EXECUTE ON FUNCTION
public.continuum_repair_quotes_protect_issued()
FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.continuum_repair_quotes_protect_issued()
TO service_role;
