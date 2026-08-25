-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Atomic Person contact overwrite: profile name/org/email/phone + email_hash/phone_hash
-- replacement. One transaction. Does not create a Person, merge People, or edit roles,
-- address, facts, notes, wishes, relationships, or HubSpot/Google/import identities.
-- Does not add anon/authenticated grants. RLS on continuum_person_profiles and
-- continuum_external_identities remains enabled.
-- Active unique index continuum_external_identities_active_uq is unchanged.

create or replace function public.continuum_client_memory_update_person_contact(
  p_person_id uuid,
  p_updated_at timestamptz,
  p_profile jsonb,
  p_identities jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident jsonb;
  ident_kind text;
  ident_hash text;
  next_display text;
begin
  if p_person_id is null or p_updated_at is null or p_profile is null then
    raise exception 'invalid-input';
  end if;

  next_display := nullif(btrim(coalesce(p_profile->>'display_name', '')), '');
  if next_display is null then
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

  perform 1
  from public.continuum_person_profiles
  where person_id = p_person_id
  for update;

  if not found then
    raise exception 'person-not-found';
  end if;

  for ident in select value from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb))
  loop
    ident_kind := ident->>'identity_kind';
    ident_hash := ident->>'identifier';
    if ident_kind not in ('email_hash', 'phone_hash')
      or ident_hash is null
      or btrim(ident_hash) = ''
    then
      raise exception 'invalid-input';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(ident_kind || ':' || ident_hash, 0));

    if exists (
      select 1
      from public.continuum_external_identities
      where identity_kind = ident_kind
        and identifier = ident_hash
        and revoked_at is null
        and entity_id is distinct from p_person_id
    ) then
      raise exception 'identity_conflict';
    end if;
  end loop;

  update public.continuum_person_profiles
  set
    display_name = next_display,
    given_name = nullif(btrim(coalesce(p_profile->>'given_name', '')), ''),
    family_name = nullif(btrim(coalesce(p_profile->>'family_name', '')), ''),
    organization_name = nullif(btrim(coalesce(p_profile->>'organization_name', '')), ''),
    email = nullif(btrim(coalesce(p_profile->>'email', '')), ''),
    phone = nullif(btrim(coalesce(p_profile->>'phone', '')), ''),
    updated_at = p_updated_at
  where person_id = p_person_id;

  for ident in select value from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb))
  loop
    ident_kind := ident->>'identity_kind';
    ident_hash := ident->>'identifier';

    update public.continuum_external_identities
    set revoked_at = p_updated_at
    where entity_id = p_person_id
      and identity_kind = ident_kind
      and revoked_at is null
      and identifier is distinct from ident_hash;

    begin
      if not exists (
        select 1
        from public.continuum_external_identities
        where entity_id = p_person_id
          and identity_kind = ident_kind
          and identifier = ident_hash
          and revoked_at is null
      ) then
        insert into public.continuum_external_identities (
          id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at
        ) values (
          (ident->>'id')::uuid,
          p_person_id,
          ident->>'source_system',
          ident_kind,
          ident_hash,
          coalesce((ident->>'created_at')::timestamptz, p_updated_at),
          null
        );
      end if;
    exception
      when unique_violation then
        if exists (
          select 1
          from public.continuum_external_identities
          where identity_kind = ident_kind
            and identifier = ident_hash
            and revoked_at is null
            and entity_id is distinct from p_person_id
        ) then
          raise exception 'identity_conflict';
        end if;
    end;
  end loop;

  return jsonb_build_object('status', 'updated', 'person_id', p_person_id);
end;
$$;

revoke all on function public.continuum_client_memory_update_person_contact(uuid, timestamptz, jsonb, jsonb) from public;
revoke all on function public.continuum_client_memory_update_person_contact(uuid, timestamptz, jsonb, jsonb) from anon;
revoke all on function public.continuum_client_memory_update_person_contact(uuid, timestamptz, jsonb, jsonb) from authenticated;
grant execute on function public.continuum_client_memory_update_person_contact(uuid, timestamptz, jsonb, jsonb) to service_role;
