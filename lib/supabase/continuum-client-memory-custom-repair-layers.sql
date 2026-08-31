-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #8 — Custom / Repair Project operating-detail layers.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Optional 1:1 extensions keyed by project_id. Not new Projects. Not Person-scoped.
-- Does not auto-create rows. Does not backfill. Does not infer from title, email,
-- CAD, order, artifact, notes, reconstruction, Person, filename, or keywords.
-- Does not delete subtype rows when Project Kind changes.
-- Existence of a subtype row does not set Project Kind.
-- Does not create lifecycle, Open Jobs, pricing, or workflow stages.
-- Does not add anon/authenticated grants. RLS remains enabled.
-- No dynamic SQL from field values.

create table if not exists public.continuum_project_custom_details (
  project_id uuid primary key
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  design_brief text,
  design_requirements text,
  manufacturing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.continuum_project_custom_details is
  'Optional 1:1 Custom / New Jewelry operating details. Project ID is identity. Dormant if Kind is not custom_new_jewelry. Founder-explicit only. Not a lifecycle.';

alter table public.continuum_project_custom_details enable row level security;

create table if not exists public.continuum_project_repair_details (
  project_id uuid primary key
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  item_description text,
  requested_service text,
  condition_notes text,
  technical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.continuum_project_repair_details is
  'Optional 1:1 Repair / Service operating details. Project ID is identity. Dormant if Kind is not repair_service. Founder-explicit only. Not a lifecycle.';

alter table public.continuum_project_repair_details enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

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
      'project_kind',
      'custom_design_brief',
      'custom_design_requirements',
      'custom_manufacturing_notes',
      'repair_item_description',
      'repair_requested_service',
      'repair_condition_notes',
      'repair_technical_notes'
    )
  );

create or replace function public.continuum_client_memory_correct_project_operating_detail(
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
  profile_row public.continuum_project_profiles%rowtype;
  existing_rev public.continuum_project_history_revisions%rowtype;
  custom_row public.continuum_project_custom_details%rowtype;
  repair_row public.continuum_project_repair_details%rowtype;
  history_exists boolean;
  next_value text;
  current_value text;
  required_kind text;
begin
  if p_project_id is null or p_mutation_id is null or p_revision_id is null
    or p_field_name is null or p_changed_at is null
    or p_changed_by is null or btrim(p_changed_by) = ''
    or p_source_system is null or btrim(p_source_system) = '' then
    raise exception 'invalid-input';
  end if;

  if p_field_name not in (
    'custom_design_brief',
    'custom_design_requirements',
    'custom_manufacturing_notes',
    'repair_item_description',
    'repair_requested_service',
    'repair_condition_notes',
    'repair_technical_notes'
  ) then
    raise exception 'invalid-field';
  end if;

  if p_field_name in (
    'custom_design_brief',
    'custom_design_requirements',
    'custom_manufacturing_notes'
  ) then
    required_kind := 'custom_new_jewelry';
  else
    required_kind := 'repair_service';
  end if;

  if p_new_value is null or btrim(p_new_value) = '' then
    next_value := null;
  else
    next_value := btrim(p_new_value);
    if char_length(next_value) > 4000 then
      raise exception 'invalid-value';
    end if;
    if position(chr(0) in next_value) > 0 then
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
    select *
      into custom_row
    from public.continuum_project_custom_details
    where project_id = existing_rev.project_id;
    select *
      into repair_row
    from public.continuum_project_repair_details
    where project_id = existing_rev.project_id;
    return jsonb_build_object(
      'status', 'already-present',
      'custom_details', to_jsonb(custom_row),
      'repair_details', to_jsonb(repair_row),
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

  if profile_row.project_kind is distinct from required_kind then
    raise exception 'wrong-project-kind';
  end if;

  if required_kind = 'custom_new_jewelry' then
    select *
      into custom_row
    from public.continuum_project_custom_details
    where project_id = p_project_id
    for update;

    if p_field_name = 'custom_design_brief' then
      current_value := custom_row.design_brief;
    elsif p_field_name = 'custom_design_requirements' then
      current_value := custom_row.design_requirements;
    else
      current_value := custom_row.manufacturing_notes;
    end if;
  else
    select *
      into repair_row
    from public.continuum_project_repair_details
    where project_id = p_project_id
    for update;

    if p_field_name = 'repair_item_description' then
      current_value := repair_row.item_description;
    elsif p_field_name = 'repair_requested_service' then
      current_value := repair_row.requested_service;
    elsif p_field_name = 'repair_condition_notes' then
      current_value := repair_row.condition_notes;
    else
      current_value := repair_row.technical_notes;
    end if;
  end if;

  if current_value is not distinct from next_value then
    return jsonb_build_object(
      'status', 'already-present',
      'custom_details', to_jsonb(custom_row),
      'repair_details', to_jsonb(repair_row),
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
      p_field_name,
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
        into custom_row
      from public.continuum_project_custom_details
      where project_id = existing_rev.project_id;
      select *
        into repair_row
      from public.continuum_project_repair_details
      where project_id = existing_rev.project_id;
      return jsonb_build_object(
        'status', 'already-present',
        'custom_details', to_jsonb(custom_row),
        'repair_details', to_jsonb(repair_row),
        'revision_id', existing_rev.id
      );
  end;

  if required_kind = 'custom_new_jewelry' then
    insert into public.continuum_project_custom_details (
      project_id,
      design_brief,
      design_requirements,
      manufacturing_notes,
      created_at,
      updated_at
    ) values (
      profile_row.project_id,
      case when p_field_name = 'custom_design_brief' then next_value else null end,
      case when p_field_name = 'custom_design_requirements' then next_value else null end,
      case when p_field_name = 'custom_manufacturing_notes' then next_value else null end,
      p_changed_at,
      p_changed_at
    )
    on conflict (project_id) do update
      set
        design_brief = case
          when p_field_name = 'custom_design_brief' then excluded.design_brief
          else public.continuum_project_custom_details.design_brief
        end,
        design_requirements = case
          when p_field_name = 'custom_design_requirements' then excluded.design_requirements
          else public.continuum_project_custom_details.design_requirements
        end,
        manufacturing_notes = case
          when p_field_name = 'custom_manufacturing_notes' then excluded.manufacturing_notes
          else public.continuum_project_custom_details.manufacturing_notes
        end,
        updated_at = excluded.updated_at;

    select *
      into custom_row
    from public.continuum_project_custom_details
    where project_id = p_project_id;
  else
    insert into public.continuum_project_repair_details (
      project_id,
      item_description,
      requested_service,
      condition_notes,
      technical_notes,
      created_at,
      updated_at
    ) values (
      profile_row.project_id,
      case when p_field_name = 'repair_item_description' then next_value else null end,
      case when p_field_name = 'repair_requested_service' then next_value else null end,
      case when p_field_name = 'repair_condition_notes' then next_value else null end,
      case when p_field_name = 'repair_technical_notes' then next_value else null end,
      p_changed_at,
      p_changed_at
    )
    on conflict (project_id) do update
      set
        item_description = case
          when p_field_name = 'repair_item_description' then excluded.item_description
          else public.continuum_project_repair_details.item_description
        end,
        requested_service = case
          when p_field_name = 'repair_requested_service' then excluded.requested_service
          else public.continuum_project_repair_details.requested_service
        end,
        condition_notes = case
          when p_field_name = 'repair_condition_notes' then excluded.condition_notes
          else public.continuum_project_repair_details.condition_notes
        end,
        technical_notes = case
          when p_field_name = 'repair_technical_notes' then excluded.technical_notes
          else public.continuum_project_repair_details.technical_notes
        end,
        updated_at = excluded.updated_at;

    select *
      into repair_row
    from public.continuum_project_repair_details
    where project_id = p_project_id;
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'custom_details', to_jsonb(custom_row),
    'repair_details', to_jsonb(repair_row),
    'revision_id', p_revision_id
  );
end;
$$;

revoke all on function public.continuum_client_memory_correct_project_operating_detail(uuid, uuid, uuid, text, text, timestamptz, text, text) from public;
revoke all on function public.continuum_client_memory_correct_project_operating_detail(uuid, uuid, uuid, text, text, timestamptz, text, text) from anon;
revoke all on function public.continuum_client_memory_correct_project_operating_detail(uuid, uuid, uuid, text, text, timestamptz, text, text) from authenticated;
grant execute on function public.continuum_client_memory_correct_project_operating_detail(uuid, uuid, uuid, text, text, timestamptz, text, text) to service_role;
