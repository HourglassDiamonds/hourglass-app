-- UNAPPLIED.
-- Client Memory source-note relationship context layer.
-- Do not apply in this sprint. Do not run against production from this change.
-- Affects only public.continuum_source_notes.context_layer.
-- Does not modify Person, Project, Wish, Fact, or kernel Event/Evidence/Observation rows.
-- Does not add anon/authenticated grants. RLS on continuum_source_notes remains enabled.
-- Unique index continuum_source_notes_import_field_uq is unchanged.
-- No database DEFAULT after backfill: every future write must specify context_layer.

alter table public.continuum_source_notes
  add column if not exists context_layer text;

update public.continuum_source_notes
set context_layer = 'client'
where context_layer is null;

alter table public.continuum_source_notes
  alter column context_layer set not null;

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_context_layer_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_context_layer_check
  check (
    context_layer in ('client', 'networking', 'personal')
  );
