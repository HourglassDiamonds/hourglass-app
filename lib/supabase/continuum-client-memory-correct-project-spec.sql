-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Slice C — project spec correction + revision history.
-- Additive only. continuum_project_history remains the ONE current snapshot.
-- Does not create a second current-project-history table.
-- Does not rewrite imported source evidence.
-- Does not auto-correct values. Does not infer 141 → 14 / 14.1.
-- Does not modify Person facts, Notes, Wishes, Human Intake, Gmail, Digital Card, or CoS.
-- Does not add anon/authenticated grants. RLS remains enabled.
-- No dynamic SQL from field_name.

alter table public.continuum_project_history
  add column if not exists founder_corrected_fields text[];

update public.continuum_project_history
set founder_corrected_fields = '{}'::text[]
where founder_corrected_fields is null;

alter table public.continuum_project_history
  alter column founder_corrected_fields set default '{}'::text[];

alter table public.continuum_project_history
  alter column founder_corrected_fields set not null;

alter table public.continuum_project_history
  drop constraint if exists continuum_project_history_founder_corrected_fields_check;

alter table public.continuum_project_history
  add constraint continuum_project_history_founder_corrected_fields_check
  check (
    founder_corrected_fields <@ array[
      'finger_size',
      'order_number',
      'cad_job_number',
      'metal',
      'center_stone',
      'diamond_supply_notes'
    ]::text[]
  );

comment on column public.continuum_project_history.founder_corrected_fields is
  'Field-level founder authority. Import must not overwrite listed current spec fields.';

create table if not exists public.continuum_project_history_revisions (
  id uuid primary key,
  project_id uuid not null references public.continuum_project_history (project_id),
  mutation_id uuid not null,
  field_name text not null check (
    field_name in (
      'finger_size',
      'order_number',
      'cad_job_number',
      'metal',
      'center_stone',
      'diamond_supply_notes'
    )
  ),
  prior_value text,
  new_value text,
  source_system text not null,
  changed_at timestamptz not null,
  changed_by text not null
);

create unique index if not exists continuum_project_history_revisions_mutation_uq
  on public.continuum_project_history_revisions (mutation_id);

create index if not exists continuum_project_history_revisions_project_idx
  on public.continuum_project_history_revisions (project_id, changed_at desc);

comment on table public.continuum_project_history_revisions is
  'Protected prior project-spec values. PII plane only. Not a second current snapshot. Not a public API.';

alter table public.continuum_project_history_revisions enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

create or replace function public.continuum_client_memory_correct_project_spec(
  p_project_id uuid,
  p_mutation_id uuid,
  p_revision_id uuid,
  p_field_name text,
  p_new_value text,
  p_changed_at timestamptz,
  p_changed_by text,
  p_source_system text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_kind text;
  history_row public.continuum_project_history%rowtype;
  existing_rev public.continuum_project_history_revisions%rowtype;
  next_value text;
  prior_value text;
  current_value text;
begin
  if p_project_id is null or p_mutation_id is null or p_revision_id is null
    or p_field_name is null or p_changed_at is null
    or p_changed_by is null or btrim(p_changed_by) = ''
    or p_source_system is null or btrim(p_source_system) = '' then
    raise exception 'invalid-input';
  end if;

  if p_field_name not in (
    'finger_size',
    'order_number',
    'cad_job_number',
    'metal',
    'center_stone',
    'diamond_supply_notes'
  ) then
    raise exception 'invalid-field';
  end if;

  if p_new_value is null or btrim(p_new_value) = '' then
    raise exception 'invalid-value';
  end if;

  next_value := btrim(p_new_value);

  if p_field_name = 'finger_size' then
    if next_value !~ '^(?:[1-9]|[12]\d|30)(?:\.(?:0|00|25|5|50|75))?$' then
      raise exception 'implausible-finger-size';
    end if;
  elsif p_field_name in ('order_number', 'cad_job_number') then
    if char_length(next_value) > 64 or next_value ~ '[\x00-\x1F\x7F]' then
      raise exception 'invalid-value';
    end if;
  elsif p_field_name in ('metal', 'center_stone') then
    if char_length(next_value) > 120 or next_value ~ '[\x00-\x1F\x7F]' then
      raise exception 'invalid-value';
    end if;
  elsif p_field_name = 'diamond_supply_notes' then
    if char_length(next_value) > 2000 or next_value ~ '[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]' then
      raise exception 'invalid-value';
    end if;
  end if;

  select *
    into existing_rev
  from public.continuum_project_history_revisions
  where mutation_id = p_mutation_id;

  if found then
    select *
      into history_row
    from public.continuum_project_history
    where project_id = existing_rev.project_id;
    return jsonb_build_object(
      'status', 'already-present',
      'history', to_jsonb(history_row),
      'revision_id', existing_rev.id
    );
  end if;

  select kind
    into entity_kind
  from public.continuum_entities
  where id = p_project_id;

  if not found then
    raise exception 'project-not-found';
  end if;
  if entity_kind <> 'project' then
    raise exception 'entity-kind-mismatch';
  end if;

  select *
    into history_row
  from public.continuum_project_history
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'project-history-not-found';
  end if;

  if p_field_name = 'finger_size' then
    current_value := history_row.finger_size;
  elsif p_field_name = 'order_number' then
    current_value := history_row.order_number;
  elsif p_field_name = 'cad_job_number' then
    current_value := history_row.cad_job_number;
  elsif p_field_name = 'metal' then
    current_value := history_row.metal;
  elsif p_field_name = 'center_stone' then
    current_value := history_row.center_stone;
  else
    current_value := history_row.diamond_supply_notes;
  end if;

  if current_value is not distinct from next_value then
    return jsonb_build_object(
      'status', 'already-present',
      'history', to_jsonb(history_row),
      'revision_id', null
    );
  end if;

  prior_value := current_value;

  begin
    insert into public.continuum_project_history_revisions (
      id,
      project_id,
      mutation_id,
      field_name,
      prior_value,
      new_value,
      source_system,
      changed_at,
      changed_by
    ) values (
      p_revision_id,
      history_row.project_id,
      p_mutation_id,
      p_field_name,
      prior_value,
      next_value,
      btrim(p_source_system),
      p_changed_at,
      btrim(p_changed_by)
    );
  exception
    when unique_violation then
      select *
        into existing_rev
      from public.continuum_project_history_revisions
      where mutation_id = p_mutation_id;
      select *
        into history_row
      from public.continuum_project_history
      where project_id = existing_rev.project_id;
      return jsonb_build_object(
        'status', 'already-present',
        'history', to_jsonb(history_row),
        'revision_id', existing_rev.id
      );
  end;

  if p_field_name = 'finger_size' then
    update public.continuum_project_history
    set
      finger_size = next_value,
      founder_corrected_fields = case
        when 'finger_size' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'finger_size'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'order_number' then
    update public.continuum_project_history
    set
      order_number = next_value,
      founder_corrected_fields = case
        when 'order_number' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'order_number'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'cad_job_number' then
    update public.continuum_project_history
    set
      cad_job_number = next_value,
      founder_corrected_fields = case
        when 'cad_job_number' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'cad_job_number'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'metal' then
    update public.continuum_project_history
    set
      metal = next_value,
      founder_corrected_fields = case
        when 'metal' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'metal'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'center_stone' then
    update public.continuum_project_history
    set
      center_stone = next_value,
      founder_corrected_fields = case
        when 'center_stone' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'center_stone'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  else
    update public.continuum_project_history
    set
      diamond_supply_notes = next_value,
      founder_corrected_fields = case
        when 'diamond_supply_notes' = any (founder_corrected_fields) then founder_corrected_fields
        else founder_corrected_fields || 'diamond_supply_notes'
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  end if;

  select *
    into history_row
  from public.continuum_project_history
  where project_id = p_project_id;

  return jsonb_build_object(
    'status', 'updated',
    'history', to_jsonb(history_row),
    'revision_id', p_revision_id
  );
end;
$$;

revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from public;
revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from anon;
revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from authenticated;
grant execute on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) to service_role;
