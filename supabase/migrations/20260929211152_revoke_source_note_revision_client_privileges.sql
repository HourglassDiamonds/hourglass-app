-- Align Production with the checked-in Source Note revision privilege contract.
-- REVOKE is idempotent when either role already has no direct table privileges.
begin;

revoke all privileges on table public.continuum_source_note_revisions
  from anon, authenticated;

commit;
