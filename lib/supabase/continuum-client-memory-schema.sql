-- Continuum Client Memory V1 — activation package (schema version 2).
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION until the activation audit passes.
--
-- Depends on existing kernel tables in lib/supabase/continuum-schema.sql:
--   continuum_entities, continuum_external_identities, continuum_evidence
-- Service-role only. RLS enabled. NO anon/authenticated policies.

-- ---------------------------------------------------------------------------
-- Kernel identity_kind extension
-- Production continuum_external_identities (kernel SQL) defines an INLINE,
-- unnamed CHECK:
--   identity_kind in (
--     'hubspot_contact_id', 'email_hash', 'phone_hash', 'google_contact_id'
--   )
-- Postgres usually names that continuum_external_identities_identity_kind_check,
-- but this block locates the live constraint by catalog definition — it does
-- not guess the name. Existing rows remain valid. Active unique index
-- continuum_external_identities_active_uq is unchanged.
-- Do not add hubspot_deal_id.
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select c.conname as name
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'continuum_external_identities'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* 'identity_kind'
      and pg_get_constraintdef(c.oid) not like '%import_row_key%'
  loop
    execute format(
      'alter table public.continuum_external_identities drop constraint %I',
      rec.name
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'continuum_external_identities'
      and c.conname = 'continuum_external_identities_identity_kind_check'
  ) then
    alter table public.continuum_external_identities
      add constraint continuum_external_identities_identity_kind_check
      check (
        identity_kind in (
          'hubspot_contact_id',
          'email_hash',
          'phone_hash',
          'google_contact_id',
          'import_row_key'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Protected Person profile
-- ---------------------------------------------------------------------------

create table if not exists continuum_person_profiles (
  person_id uuid primary key references continuum_entities (id),
  display_name text not null,
  given_name text,
  family_name text,
  organization_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  country text,
  postal_code text,
  roles text[] not null default '{}' check (
    roles <@ array[
      'client',
      'prospect',
      'vendor-contact',
      'personal',
      'family',
      'friend',
      'business-contact'
    ]::text[]
  ),
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table continuum_person_profiles is
  'Protected one-to-one Person profile. Raw PII. Client is a role, not an entity.';

-- ---------------------------------------------------------------------------
-- Relationships
-- ---------------------------------------------------------------------------

create table if not exists continuum_relationships (
  id uuid primary key,
  from_entity_id uuid not null references continuum_entities (id),
  to_entity_id uuid not null references continuum_entities (id),
  kind text not null check (
    kind in (
      'spouse',
      'partner',
      'child',
      'parent',
      'family',
      'friend',
      'assistant',
      'business-partner',
      'referral',
      'gift-planning',
      'household-member',
      'client-project'
    )
  ),
  status text not null default 'active' check (
    status in ('active', 'ended', 'disputed')
  ),
  source_system text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  check (from_entity_id <> to_entity_id)
);

create index if not exists continuum_relationships_from_idx
  on continuum_relationships (from_entity_id);

create index if not exists continuum_relationships_to_idx
  on continuum_relationships (to_entity_id);

create unique index if not exists continuum_relationships_active_uq
  on continuum_relationships (from_entity_id, to_entity_id, kind)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Person facts
-- ---------------------------------------------------------------------------

create table if not exists continuum_person_facts (
  id uuid primary key,
  person_id uuid not null references continuum_entities (id),
  fact_type text not null,
  value jsonb not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  verification text,
  approval_status text not null check (
    approval_status in ('approved', 'pending-review', 'rejected')
  ),
  status text not null check (
    status in ('current', 'conflicting', 'superseded', 'candidate')
  ),
  visibility text not null default 'internal-only' check (
    visibility in ('internal-only', 'client-visible', 'household-visible')
  ),
  usage_permission text not null default 'unset' check (
    usage_permission in (
      'unset',
      'remember-only',
      'gift-planning-allowed',
      'partner-share-allowed'
    )
  ),
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_id uuid references continuum_person_facts (id),
  source_system text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists continuum_person_facts_person_idx
  on continuum_person_facts (person_id, fact_type, status);

create unique index if not exists continuum_person_facts_one_current_uq
  on continuum_person_facts (person_id, fact_type)
  where status = 'current';

comment on table continuum_person_facts is
  'Constrained person facts. No silent overwrite; at most one current row per person+type.';

-- ---------------------------------------------------------------------------
-- Source notes — always internal. No visibility column.
-- ---------------------------------------------------------------------------

create table if not exists continuum_source_notes (
  id uuid primary key,
  person_id uuid references continuum_entities (id),
  project_id uuid references continuum_entities (id),
  source_system text not null,
  source_artifact text not null,
  source_sheet text not null,
  source_field text not null,
  import_row_key text not null,
  gmail_thread_id text,
  note_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists continuum_source_notes_person_idx
  on continuum_source_notes (person_id);

create index if not exists continuum_source_notes_project_idx
  on continuum_source_notes (project_id);

create unique index if not exists continuum_source_notes_import_field_uq
  on continuum_source_notes (source_system, import_row_key, source_field);

comment on table continuum_source_notes is
  'Protected raw notes. Always internal. source_field distinguishes Notes vs Review Flag.';

-- ---------------------------------------------------------------------------
-- Wishes
-- ---------------------------------------------------------------------------

create table if not exists continuum_wishes (
  id uuid primary key,
  person_id uuid not null references continuum_entities (id),
  household_id uuid,
  project_id uuid references continuum_entities (id),
  related_fact_id uuid references continuum_person_facts (id),
  description text not null,
  category text,
  status text not null,
  visibility text not null default 'internal-only' check (
    visibility in ('internal-only', 'client-visible', 'household-visible')
  ),
  usage_permission text not null default 'unset' check (
    usage_permission in (
      'unset',
      'remember-only',
      'gift-planning-allowed',
      'partner-share-allowed'
    )
  ),
  source_system text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists continuum_wishes_person_idx
  on continuum_wishes (person_id);

-- ---------------------------------------------------------------------------
-- Project presentation (client-safe columns only) vs internal history
-- Financial/vendor fields are NOT stored here. QuickBooks remains later authority.
-- ---------------------------------------------------------------------------

create table if not exists continuum_project_profiles (
  project_id uuid primary key references continuum_entities (id),
  display_title text not null,
  visibility text not null default 'internal-only' check (
    visibility in ('internal-only', 'client-visible', 'household-visible')
  ),
  import_row_key text,
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table continuum_project_profiles is
  'Client-safe project presentation. Defaults internal-only. No cost/margin/PII.';

create unique index if not exists continuum_project_profiles_import_uq
  on continuum_project_profiles (source_system, import_row_key)
  where import_row_key is not null;

create table if not exists continuum_project_history (
  project_id uuid primary key references continuum_project_profiles (project_id),
  cad_job_number text,
  order_number text,
  gmail_thread_id text,
  match_judgment text check (
    match_judgment is null
    or match_judgment in ('exact', 'likely', 'ambiguous', 'no-exact')
  ),
  match_judgment_raw text,
  finger_size text,
  metal text,
  center_stone text,
  diamond_supply_notes text,
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table continuum_project_history is
  'Internal project history only. Finger/metal/stone/supply stay project-scoped. No financial ledger.';

-- ---------------------------------------------------------------------------
-- Identity reviews
-- ---------------------------------------------------------------------------

create table if not exists continuum_identity_reviews (
  id uuid primary key,
  status text not null check (
    status in ('open', 'resolved', 'suppressed')
  ),
  reason_code text not null,
  left_person_id uuid references continuum_entities (id),
  right_person_id uuid references continuum_entities (id),
  import_row_key text,
  issue_text text,
  resolution_text text,
  source_system text not null,
  created_at timestamptz not null default now()
);

create index if not exists continuum_identity_reviews_status_idx
  on continuum_identity_reviews (status, reason_code);

create unique index if not exists continuum_identity_reviews_import_reason_uq
  on continuum_identity_reviews (source_system, import_row_key, reason_code)
  where import_row_key is not null;

create table if not exists continuum_fact_evidence (
  fact_id uuid not null references continuum_person_facts (id),
  evidence_id uuid not null references continuum_evidence (id),
  primary key (fact_id, evidence_id)
);

create index if not exists continuum_fact_evidence_evidence_idx
  on continuum_fact_evidence (evidence_id);

create table if not exists continuum_wish_evidence (
  wish_id uuid not null references continuum_wishes (id),
  evidence_id uuid not null references continuum_evidence (id),
  primary key (wish_id, evidence_id)
);

create index if not exists continuum_wish_evidence_evidence_idx
  on continuum_wish_evidence (evidence_id);

alter table continuum_person_profiles enable row level security;
alter table continuum_relationships enable row level security;
alter table continuum_person_facts enable row level security;
alter table continuum_source_notes enable row level security;
alter table continuum_wishes enable row level security;
alter table continuum_project_profiles enable row level security;
alter table continuum_project_history enable row level security;
alter table continuum_identity_reviews enable row level security;
alter table continuum_fact_evidence enable row level security;
alter table continuum_wish_evidence enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

-- ---------------------------------------------------------------------------
-- Atomic Person create (single Postgres function = one transaction)
-- ---------------------------------------------------------------------------

create or replace function continuum_client_memory_create_person(
  p_entity_id uuid,
  p_created_at timestamptz,
  p_created_by text,
  p_profile jsonb,
  p_identities jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
begin
  begin
    insert into continuum_entities (id, kind, created_at, created_by)
    values (p_entity_id, 'person', p_created_at, p_created_by);
  exception
    when unique_violation then
      if exists (
        select 1 from continuum_entities
        where id = p_entity_id and kind = 'person'
      ) and exists (
        select 1 from continuum_person_profiles where person_id = p_entity_id
      ) then
        return jsonb_build_object('status', 'already-present', 'person_id', p_entity_id);
      end if;
      raise;
  end;

  insert into continuum_person_profiles (
    person_id, display_name, given_name, family_name, organization_name,
    email, phone, street_address, city, state, country, postal_code,
    roles, source_system, created_at, updated_at
  ) values (
    p_entity_id,
    p_profile->>'display_name',
    p_profile->>'given_name',
    p_profile->>'family_name',
    p_profile->>'organization_name',
    p_profile->>'email',
    p_profile->>'phone',
    p_profile->>'street_address',
    p_profile->>'city',
    p_profile->>'state',
    p_profile->>'country',
    p_profile->>'postal_code',
    coalesce(
      array(select jsonb_array_elements_text(p_profile->'roles')),
      '{}'::text[]
    ),
    p_profile->>'source_system',
    p_created_at,
    p_created_at
  );

  for ident in select value from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb))
  loop
    insert into continuum_external_identities (
      id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at
    ) values (
      (ident->>'id')::uuid,
      p_entity_id,
      ident->>'source_system',
      ident->>'identity_kind',
      ident->>'identifier',
      coalesce((ident->>'created_at')::timestamptz, p_created_at),
      null
    );
  end loop;

  return jsonb_build_object('status', 'inserted', 'person_id', p_entity_id);
end;
$$;

revoke all on function continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from public;
revoke all on function continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from anon;
revoke all on function continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from authenticated;

-- Existing-Person update: attach missing identities + populate blank profile
-- fields. Conflicting nonblank profile values raise and roll back.
create or replace function continuum_client_memory_apply_existing_person(
  p_person_id uuid,
  p_updated_at timestamptz,
  p_profile jsonb,
  p_identities jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ident jsonb;
  field text;
  incoming text;
  existing text;
  profile_fields text[] := array[
    'display_name', 'given_name', 'family_name', 'organization_name',
    'email', 'phone', 'street_address', 'city', 'state', 'country', 'postal_code'
  ];
begin
  if not exists (
    select 1 from continuum_entities
    where id = p_person_id and kind = 'person'
  ) then
    raise exception 'person entity missing';
  end if;

  perform 1 from continuum_person_profiles
    where person_id = p_person_id
    for update;

  foreach field in array profile_fields
  loop
    incoming := nullif(btrim(coalesce(p_profile->>field, '')), '');
    execute format(
      'select nullif(btrim(coalesce(%I, '''')), '''') from continuum_person_profiles where person_id = $1',
      field
    ) into existing using p_person_id;
    if incoming is null then
      continue;
    end if;
    if existing is null then
      execute format(
        'update continuum_person_profiles set %I = $1, updated_at = $2 where person_id = $3',
        field
      ) using incoming, p_updated_at, p_person_id;
    elsif lower(existing) <> lower(incoming) then
      raise exception 'profile_conflict:%', field;
    end if;
  end loop;

  for ident in select value from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb))
  loop
    begin
      insert into continuum_external_identities (
        id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at
      ) values (
        (ident->>'id')::uuid,
        p_person_id,
        ident->>'source_system',
        ident->>'identity_kind',
        ident->>'identifier',
        coalesce((ident->>'created_at')::timestamptz, p_updated_at),
        null
      );
    exception
      when unique_violation then
        if exists (
          select 1
          from continuum_external_identities
          where source_system = ident->>'source_system'
            and identity_kind = ident->>'identity_kind'
            and identifier = ident->>'identifier'
            and revoked_at is null
            and entity_id is distinct from p_person_id
        ) then
          raise exception 'identity_conflict';
        end if;
    end;
  end loop;

  return jsonb_build_object('status', 'applied', 'person_id', p_person_id);
end;
$$;

revoke all on function continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from public;
revoke all on function continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from anon;
revoke all on function continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from authenticated;
