-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #9 — explicit Project Lifecycle for Custom / Repair.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Lifecycle is founder-explicit. Does not infer from Kind, specs, CAD, order,
-- notes, Gmail, artifacts, reconstruction, or operating-detail fields.
-- Does not auto-advance. Does not create Open Jobs, waiting, CoS, or commercial state.
-- Kind changes do not delete, copy, or translate lifecycle rows.
-- Existence of a lifecycle row does not set Project Kind.
-- Does not add anon/authenticated grants. RLS remains enabled.
-- No dynamic SQL from field values.
-- No initial rows. No backfill.

create table if not exists public.continuum_project_lifecycle_states (
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  project_kind text not null,
  stage text,
  entered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, project_kind),
  constraint continuum_project_lifecycle_states_kind_check
    check (project_kind in ('custom_new_jewelry', 'repair_service')),
  constraint continuum_project_lifecycle_states_stage_check
    check (
      stage is null
      or (
        project_kind = 'custom_new_jewelry'
        and stage in (
          'discovery',
          'design',
          'cad',
          'client_approval',
          'production',
          'quality_control',
          'ready_for_delivery',
          'completed'
        )
      )
      or (
        project_kind = 'repair_service'
        and stage in (
          'intake',
          'evaluation',
          'estimate',
          'client_approval',
          'bench',
          'quality_control',
          'ready_for_return',
          'completed'
        )
      )
    ),
  constraint continuum_project_lifecycle_states_entered_check
    check (
      (stage is null and entered_at is null)
      or (stage is not null and entered_at is not null)
    )
);

comment on table public.continuum_project_lifecycle_states is
  'Canonical current Project Lifecycle state keyed by Project ID + Kind. Active row is the one matching current Project Kind. Other rows are dormant. Founder-explicit only. Not Open Jobs. Not commercial state.';

alter table public.continuum_project_lifecycle_states enable row level security;

create table if not exists public.continuum_project_lifecycle_events (
  event_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  project_kind text not null,
  prior_stage text,
  new_stage text,
  changed_at timestamptz not null,
  changed_by text not null,
  source_system text not null,
  mutation_id uuid not null,
  constraint continuum_project_lifecycle_events_kind_check
    check (project_kind in ('custom_new_jewelry', 'repair_service')),
  constraint continuum_project_lifecycle_events_prior_stage_check
    check (
      prior_stage is null
      or (
        project_kind = 'custom_new_jewelry'
        and prior_stage in (
          'discovery',
          'design',
          'cad',
          'client_approval',
          'production',
          'quality_control',
          'ready_for_delivery',
          'completed'
        )
      )
      or (
        project_kind = 'repair_service'
        and prior_stage in (
          'intake',
          'evaluation',
          'estimate',
          'client_approval',
          'bench',
          'quality_control',
          'ready_for_return',
          'completed'
        )
      )
    ),
  constraint continuum_project_lifecycle_events_new_stage_check
    check (
      new_stage is null
      or (
        project_kind = 'custom_new_jewelry'
        and new_stage in (
          'discovery',
          'design',
          'cad',
          'client_approval',
          'production',
          'quality_control',
          'ready_for_delivery',
          'completed'
        )
      )
      or (
        project_kind = 'repair_service'
        and new_stage in (
          'intake',
          'evaluation',
          'estimate',
          'client_approval',
          'bench',
          'quality_control',
          'ready_for_return',
          'completed'
        )
      )
    )
);

comment on table public.continuum_project_lifecycle_events is
  'Append-only Project Lifecycle transition history. Not a current-state source. Do not replay to compute current stage.';

create unique index if not exists continuum_project_lifecycle_events_mutation_uq
  on public.continuum_project_lifecycle_events (mutation_id);

create index if not exists continuum_project_lifecycle_events_project_kind_changed_idx
  on public.continuum_project_lifecycle_events (project_id, project_kind, changed_at desc);

alter table public.continuum_project_lifecycle_events enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

create or replace function public.continuum_client_memory_set_project_lifecycle(
  p_project_id uuid,
  p_stage text,
  p_mutation_id uuid,
  p_event_id uuid,
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
  existing_event public.continuum_project_lifecycle_events%rowtype;
  state_row public.continuum_project_lifecycle_states%rowtype;
  next_stage text;
  current_stage text;
  current_kind text;
begin
  if p_project_id is null or p_mutation_id is null or p_event_id is null
    or p_changed_at is null
    or p_changed_by is null or btrim(p_changed_by) = ''
    or p_source_system is null or btrim(p_source_system) = '' then
    raise exception 'invalid-input';
  end if;

  if p_stage is null or btrim(p_stage) = '' then
    next_stage := null;
  else
    next_stage := btrim(p_stage);
  end if;

  select *
    into existing_event
  from public.continuum_project_lifecycle_events
  where mutation_id = p_mutation_id;

  if found then
    select *
      into state_row
    from public.continuum_project_lifecycle_states
    where project_id = existing_event.project_id
      and project_kind = existing_event.project_kind;
    return jsonb_build_object(
      'status', 'already-present',
      'state', to_jsonb(state_row),
      'event_id', existing_event.event_id
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

  current_kind := profile_row.project_kind;

  if current_kind is distinct from 'custom_new_jewelry'
    and current_kind is distinct from 'repair_service' then
    raise exception 'unsupported-project-kind';
  end if;

  if next_stage is not null then
    if current_kind = 'custom_new_jewelry' then
      if next_stage not in (
        'discovery',
        'design',
        'cad',
        'client_approval',
        'production',
        'quality_control',
        'ready_for_delivery',
        'completed'
      ) then
        raise exception 'invalid-value';
      end if;
    else
      if next_stage not in (
        'intake',
        'evaluation',
        'estimate',
        'client_approval',
        'bench',
        'quality_control',
        'ready_for_return',
        'completed'
      ) then
        raise exception 'invalid-value';
      end if;
    end if;
  end if;

  select *
    into state_row
  from public.continuum_project_lifecycle_states
  where project_id = p_project_id
    and project_kind = current_kind
  for update;

  current_stage := state_row.stage;

  if current_stage is not distinct from next_stage then
    return jsonb_build_object(
      'status', 'already-present',
      'state', to_jsonb(state_row),
      'event_id', null
    );
  end if;

  begin
    insert into public.continuum_project_lifecycle_events (
      event_id,
      project_id,
      project_kind,
      prior_stage,
      new_stage,
      changed_at,
      changed_by,
      source_system,
      mutation_id
    ) values (
      p_event_id,
      profile_row.project_id,
      current_kind,
      current_stage,
      next_stage,
      p_changed_at,
      btrim(p_changed_by),
      btrim(p_source_system),
      p_mutation_id
    );
  exception
    when unique_violation then
      select *
        into existing_event
      from public.continuum_project_lifecycle_events
      where mutation_id = p_mutation_id;
      select *
        into state_row
      from public.continuum_project_lifecycle_states
      where project_id = existing_event.project_id
        and project_kind = existing_event.project_kind;
      return jsonb_build_object(
        'status', 'already-present',
        'state', to_jsonb(state_row),
        'event_id', existing_event.event_id
      );
  end;

  insert into public.continuum_project_lifecycle_states (
    project_id,
    project_kind,
    stage,
    entered_at,
    created_at,
    updated_at
  ) values (
    profile_row.project_id,
    current_kind,
    next_stage,
    case when next_stage is null then null else p_changed_at end,
    p_changed_at,
    p_changed_at
  )
  on conflict (project_id, project_kind) do update
    set
      stage = excluded.stage,
      entered_at = excluded.entered_at,
      updated_at = excluded.updated_at;

  select *
    into state_row
  from public.continuum_project_lifecycle_states
  where project_id = p_project_id
    and project_kind = current_kind;

  return jsonb_build_object(
    'status', 'updated',
    'state', to_jsonb(state_row),
    'event_id', p_event_id
  );
end;
$$;

revoke all on function public.continuum_client_memory_set_project_lifecycle(uuid, text, uuid, uuid, timestamptz, text, text) from public;
revoke all on function public.continuum_client_memory_set_project_lifecycle(uuid, text, uuid, uuid, timestamptz, text, text) from anon;
revoke all on function public.continuum_client_memory_set_project_lifecycle(uuid, text, uuid, uuid, timestamptz, text, text) from authenticated;
grant execute on function public.continuum_client_memory_set_project_lifecycle(uuid, text, uuid, uuid, timestamptz, text, text) to service_role;
