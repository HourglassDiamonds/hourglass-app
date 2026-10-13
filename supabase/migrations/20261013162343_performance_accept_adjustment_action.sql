-- Allow the already-authenticated Performance persistence path to record a
-- founder-approved adaptive-coach schedule adjustment. This changes only the
-- audit action vocabulary; it does not alter state, permissions, RLS, or writers.

alter table public.continuum_performance_audit
  drop constraint if exists continuum_performance_audit_action_check;

alter table public.continuum_performance_audit
  add constraint continuum_performance_audit_action_check
  check (action in (
    'bootstrap',
    'snapshot',
    'accept_meal',
    'accept_activity',
    'accept_adjustment',
    'edit_meal',
    'edit_activity',
    'reject_proposal',
    'delete_source'
  ));
