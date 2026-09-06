-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Smallest CREATE OR REPLACE for continuum_client_memory_correct_project_spec.
-- Fixes malformed array literal: "cad_job_number" (and the other five allow-listed
-- fields) caused by concatenating text[] with a scalar text field name.
-- Uses array_append so Postgres does not cast the field name as an array literal.
-- Does not change tables, signature, SECURITY DEFINER, search_path, validation,
-- mutation_id semantics, revision creation, grants, RLS, or founder_corrected_fields
-- provenance. CREATE OR REPLACE only. Do not drop the function.

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
        else array_append(founder_corrected_fields, 'finger_size')
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'order_number' then
    update public.continuum_project_history
    set
      order_number = next_value,
      founder_corrected_fields = case
        when 'order_number' = any (founder_corrected_fields) then founder_corrected_fields
        else array_append(founder_corrected_fields, 'order_number')
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'cad_job_number' then
    update public.continuum_project_history
    set
      cad_job_number = next_value,
      founder_corrected_fields = case
        when 'cad_job_number' = any (founder_corrected_fields) then founder_corrected_fields
        else array_append(founder_corrected_fields, 'cad_job_number')
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'metal' then
    update public.continuum_project_history
    set
      metal = next_value,
      founder_corrected_fields = case
        when 'metal' = any (founder_corrected_fields) then founder_corrected_fields
        else array_append(founder_corrected_fields, 'metal')
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  elsif p_field_name = 'center_stone' then
    update public.continuum_project_history
    set
      center_stone = next_value,
      founder_corrected_fields = case
        when 'center_stone' = any (founder_corrected_fields) then founder_corrected_fields
        else array_append(founder_corrected_fields, 'center_stone')
      end,
      updated_at = p_changed_at
    where project_id = history_row.project_id;
  else
    update public.continuum_project_history
    set
      diamond_supply_notes = next_value,
      founder_corrected_fields = case
        when 'diamond_supply_notes' = any (founder_corrected_fields) then founder_corrected_fields
        else array_append(founder_corrected_fields, 'diamond_supply_notes')
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
