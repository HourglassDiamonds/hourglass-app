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
  );;
