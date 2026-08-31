-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #7 — explicit Project Kind on the canonical Project profile.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Does not create a parallel Project Kind table.
-- Does not backfill or infer historical categories.
-- Does not modify Person linkage, specs, CAD, order, lifecycle, Open Jobs, or CoS.
-- Does not add anon/authenticated grants. RLS remains enabled.
-- No dynamic SQL from field values.

alter table public.continuum_project_profiles
  add column if not exists project_kind text;

alter table public.continuum_project_profiles
  drop constraint if exists continuum_project_profiles_project_kind_check;

alter table public.continuum_project_profiles
  add constraint continuum_project_profiles_project_kind_check
  check (
    project_kind is null
    or project_kind in (
      'custom_new_jewelry',
      'repair_service',
      'loose_stone_sourcing',
      'consultation_opportunity',
      'other'
    )
  );

comment on column public.continuum_project_profiles.project_kind is
  'Founder-explicit Project Kind. NULL means unclassified / not set. Other is an explicit choice. Not inferred from title, email, CAD, order, or reconstruction. Not a lifecycle.';

alter table public.continuum_project_history_revisions
  drop constraint if exists continuum_project_history_revisions_field_name_check;

alter table public.continuum_project_history_revisions
  add constraint continuum_project_history_revisions_field_name_check
  check (
    field_name in (
      'finger_size',
      'order_number',
      'cad_job_number',
      'metal',
      'center_stone',
      'diamond_supply_notes',
      'project_kind'
    )
  );

create or replace function public.continuum_client_memory_correct_project_kind(
  p_project_id uuid,
  p_mutation_id uuid,
  p_revision_id uuid,
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
  profile_row public.continuum_project_profiles%rowtype;
  existing_rev public.continuum_project_history_revisions%rowtype;
  history_exists boolean;
  next_value text;
  current_value text;
begin
  if p_project_id is null or p_mutation_id is null or p_revision_id is null
    or p_changed_at is null
    or p_changed_by is null or btrim(p_changed_by) = ''
    or p_source_system is null or btrim(p_source_system) = '' then
    raise exception 'invalid-input';
  end if;

  if p_new_value is null or btrim(p_new_value) = '' then
    next_value := null;
  else
    next_value := btrim(p_new_value);
    if next_value not in (
      'custom_new_jewelry',
      'repair_service',
      'loose_stone_sourcing',
      'consultation_opportunity',
      'other'
    ) then
      raise exception 'invalid-value';
    end if;
  end if;

  select *
    into existing_rev
  from public.continuum_project_history_revisions
  where mutation_id = p_mutation_id;

  if found then
    select *
      into profile_row
    from public.continuum_project_profiles
    where project_id = existing_rev.project_id;
    return jsonb_build_object(
      'status', 'already-present',
      'profile', to_jsonb(profile_row),
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
    into profile_row
  from public.continuum_project_profiles
  where project_id = p_project_id
  for update;

  if not found then
    raise exception 'project-not-found';
  end if;

  select exists (
    select 1
    from public.continuum_project_history
    where project_id = p_project_id
  )
    into history_exists;

  if not history_exists then
    raise exception 'project-history-not-found';
  end if;

  current_value := profile_row.project_kind;

  if current_value is not distinct from next_value then
    return jsonb_build_object(
      'status', 'already-present',
      'profile', to_jsonb(profile_row),
      'revision_id', null
    );
  end if;

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
      profile_row.project_id,
      p_mutation_id,
      'project_kind',
      current_value,
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
        into profile_row
      from public.continuum_project_profiles
      where project_id = existing_rev.project_id;
      return jsonb_build_object(
        'status', 'already-present',
        'profile', to_jsonb(profile_row),
        'revision_id', existing_rev.id
      );
  end;

  update public.continuum_project_profiles
  set
    project_kind = next_value,
    updated_at = p_changed_at
  where project_id = profile_row.project_id;

  select *
    into profile_row
  from public.continuum_project_profiles
  where project_id = p_project_id;

  return jsonb_build_object(
    'status', 'updated',
    'profile', to_jsonb(profile_row),
    'revision_id', p_revision_id
  );
end;
$$;

revoke all on function public.continuum_client_memory_correct_project_kind(uuid, uuid, uuid, text, timestamptz, text, text) from public;
revoke all on function public.continuum_client_memory_correct_project_kind(uuid, uuid, uuid, text, timestamptz, text, text) from anon;
revoke all on function public.continuum_client_memory_correct_project_kind(uuid, uuid, uuid, text, timestamptz, text, text) from authenticated;
grant execute on function public.continuum_client_memory_correct_project_kind(uuid, uuid, uuid, text, timestamptz, text, text) to service_role;
