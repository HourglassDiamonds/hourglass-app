-- UNAPPLIED. Additive Continuum repair quote archive/restore metadata.
-- Proposed migration: 20261003220000 continuum_repair_quote_archive_v1
-- Archive is organizational visibility only; draft/issued/voided status and quote math are unchanged.
-- No hard delete. Existing rows remain active because archived_at defaults to NULL.
-- Service-role-only access and existing RLS remain unchanged.

begin;

alter table public.continuum_repair_quotes
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

alter table public.continuum_repair_quotes
  drop constraint if exists continuum_repair_quotes_archive_metadata_check;

alter table public.continuum_repair_quotes
  add constraint continuum_repair_quotes_archive_metadata_check
  check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null and char_length(btrim(archived_by)) between 1 and 80)
  );

alter table public.continuum_repair_quote_mutations
  drop constraint if exists continuum_repair_quote_mutations_action_check;

alter table public.continuum_repair_quote_mutations
  add constraint continuum_repair_quote_mutations_action_check
  check (action in ('create', 'revise_draft', 'override', 'issue', 'void', 'archive', 'restore'));

create index if not exists continuum_repair_quotes_archive_idx
  on public.continuum_repair_quotes (archived_at, updated_at desc);

create or replace function public.continuum_repair_quotes_protect_issued()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'issued-quote-immutable';
  end if;

  -- Issued and voided rows may change only archive metadata and updated_at
  -- while remaining in the same quote state.
  if old.state in ('issued', 'voided')
    and new.state is not distinct from old.state
    and row(
      new.quote_id, new.project_id, new.quote_number, new.repair_type,
      new.metal_family, new.associated_person_id, new.source_edition_label,
      new.source_sku, new.line, new.calculation, new.override,
      new.issued_at, new.issued_by, new.voided_at, new.voided_by,
      new.created_at, new.created_by, new.created_mutation_id,
      new.issued_mutation_id
    ) is not distinct from row(
      old.quote_id, old.project_id, old.quote_number, old.repair_type,
      old.metal_family, old.associated_person_id, old.source_edition_label,
      old.source_sku, old.line, old.calculation, old.override,
      old.issued_at, old.issued_by, old.voided_at, old.voided_by,
      old.created_at, old.created_by, old.created_mutation_id,
      old.issued_mutation_id
    )
  then
    return new;
  end if;

  if old.state = 'voided' then
    raise exception 'voided-quote-immutable';
  end if;

  if old.state = 'issued' then
    if new.state is distinct from 'voided'
      or new.voided_at is null
      or new.voided_by is null
      or new.calculation is distinct from old.calculation
      or new.line is distinct from old.line
      or new.override is distinct from old.override
      or new.source_sku is distinct from old.source_sku
      or new.source_edition_label is distinct from old.source_edition_label
      or new.repair_type is distinct from old.repair_type
      or new.metal_family is distinct from old.metal_family
      or new.quote_number is distinct from old.quote_number
      or new.project_id is distinct from old.project_id
      or new.associated_person_id is distinct from old.associated_person_id
      or new.issued_at is distinct from old.issued_at
      or new.issued_by is distinct from old.issued_by
      or new.issued_mutation_id is distinct from old.issued_mutation_id
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by
      or new.created_mutation_id is distinct from old.created_mutation_id
      or new.quote_id is distinct from old.quote_id
      or new.archived_at is distinct from old.archived_at
      or new.archived_by is distinct from old.archived_by
    then
      raise exception 'issued-quote-immutable';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.continuum_repair_quotes_protect_issued()
  from public, anon, authenticated;
grant execute on function public.continuum_repair_quotes_protect_issued()
  to service_role;

commit;
