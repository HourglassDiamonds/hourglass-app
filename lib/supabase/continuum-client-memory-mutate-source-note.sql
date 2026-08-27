-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Atomic source-note mutation. One transaction: revision of prior state + current-row update.
-- Same note id for edit, move, trash, restore, keep, and absorb.
-- Does not create a corrected copy. Does not free import identity on trash.
-- Does not write Facts, Wishes, Human Intake, Gmail, Digital Card, CoS, or kernel Event/Evidence/Observation.
-- Does not add anon/authenticated grants. RLS on notes and revisions remains enabled.

create or replace function public.continuum_client_memory_mutate_source_note(
  p_note_id uuid,
  p_mutation_id uuid,
  p_change_kind text,
  p_edited_at timestamptz,
  p_edited_by text,
  p_revision_id uuid,
  p_note_text text,
  p_person_id uuid,
  p_project_id uuid,
  p_context_layer text,
  p_cross_person_confirmed boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  note_row public.continuum_source_notes%rowtype;
  existing_rev public.continuum_source_note_revisions%rowtype;
  person_kind text;
  project_kind text;
  linked boolean;
  next_text text;
  next_person uuid;
  next_project uuid;
  next_context text;
  next_lifecycle text;
  next_deleted timestamptz;
  next_previous text;
  restore_to text;
begin
  if p_note_id is null or p_mutation_id is null or p_revision_id is null
    or p_change_kind is null or p_edited_at is null
    or p_edited_by is null or btrim(p_edited_by) = '' then
    raise exception 'invalid-input';
  end if;

  if p_change_kind not in ('edit', 'move', 'trash', 'restore', 'absorb', 'keep') then
    raise exception 'invalid-input';
  end if;

  select *
    into existing_rev
  from public.continuum_source_note_revisions
  where mutation_id = p_mutation_id;

  if found then
    select *
      into note_row
    from public.continuum_source_notes
    where id = existing_rev.note_id;
    return jsonb_build_object(
      'status', 'already-present',
      'note', to_jsonb(note_row),
      'revision_id', existing_rev.id
    );
  end if;

  select *
    into note_row
  from public.continuum_source_notes
  where id = p_note_id
  for update;

  if not found then
    raise exception 'note-not-found';
  end if;

  next_text := note_row.note_text;
  next_person := note_row.person_id;
  next_project := note_row.project_id;
  next_context := note_row.context_layer;
  next_lifecycle := note_row.lifecycle_status;
  next_deleted := note_row.deleted_at;
  next_previous := note_row.previous_lifecycle;

  if p_change_kind = 'edit' then
    if note_row.lifecycle_status = 'trashed' then
      raise exception 'not-editable';
    end if;
    if p_note_text is null or btrim(p_note_text) = '' then
      raise exception 'empty-note';
    end if;
    if char_length(btrim(p_note_text)) > 10000 then
      raise exception 'oversized-note';
    end if;
    next_text := btrim(p_note_text);

  elsif p_change_kind = 'move' then
    if note_row.lifecycle_status = 'trashed' then
      raise exception 'not-editable';
    end if;
    if p_person_id is null or p_context_layer is null then
      raise exception 'invalid-input';
    end if;
    if p_context_layer not in ('client', 'networking', 'personal') then
      raise exception 'invalid-context';
    end if;

    select kind
      into person_kind
    from public.continuum_entities
    where id = p_person_id;
    if not found or person_kind <> 'person' then
      raise exception 'person-not-found';
    end if;

    if p_project_id is not null then
      if p_context_layer <> 'client' then
        raise exception 'project-not-allowed';
      end if;
      select kind
        into project_kind
      from public.continuum_entities
      where id = p_project_id;
      if not found then
        raise exception 'project-not-linked';
      end if;
      if project_kind <> 'project' then
        raise exception 'entity-kind-mismatch';
      end if;
      linked := exists (
        select 1
        from public.continuum_relationships
        where kind = 'client-project'
          and status = 'active'
          and (
            (from_entity_id = p_person_id and to_entity_id = p_project_id)
            or (from_entity_id = p_project_id and to_entity_id = p_person_id)
          )
      );
      if not linked then
        raise exception 'project-not-linked';
      end if;
    end if;

    if note_row.person_id is distinct from p_person_id
      and coalesce(p_cross_person_confirmed, false) is not true then
      raise exception 'cross-person-unconfirmed';
    end if;

    next_person := p_person_id;
    next_project := p_project_id;
    next_context := p_context_layer;

  elsif p_change_kind = 'trash' then
    if note_row.lifecycle_status = 'trashed' then
      return jsonb_build_object(
        'status', 'already-present',
        'note', to_jsonb(note_row),
        'revision_id', null
      );
    end if;
    next_previous := note_row.lifecycle_status;
    next_lifecycle := 'trashed';
    next_deleted := p_edited_at;

  elsif p_change_kind = 'restore' then
    if note_row.lifecycle_status <> 'trashed' then
      raise exception 'not-trashed';
    end if;
    restore_to := note_row.previous_lifecycle;
    if restore_to is null or restore_to = 'trashed' then
      if note_row.source_system = 'concierge-manual' then
        restore_to := 'kept';
      else
        restore_to := 'absorbed';
      end if;
    end if;
    next_lifecycle := restore_to;
    next_previous := 'trashed';
    next_deleted := null;

  elsif p_change_kind = 'keep' then
    if note_row.lifecycle_status = 'trashed' then
      raise exception 'not-editable';
    end if;
    next_previous := note_row.lifecycle_status;
    next_lifecycle := 'kept';
    next_deleted := null;

  elsif p_change_kind = 'absorb' then
    if note_row.lifecycle_status = 'trashed' then
      raise exception 'not-editable';
    end if;
    next_previous := note_row.lifecycle_status;
    next_lifecycle := 'absorbed';
    next_deleted := null;
  end if;

  if next_text is not distinct from note_row.note_text
    and next_person is not distinct from note_row.person_id
    and next_project is not distinct from note_row.project_id
    and next_context is not distinct from note_row.context_layer
    and next_lifecycle is not distinct from note_row.lifecycle_status
    and next_deleted is not distinct from note_row.deleted_at
    and next_previous is not distinct from note_row.previous_lifecycle then
    return jsonb_build_object(
      'status', 'already-present',
      'note', to_jsonb(note_row),
      'revision_id', null
    );
  end if;

  begin
    insert into public.continuum_source_note_revisions (
      id,
      note_id,
      mutation_id,
      note_text,
      person_id,
      project_id,
      context_layer,
      lifecycle_status,
      change_kind,
      edited_at,
      edited_by
    ) values (
      p_revision_id,
      note_row.id,
      p_mutation_id,
      note_row.note_text,
      note_row.person_id,
      note_row.project_id,
      note_row.context_layer,
      note_row.lifecycle_status,
      p_change_kind,
      p_edited_at,
      p_edited_by
    );
  exception
    when unique_violation then
      select *
        into existing_rev
      from public.continuum_source_note_revisions
      where mutation_id = p_mutation_id;
      select *
        into note_row
      from public.continuum_source_notes
      where id = existing_rev.note_id;
      return jsonb_build_object(
        'status', 'already-present',
        'note', to_jsonb(note_row),
        'revision_id', existing_rev.id
      );
  end;

  update public.continuum_source_notes
  set
    note_text = next_text,
    person_id = next_person,
    project_id = next_project,
    context_layer = next_context,
    lifecycle_status = next_lifecycle,
    deleted_at = next_deleted,
    previous_lifecycle = next_previous,
    updated_at = p_edited_at,
    updated_by = p_edited_by
  where id = note_row.id;

  select *
    into note_row
  from public.continuum_source_notes
  where id = p_note_id;

  return jsonb_build_object(
    'status', 'updated',
    'note', to_jsonb(note_row),
    'revision_id', p_revision_id
  );
end;
$$;

revoke all on function public.continuum_client_memory_mutate_source_note(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean) from public;
revoke all on function public.continuum_client_memory_mutate_source_note(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean) from anon;
revoke all on function public.continuum_client_memory_mutate_source_note(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean) from authenticated;
grant execute on function public.continuum_client_memory_mutate_source_note(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean) to service_role;
