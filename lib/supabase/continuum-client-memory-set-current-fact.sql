-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Atomic set-current Person fact. One transaction: supersede prior current, insert new current.
-- Does not create Evidence, Observation, Wish, Note, Relationship, Project, or Person.
-- Does not add anon/authenticated grants. RLS on continuum_person_facts remains enabled.
-- Unique index continuum_person_facts_one_current_uq is unchanged.

create or replace function public.continuum_client_memory_set_current_person_fact(
  p_fact_id uuid,
  p_person_id uuid,
  p_fact_type text,
  p_value jsonb,
  p_confidence numeric,
  p_verification text,
  p_approval_status text,
  p_visibility text,
  p_usage_permission text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_source_system text,
  p_created_at timestamptz,
  p_created_by text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.continuum_person_facts%rowtype;
  current_row public.continuum_person_facts%rowtype;
  created public.continuum_person_facts%rowtype;
  supersedes uuid;
begin
  if p_fact_id is null or p_person_id is null or p_fact_type is null or p_value is null then
    raise exception 'invalid-input';
  end if;

  if not exists (
    select 1
    from public.continuum_entities
    where id = p_person_id
      and kind = 'person'
  ) then
    raise exception 'person-not-found';
  end if;

  select *
    into existing
  from public.continuum_person_facts
  where id = p_fact_id;

  if found then
    if existing.person_id is distinct from p_person_id
      or existing.fact_type is distinct from p_fact_type
      or existing.value is distinct from p_value
    then
      raise exception 'fact-id-conflict';
    end if;
    return jsonb_build_object(
      'status', 'already-present',
      'fact', to_jsonb(existing)
    );
  end if;

  select *
    into current_row
  from public.continuum_person_facts
  where person_id = p_person_id
    and fact_type = p_fact_type
    and status = 'current'
  for update;

  if found then
    if current_row.value = p_value then
      return jsonb_build_object(
        'status', 'already-present',
        'fact', to_jsonb(current_row)
      );
    end if;
    update public.continuum_person_facts
    set status = 'superseded'
    where id = current_row.id;
    supersedes := current_row.id;
  else
    supersedes := null;
  end if;

  insert into public.continuum_person_facts (
    id,
    person_id,
    fact_type,
    value,
    confidence,
    verification,
    approval_status,
    status,
    visibility,
    usage_permission,
    valid_from,
    valid_until,
    supersedes_id,
    source_system,
    created_at,
    created_by
  ) values (
    p_fact_id,
    p_person_id,
    p_fact_type,
    p_value,
    p_confidence,
    p_verification,
    p_approval_status,
    'current',
    p_visibility,
    p_usage_permission,
    p_valid_from,
    p_valid_until,
    supersedes,
    p_source_system,
    coalesce(p_created_at, now()),
    p_created_by
  )
  returning * into created;

  return jsonb_build_object(
    'status', 'inserted',
    'fact', to_jsonb(created)
  );
end;
$$;

revoke all on function public.continuum_client_memory_set_current_person_fact(uuid, uuid, text, jsonb, numeric, text, text, text, text, timestamptz, timestamptz, text, timestamptz, text) from public;
revoke all on function public.continuum_client_memory_set_current_person_fact(uuid, uuid, text, jsonb, numeric, text, text, text, text, timestamptz, timestamptz, text, timestamptz, text) from anon;
revoke all on function public.continuum_client_memory_set_current_person_fact(uuid, uuid, text, jsonb, numeric, text, text, text, text, timestamptz, timestamptz, text, timestamptz, text) from authenticated;
grant execute on function public.continuum_client_memory_set_current_person_fact(uuid, uuid, text, jsonb, numeric, text, text, text, text, timestamptz, timestamptz, text, timestamptz, text) to service_role;
