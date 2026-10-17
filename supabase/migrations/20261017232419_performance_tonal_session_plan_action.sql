-- Add only the founder-approved just-in-time Tonal session planning audit event.
-- Canonical Performance state remains in the existing revision-checked JSON document.

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
    'configure_strength_program',
    'plan_strength_session',
    'activate_program',
    'transition_strength_program',
    'edit_meal',
    'edit_activity',
    'reject_proposal',
    'delete_source'
  ));
