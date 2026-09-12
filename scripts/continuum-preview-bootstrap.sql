-- ============================================================================
-- CONTINUUM PREVIEW SANDBOX ONLY
-- ============================================================================
-- Target Supabase project ref (required): hrmpzplffuhhvbtxxhnt
-- Production project ref (FORBIDDEN):    bnafadfgrrriblppeubp
-- Project name expected: Continuum Preview
-- Region expected: East US / North Virginia
--
-- Do NOT run this file against Production.
-- Do NOT copy production customer data.
-- Do NOT enable Gmail incremental sync from this file.
-- This bundle concatenates existing repository SQL in dependency order.
-- It contains no secrets, tokens, connection strings, or customer rows.
--
-- Founder SQL Editor steps:
--   1. Open https://supabase.com/dashboard/project/hrmpzplffuhhvbtxxhnt
--   2. Confirm the browser URL project ref is exactly hrmpzplffuhhvbtxxhnt
--   3. Confirm it is NOT bnafadfgrrriblppeubp
--   4. SQL Editor -> New query -> paste this entire file -> Run
--   5. Confirm the verification SELECT at the end returns present=true
--      for every required table/function.
-- ============================================================================

DO $preview_sandbox_guard$
DECLARE
  has_rows boolean;
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'Preview sandbox bootstrap refused: no current database.';
  END IF;

  -- Empty-database safety. Do not statically SELECT FROM a relation that may
  -- not exist: PostgreSQL boolean evaluation does not guarantee short-circuit
  -- around to_regclass(). Prove existence first, then EXECUTE dynamic SQL.

  IF to_regclass('public.continuum_person_profiles') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.continuum_person_profiles LIMIT 1)'
      INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION
        'Preview sandbox bootstrap refused: continuum_person_profiles already has rows. Target must be empty project % only. Never apply to Production %.',
        'hrmpzplffuhhvbtxxhnt',
        'bnafadfgrrriblppeubp';
    END IF;
  END IF;

  IF to_regclass('public.continuum_gmail_connections') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.continuum_gmail_connections LIMIT 1)'
      INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION
        'Preview sandbox bootstrap refused: continuum_gmail_connections already has rows. Target must be empty project % only.',
        'hrmpzplffuhhvbtxxhnt';
    END IF;
  END IF;

  IF to_regclass('public.continuum_candidates') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.continuum_candidates LIMIT 1)'
      INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION
        'Preview sandbox bootstrap refused: continuum_candidates already has rows. Target must be empty project % only.',
        'hrmpzplffuhhvbtxxhnt';
    END IF;
  END IF;
END
$preview_sandbox_guard$;


-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-schema.sql
-- =====================================================================

-- Continuum canonical state kernel (Phase 1B).
-- Schema document version: 1
-- Apply via Supabase SQL editor (service role) ONLY after Phase 1B.2 activation
-- review. Repeatable: uses IF NOT EXISTS.
--
-- PHASE 1B.1: DO NOT APPLY TO PRODUCTION.
--
-- SERVICE-ROLE ONLY: RLS is enabled with NO policies for anon/authenticated.
-- Application access must use SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not grant table privileges to anon or authenticated roles.
--
-- Scope: internal entities, federated identities, selected events, evidence,
-- observations, observation-evidence links, and detector-owned exceptions.
-- Never stores customer name, email, phone, message, or secrets.
-- HubSpot deal IDs are not person identities (no hubspot_deal_id identity_kind).
--
-- Continuum V1 has no universal current-state table.

create table if not exists continuum_entities (
  id uuid primary key,
  kind text not null check (kind in ('person', 'project', 'other')),
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists continuum_external_identities (
  id uuid primary key,
  entity_id uuid references continuum_entities (id),
  source_system text not null,
  identity_kind text not null check (
    identity_kind in (
      'hubspot_contact_id',
      'email_hash',
      'phone_hash',
      'google_contact_id'
    )
  ),
  identifier text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists continuum_external_identities_active_uq
  on continuum_external_identities (source_system, identity_kind, identifier)
  where revoked_at is null;

create index if not exists continuum_external_identities_entity_idx
  on continuum_external_identities (entity_id);

create table if not exists continuum_events (
  id uuid primary key,
  schema_version integer not null check (schema_version >= 1),
  event_type text not null,
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  producer text not null,
  source_system text not null,
  source_record_id text not null,
  subject_entity_id uuid references continuum_entities (id),
  idempotency_key text not null,
  payload jsonb not null,
  constraint continuum_events_idempotency_key_uq unique (idempotency_key)
);

create index if not exists continuum_events_type_occurred_idx
  on continuum_events (event_type, occurred_at desc);

create index if not exists continuum_events_source_record_idx
  on continuum_events (source_system, source_record_id);

create table if not exists continuum_observations (
  id uuid primary key,
  schema_version integer not null check (schema_version >= 1),
  observation_type text not null,
  subject_entity_id uuid references continuum_entities (id),
  statement text not null,
  value jsonb,
  epistemic_class text not null check (
    epistemic_class in ('observed', 'derived', 'inferred', 'speculative')
  ),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  produced_by text not null,
  created_at timestamptz not null default now(),
  valid_from timestamptz not null,
  valid_until timestamptz,
  supersedes_id uuid references continuum_observations (id),
  materiality text not null check (
    materiality in ('monitor', 'notable', 'material')
  ),
  urgency text not null check (
    urgency in ('critical', 'high', 'medium', 'low')
  )
);

create index if not exists continuum_observations_type_valid_idx
  on continuum_observations (observation_type, valid_until);

create index if not exists continuum_observations_subject_idx
  on continuum_observations (subject_entity_id);

create table if not exists continuum_evidence (
  id uuid primary key,
  schema_version integer not null check (schema_version >= 1),
  source_system text not null,
  source_kind text not null check (
    source_kind in (
      'source-record',
      'event',
      'analytics-query',
      'document',
      'computation',
      'observation'
    )
  ),
  source_record_id text,
  event_id uuid references continuum_events (id),
  observation_id uuid references continuum_observations (id),
  collected_at timestamptz not null,
  period_start date,
  period_end date,
  freshness text not null check (
    freshness in ('fresh', 'stale', 'unknown', 'unavailable')
  ),
  reliability text not null check (
    reliability in ('reliable', 'degraded', 'unverified', 'unavailable')
  ),
  redaction_status text not null check (
    redaction_status in ('clean', 'redacted', 'blocked')
  ),
  summary text not null,
  supporting_pointer text,
  idempotency_key text not null,
  claim_fingerprint text,
  constraint continuum_evidence_idempotency_key_uq unique (idempotency_key),
  constraint continuum_evidence_source_refs_chk check (
    (
      source_kind = 'source-record'
      and source_record_id is not null
      and event_id is null
      and observation_id is null
    )
    or (
      source_kind = 'event'
      and event_id is not null
      and observation_id is null
    )
    or (
      source_kind = 'observation'
      and observation_id is not null
      and event_id is null
    )
    or (
      source_kind in ('analytics-query', 'document', 'computation')
      and event_id is null
      and observation_id is null
    )
  )
);

create index if not exists continuum_evidence_source_record_idx
  on continuum_evidence (source_system, source_kind, source_record_id);

create index if not exists continuum_evidence_event_idx
  on continuum_evidence (event_id);

create table if not exists continuum_observation_evidence (
  observation_id uuid not null references continuum_observations (id),
  evidence_id uuid not null references continuum_evidence (id),
  primary key (observation_id, evidence_id)
);

create index if not exists continuum_observation_evidence_evidence_idx
  on continuum_observation_evidence (evidence_id);

create table if not exists continuum_exceptions (
  id uuid primary key,
  exception_type text not null,
  subject_key text not null,
  subject_entity_id uuid references continuum_entities (id),
  status text not null check (status in ('open', 'resolved', 'suppressed')),
  opened_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz,
  detector text not null,
  evidence_id uuid references continuum_evidence (id),
  payload jsonb not null
);

create unique index if not exists continuum_exceptions_open_subject_uq
  on continuum_exceptions (exception_type, subject_key)
  where status = 'open';

create index if not exists continuum_exceptions_status_type_idx
  on continuum_exceptions (status, exception_type);

create index if not exists continuum_entities_kind_created_idx
  on continuum_entities (kind, created_at);

alter table continuum_entities enable row level security;
alter table continuum_external_identities enable row level security;
alter table continuum_events enable row level security;
alter table continuum_evidence enable row level security;
alter table continuum_observations enable row level security;
alter table continuum_observation_evidence enable row level security;
alter table continuum_exceptions enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Service role bypasses RLS; that is the only intended access path.

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-schema.sql
-- =====================================================================

-- Continuum Client Memory V1 — activation package (schema version 2).
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION until the activation audit passes.
--
-- Depends on existing kernel tables in lib/supabase/continuum-schema.sql:
--   continuum_entities, continuum_external_identities, continuum_evidence
-- Service-role only. RLS enabled. NO anon/authenticated policies.

-- ---------------------------------------------------------------------------
-- Kernel identity_kind extension
-- Production constraint name independently verified:
--   continuum_external_identities_identity_kind_check
-- Deterministic drop/add. Do not catalog-scan unrelated CHECKs.
-- Existing rows remain valid (new list is a superset).
-- Active unique index continuum_external_identities_active_uq is unchanged.
-- Do not add hubspot_deal_id.
-- ---------------------------------------------------------------------------

alter table public.continuum_external_identities
  drop constraint if exists continuum_external_identities_identity_kind_check;

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

create or replace function public.continuum_client_memory_create_person(
  p_entity_id uuid,
  p_created_at timestamptz,
  p_created_by text,
  p_profile jsonb,
  p_identities jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident jsonb;
begin
  begin
    insert into public.continuum_entities (id, kind, created_at, created_by)
    values (p_entity_id, 'person', p_created_at, p_created_by);
  exception
    when unique_violation then
      if exists (
        select 1 from public.continuum_entities
        where id = p_entity_id and kind = 'person'
      ) and exists (
        select 1 from public.continuum_person_profiles where person_id = p_entity_id
      ) then
        return jsonb_build_object('status', 'already-present', 'person_id', p_entity_id);
      end if;
      raise;
  end;

  insert into public.continuum_person_profiles (
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
    insert into public.continuum_external_identities (
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

revoke all on function public.continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from public;
revoke all on function public.continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from anon;
revoke all on function public.continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) from authenticated;
grant execute on function public.continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb) to service_role;

-- Existing-Person update: attach missing identities + populate blank profile
-- fields. Conflicting nonblank profile values raise and roll back.
-- Roles are additive.
create or replace function public.continuum_client_memory_apply_existing_person(
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
  field text;
  incoming text;
  existing text;
  profile_fields text[] := array[
    'display_name', 'given_name', 'family_name', 'organization_name',
    'email', 'phone', 'street_address', 'city', 'state', 'country', 'postal_code'
  ];
begin
  if not exists (
    select 1 from public.continuum_entities
    where id = p_person_id and kind = 'person'
  ) then
    raise exception 'person entity missing';
  end if;

  perform 1 from public.continuum_person_profiles
    where person_id = p_person_id
    for update;

  foreach field in array profile_fields
  loop
    incoming := nullif(btrim(coalesce(p_profile->>field, '')), '');
    execute format(
      'select nullif(btrim(coalesce(%I, '''')), '''') from public.continuum_person_profiles where person_id = $1',
      field
    ) into existing using p_person_id;
    if incoming is null then
      continue;
    end if;
    if existing is null then
      execute format(
        'update public.continuum_person_profiles set %I = $1, updated_at = $2 where person_id = $3',
        field
      ) using incoming, p_updated_at, p_person_id;
    elsif lower(existing) <> lower(incoming) then
      raise exception 'profile_conflict:%', field;
    end if;
  end loop;

  update public.continuum_person_profiles
  set
    roles = (
      select coalesce(array_agg(distinct r), '{}'::text[])
      from unnest(
        coalesce(roles, '{}'::text[])
        || coalesce(
          array(select jsonb_array_elements_text(p_profile->'roles')),
          '{}'::text[]
        )
      ) as r
    ),
    updated_at = p_updated_at
  where person_id = p_person_id;

  for ident in select value from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb))
  loop
    begin
      insert into public.continuum_external_identities (
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
          from public.continuum_external_identities
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

revoke all on function public.continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from public;
revoke all on function public.continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from anon;
revoke all on function public.continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) from authenticated;
grant execute on function public.continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb) to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-gmail-index.sql
-- =====================================================================

-- Continuum Client Memory — protected Gmail message index + checkpoints.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Protected PII plane (same isolation as person profiles and source notes).
-- Gmail remains authoritative for mailbox payloads. This index stores metadata only.
-- Subject is PII-capable and must never be copied into the PII-free kernel.
-- No mailbox payload / excerpt / raw address columns.
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create Persons, identities, facts, relationships, wishes, projects,
-- notes, observations, or kernel evidence.

-- ---------------------------------------------------------------------------
-- Indexed Gmail messages (one Gmail users.messages.id per row)
-- V1 assumes a single founder mailbox. message_id is unique in that mailbox.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_messages (
  message_id text primary key,
  thread_id text not null,
  sent_at timestamptz not null,
  indexed_at timestamptz not null default now(),
  subject text,
  from_email_hash text,
  to_email_hashes text[] not null default '{}'::text[],
  cc_email_hashes text[] not null default '{}'::text[],
  direction text not null check (
    direction in ('inbound', 'outbound', 'unknown')
  ),
  label_ids text[] not null default '{}'::text[],
  has_attachments boolean not null default false,
  source_system text not null default 'gmail' check (source_system = 'gmail')
);

comment on table public.continuum_gmail_messages is
  'Protected Gmail source index. No raw body. Participant identity is email_hash only. Subject is internal PII.';

comment on column public.continuum_gmail_messages.message_id is
  'Gmail API users.messages.id. Deterministic idempotency key for one mailbox.';

comment on column public.continuum_gmail_messages.thread_id is
  'Gmail API users.threads.id. Grouping key only — not unique.';

comment on column public.continuum_gmail_messages.subject is
  'Protected-plane PII. Never copy into kernel evidence summaries without redaction.';

comment on column public.continuum_gmail_messages.from_email_hash is
  'SHA-256 continuum:client-memory:v1 email hash. Never a raw address.';

create index if not exists continuum_gmail_messages_thread_idx
  on public.continuum_gmail_messages (thread_id);

create index if not exists continuum_gmail_messages_sent_idx
  on public.continuum_gmail_messages (sent_at);

create index if not exists continuum_gmail_messages_from_hash_idx
  on public.continuum_gmail_messages (from_email_hash)
  where from_email_hash is not null;

alter table public.continuum_gmail_messages enable row level security;

revoke all on table public.continuum_gmail_messages from public;
revoke all on table public.continuum_gmail_messages from anon;
revoke all on table public.continuum_gmail_messages from authenticated;

grant all on table public.continuum_gmail_messages to service_role;

-- ---------------------------------------------------------------------------
-- Checkpoints — historical backfill vs daily memory, not a job framework.
-- Gmail list pageToken and historyId are opaque strings (historyId is uint64).
-- Callers must durably index a batch, then write the checkpoint. This file
-- does not provide a transactional batch+checkpoint function.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_checkpoints (
  job_key text primary key check (
    job_key in ('gmail-historical', 'gmail-memory-daily')
  ),
  status text not null check (
    status in ('idle', 'running', 'failed', 'completed')
  ),
  window_start timestamptz,
  window_end timestamptz,
  page_token text,
  history_id text,
  cursor_message_id text,
  indexed_count integer not null default 0 check (indexed_count >= 0),
  updated_at timestamptz not null default now(),
  error_code text
);

comment on table public.continuum_gmail_checkpoints is
  'Restartable Gmail index cursors. Separate rows for historical vs daily jobs.';

comment on column public.continuum_gmail_checkpoints.page_token is
  'Opaque Gmail users.messages.list pageToken for the current date window.';

comment on column public.continuum_gmail_checkpoints.history_id is
  'Opaque Gmail historyId stored as text to avoid uint64 precision loss.';

alter table public.continuum_gmail_checkpoints enable row level security;

revoke all on table public.continuum_gmail_checkpoints from public;
revoke all on table public.continuum_gmail_checkpoints from anon;
revoke all on table public.continuum_gmail_checkpoints from authenticated;

grant all on table public.continuum_gmail_checkpoints to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-gmail-index.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-gmail-activation.sql
-- =====================================================================

-- Continuum / Concierge Gmail read-only activation — Slices A + B
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Production already has:
--   public.continuum_gmail_messages
--   public.continuum_gmail_checkpoints
-- Do NOT recreate those tables. Do NOT reapply
-- lib/supabase/continuum-client-memory-gmail-index.sql.
--
-- This file:
--   1. Adds bcc_email_hashes to the existing message index
--   2. Creates continuum_gmail_connections (token custody)
--   3. Creates continuum_gmail_attachments (metadata only)
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create Persons, identities, facts, relationships, wishes,
-- projects, notes, observations, kernel evidence, Open Jobs, or CoS rows.
-- Does not store mailbox body, HTML, snippet, or attachment bytes.

-- ---------------------------------------------------------------------------
-- Backward-compatible BCC participant hashes on the existing message index
-- ---------------------------------------------------------------------------

alter table public.continuum_gmail_messages
  add column if not exists bcc_email_hashes text[] not null default '{}'::text[];

comment on column public.continuum_gmail_messages.bcc_email_hashes is
  'SHA-256 continuum:client-memory:v1 email hashes. Never raw addresses.';

-- ---------------------------------------------------------------------------
-- Founder mailbox connection + encrypted refresh-token custody
-- V1: one founder mailbox (mailbox_slot = founder-v1).
-- Plaintext refresh/access tokens are never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_connections (
  connection_id uuid primary key default gen_random_uuid(),
  mailbox_slot text not null default 'founder-v1'
    check (mailbox_slot = 'founder-v1'),
  mailbox_email_hash text not null,
  status text not null check (
    status in ('connected', 'paused', 'disconnected', 'revoked')
  ),
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  token_enc_alg text check (
    token_enc_alg is null or token_enc_alg = 'aes-256-gcm'
  ),
  token_enc_version integer check (
    token_enc_version is null or token_enc_version >= 1
  ),
  granted_scope text,
  provider_token_type text,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status_error_code text,
  constraint continuum_gmail_connections_token_shape check (
    (
      refresh_token_ciphertext is null
      and refresh_token_iv is null
      and refresh_token_tag is null
      and token_enc_alg is null
      and token_enc_version is null
    )
    or (
      refresh_token_ciphertext is not null
      and refresh_token_iv is not null
      and refresh_token_tag is not null
      and token_enc_alg = 'aes-256-gcm'
      and token_enc_version is not null
    )
  ),
  constraint continuum_gmail_connections_active_has_token check (
    status not in ('connected', 'paused')
    or refresh_token_ciphertext is not null
  ),
  constraint continuum_gmail_connections_inactive_no_token check (
    status not in ('disconnected', 'revoked')
    or refresh_token_ciphertext is null
  )
);

comment on table public.continuum_gmail_connections is
  'Protected Gmail connection + AES-256-GCM refresh-token custody. One founder mailbox in V1. Never plaintext tokens.';

comment on column public.continuum_gmail_connections.mailbox_email_hash is
  'SHA-256 continuum:client-memory:v1 hash of the bound mailbox. Never a raw address.';

comment on column public.continuum_gmail_connections.refresh_token_ciphertext is
  'AES-256-GCM ciphertext of the Google refresh token. Null when disconnected or revoked.';

create unique index if not exists continuum_gmail_connections_founder_slot_uq
  on public.continuum_gmail_connections (mailbox_slot);

alter table public.continuum_gmail_connections enable row level security;

revoke all on table public.continuum_gmail_connections from public;
revoke all on table public.continuum_gmail_connections from anon;
revoke all on table public.continuum_gmail_connections from authenticated;

grant all on table public.continuum_gmail_connections to service_role;

-- ---------------------------------------------------------------------------
-- Attachment metadata only. Never bytes. Never messages.attachments.get.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_attachments (
  message_id text not null,
  attachment_id text not null,
  thread_id text not null,
  filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  indexed_at timestamptz not null default now(),
  primary key (message_id, attachment_id)
);

comment on table public.continuum_gmail_attachments is
  'Protected Gmail attachment metadata. No bytes. No body. Filename may be PII-capable.';

comment on column public.continuum_gmail_attachments.attachment_id is
  'Gmail payload body.attachmentId. Identity is (message_id, attachment_id).';

create index if not exists continuum_gmail_attachments_thread_idx
  on public.continuum_gmail_attachments (thread_id);

alter table public.continuum_gmail_attachments enable row level security;

revoke all on table public.continuum_gmail_attachments from public;
revoke all on table public.continuum_gmail_attachments from anon;
revoke all on table public.continuum_gmail_attachments from authenticated;

grant all on table public.continuum_gmail_attachments to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not create SECURITY DEFINER functions in this migration.

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-gmail-activation.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-candidates-schema.sql
-- =====================================================================

-- Continuum Candidate contract #17.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Does not alter Gmail index, checkpoints, history,
-- Persons, project specs, lifecycle, Kind, or Open Jobs.
-- Candidate ≠ truth. canonical = false. automaticApply = false.
--
-- Option B: candidate_state is evidence/lineage.
-- review_status is founder decision state for #19.
-- Source adapters do not write review_status other than pending on insert.
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Does not store Gmail bodies, excerpts, or attachment bytes.
-- source_ref is stored in full (max 2048). Do not truncate provenance.

create table if not exists public.continuum_candidates (
  candidate_id text primary key check (
    candidate_id ~ '^[a-f0-9]{64}$'
  ),
  source_system text not null check (
    source_system in (
      'gmail',
      'human-intake',
      'plaud',
      'remarkable',
      'google_calendar'
    )
  ),
  source_ref text not null check (
    char_length(source_ref) >= 8
    and char_length(source_ref) <= 2048
  ),
  source_timestamp timestamptz not null,
  candidate_type text not null check (
    candidate_type in (
      'person_association',
      'project_association',
      'project_context',
      'note',
      'structured_spec',
      'open_job',
      'date',
      'follow_up'
    )
  ),
  proposed_target jsonb not null,
  payload jsonb not null,
  confidence text not null check (
    confidence in ('high', 'medium', 'low', 'ambiguous')
  ),
  evidence_basis jsonb not null,
  candidate_state text not null check (
    candidate_state in ('active', 'conflict', 'superseded')
  ),
  review_status text not null check (
    review_status in ('pending', 'approved', 'discarded', 'deferred')
  ),
  last_review_action text check (
    last_review_action is null
    or last_review_action in ('approve', 'edit', 'discard', 'defer')
  ),
  founder_edited_payload jsonb,
  founder_edited_target jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null,
  canonical boolean not null default false check (canonical = false),
  automatic_apply boolean not null default false check (automatic_apply = false),
  parser_version text not null,
  supersedes_candidate_id text,
  superseded_by_candidate_id text
);

comment on table public.continuum_candidates is
  'Cross-source Continuum Candidates. Proposals awaiting founder review. Not canonical memory.';

comment on column public.continuum_candidates.source_ref is
  'Full provenance pointer. Never truncate Gmail thread/message ids.';

comment on column public.continuum_candidates.source_system is
  'Allow-list: gmail, human-intake, plaud, remarkable, google_calendar. Invalid values cannot persist.';

comment on column public.continuum_candidates.candidate_state is
  'Evidence/lineage. Conflict is independent of founder review_status.';

comment on column public.continuum_candidates.review_status is
  'Founder disposition for #19: pending/approved/discarded/deferred. Edit is an action, not a status.';

comment on column public.continuum_candidates.founder_edited_target is
  'Optional founder-edited proposed target. Does not write canonical Person/Project/spec/job state.';

comment on column public.continuum_candidates.canonical is
  'Always false. #17 does not write canonical Person/Project/spec/job state.';

comment on column public.continuum_candidates.payload is
  'Structured proposal. open_job.createJob is always false. person_association.mintPerson is always false.';

create unique index if not exists continuum_candidates_identity_uq
  on public.continuum_candidates (candidate_id);

create index if not exists continuum_candidates_source_idx
  on public.continuum_candidates (source_system, source_ref);

create index if not exists continuum_candidates_review_idx
  on public.continuum_candidates (review_status, candidate_state, created_at desc);

alter table public.continuum_candidates enable row level security;

revoke all on table public.continuum_candidates from public;
revoke all on table public.continuum_candidates from anon;
revoke all on table public.continuum_candidates from authenticated;

grant select, insert, update on table public.continuum_candidates to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not grant delete.
-- Do not create continuum_open_jobs or continuum_person_profiles from this table.
-- Do not invoke the project spec writer.
-- Do not mutate Gmail index or checkpoints.
-- Do not store mailbox bodies.

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-candidates-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-chief-of-staff-schema.sql
-- =====================================================================

-- Continuum Chief of Staff 2.0 Phase 1B — attention persistence.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION.
--
-- Protected founder attention. May contain person names and recommended actions.
-- Does NOT write into continuum_observations (kernel remains PII-free).
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Depends on public.continuum_entities from lib/supabase/continuum-schema.sql.
--
-- Phase 1B: observation_ids and evidence_ids are text[] (opaque specialist ids).
-- attention_item_ids remain uuid[] (AttentionItem primary keys).

create table if not exists public.continuum_attention_items (
  id uuid primary key,
  dedupe_key text not null,
  kind text not null check (
    kind in (
      'founder-action',
      'relationship-follow-through',
      'commitment-due',
      'project-blocked',
      'material-risk',
      'calendar-prep',
      'milestone',
      'specialist-opportunity'
    )
  ),
  headline text not null,
  why_it_matters text not null,
  recommended_action text not null,
  urgency text not null check (
    urgency in ('now', 'today', 'this-week', 'watch')
  ),
  importance text not null check (
    importance in ('high', 'medium', 'low')
  ),
  audience text not null check (
    audience in (
      'urgent-founder-action',
      'founder-action',
      'watch',
      'fyi',
      'delegate'
    )
  ),
  confidence text not null check (
    confidence in ('high', 'medium', 'low')
  ),
  epistemic_class text not null check (
    epistemic_class in ('observed', 'derived', 'inferred', 'recommendation')
  ),
  person_id uuid references public.continuum_entities (id),
  project_id uuid references public.continuum_entities (id),
  observation_ids text[] not null default '{}',
  evidence_ids text[] not null default '{}',
  due_at timestamptz,
  status text not null check (
    status in (
      'new',
      'seen',
      'acknowledged',
      'snoozed',
      'resolved',
      'expired'
    )
  ),
  snoozed_until timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.continuum_attention_items is
  'Protected Chief of Staff attention items. Founder-only copy. Not kernel observations.';

create unique index if not exists continuum_attention_items_open_dedupe_uq
  on public.continuum_attention_items (dedupe_key)
  where status in ('new', 'seen', 'acknowledged', 'snoozed');

create index if not exists continuum_attention_items_status_idx
  on public.continuum_attention_items (status, created_at desc);

create index if not exists continuum_attention_items_person_idx
  on public.continuum_attention_items (person_id)
  where person_id is not null;

create index if not exists continuum_attention_items_project_idx
  on public.continuum_attention_items (project_id)
  where project_id is not null;

create table if not exists public.continuum_attention_briefs (
  id uuid primary key,
  local_date date not null,
  generated_at timestamptz not null,
  attention_item_ids uuid[] not null default '{}',
  worth_knowing jsonb not null default '[]'::jsonb,
  silence_reason text,
  created_at timestamptz not null default now()
);

comment on table public.continuum_attention_briefs is
  'Canonical daily Chief of Staff snapshot. One row per founder-local date.';

create unique index if not exists continuum_attention_briefs_local_date_uq
  on public.continuum_attention_briefs (local_date);

alter table public.continuum_attention_items enable row level security;
alter table public.continuum_attention_briefs enable row level security;

revoke all on table public.continuum_attention_items from public;
revoke all on table public.continuum_attention_items from anon;
revoke all on table public.continuum_attention_items from authenticated;
revoke all on table public.continuum_attention_briefs from public;
revoke all on table public.continuum_attention_briefs from anon;
revoke all on table public.continuum_attention_briefs from authenticated;

grant select, insert, update, delete on table public.continuum_attention_items to service_role;
grant select, insert, update, delete on table public.continuum_attention_briefs to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-chief-of-staff-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-correct-project-spec.sql
-- =====================================================================

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

revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from public;
revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from anon;
revoke all on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) from authenticated;
grant execute on function public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text) to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-correct-project-spec.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-correct-project-spec-array-append.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-correct-project-spec-array-append.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-kind.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-kind.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-custom-repair-layers.sql
-- =====================================================================

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
    -- PostgreSQL text cannot contain NUL. Do not construct a NUL byte to
    -- scan values; that raises 54000 and aborts every non-empty write.
    -- App validation already rejects control characters including NUL.
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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-custom-repair-layers.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-operating-detail-nul-guard.sql
-- =====================================================================

-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Sprint #8 follow-up. Smallest CREATE OR REPLACE for the operating-detail RPC.
-- Removes an illegal NUL-byte probe that raises PostgreSQL 54000
-- "null character not permitted" and aborts every non-empty Custom/Repair write.
-- Does not change tables, Kind, CHECK, RLS, grants, or dormant-row semantics.
-- App validation already rejects control characters including NUL.
-- PostgreSQL text cannot store NUL bytes.

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
    -- PostgreSQL text cannot contain NUL. Do not construct a NUL byte to
    -- scan values; that raises 54000 and aborts every non-empty write.
    -- App validation already rejects control characters including NUL.
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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-operating-detail-nul-guard.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-lifecycle.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-lifecycle.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-jobs.sql
-- =====================================================================

-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #10 — durable Project-local Open Jobs foundation.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Open Jobs are unresolved work INSIDE a Project. They are not:
-- generic todos, CoS attention, Agent OS backlog, Project Lifecycle,
-- operating-detail fields, a commitments table, or payment state.
-- Canonical current state lives on the row. No event replay required.
-- No automatic rows. No backfill. No inference from notes, Gmail, Lifecycle,
-- operating details, Human Intake, or reconstruction.
-- Reserved provenance source_system values may be stored as pointers later.
-- Those systems must not write this table in #10.
-- Does not add anon/authenticated grants or RLS policies. RLS remains enabled.
-- No dynamic SQL from field values.
-- No Gmail bodies, voice captures, or attachment bytes.

create table if not exists public.continuum_project_jobs (
  job_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  kind text not null,
  subject text not null,
  detail text,
  waiting_on_actor text not null,
  associated_person_id uuid
    references public.continuum_person_profiles (person_id)
    on delete restrict,
  state text not null,
  due_at timestamptz,
  deferred_until timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  source_system text not null,
  source_ref text,
  created_mutation_id uuid not null,
  constraint continuum_project_jobs_kind_check
    check (kind in (
      'request',
      'commitment',
      'question',
      'required_action',
      'approval',
      'blocked_issue'
    )),
  constraint continuum_project_jobs_actor_check
    check (waiting_on_actor in (
      'founder',
      'hourglass',
      'client',
      'vendor',
      'unknown'
    )),
  constraint continuum_project_jobs_state_check
    check (state in ('open', 'snoozed', 'resolved', 'cancelled')),
  constraint continuum_project_jobs_subject_check
    check (
      char_length(btrim(subject)) between 1 and 160
      and subject !~ E'[\\n\\r]'
    ),
  constraint continuum_project_jobs_detail_check
    check (
      detail is null
      or (
        char_length(detail) <= 2000
        and detail !~ E'[\\u0000]'
      )
    ),
  constraint continuum_project_jobs_source_system_check
    check (source_system in (
      'concierge-manual',
      'gmail',
      'plaud',
      'remarkable',
      'human-intake',
      'calendar',
      'messages',
      'continuum'
    )),
  constraint continuum_project_jobs_source_ref_check
    check (
      source_ref is null
      or (
        char_length(btrim(source_ref)) between 1 and 240
        and source_ref !~ E'[\\n\\r]'
      )
    ),
  constraint continuum_project_jobs_created_by_check
    check (char_length(btrim(created_by)) between 1 and 80),
  constraint continuum_project_jobs_open_check
    check (
      state <> 'open'
      or (
        deferred_until is null
        and resolved_at is null
        and cancelled_at is null
      )
    ),
  constraint continuum_project_jobs_snoozed_check
    check (
      state <> 'snoozed'
      or (
        deferred_until is not null
        and resolved_at is null
        and cancelled_at is null
      )
    ),
  constraint continuum_project_jobs_resolved_check
    check (
      state <> 'resolved'
      or (
        resolved_at is not null
        and cancelled_at is null
        and deferred_until is null
      )
    ),
  constraint continuum_project_jobs_cancelled_check
    check (
      state <> 'cancelled'
      or (
        cancelled_at is not null
        and resolved_at is null
        and deferred_until is null
      )
    )
);

comment on table public.continuum_project_jobs is
  'Canonical Project-local Open Jobs. Unresolved work inside one Project. Current state is on the row. Not CoS attention, not a commitments table, not Lifecycle, not Agent OS backlog.';

comment on column public.continuum_project_jobs.source_ref is
  'Stable source pointer only. Never a Gmail body, captured speech, or attachment URL.';

comment on column public.continuum_project_jobs.waiting_on_actor is
  'Bounded actor role. Not Person identity. associated_person_id is an optional known Person on the same Project.';

comment on column public.continuum_project_jobs.state is
  'open and snoozed are unresolved. resolved and cancelled are terminal history. Snooze is not resolution.';

create unique index if not exists continuum_project_jobs_created_mutation_uq
  on public.continuum_project_jobs (created_mutation_id);

create index if not exists continuum_project_jobs_project_created_idx
  on public.continuum_project_jobs (project_id, created_at desc, job_id desc);

create index if not exists continuum_project_jobs_project_unresolved_idx
  on public.continuum_project_jobs (project_id, created_at desc, job_id desc)
  where state in ('open', 'snoozed');

alter table public.continuum_project_jobs enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

revoke all on table public.continuum_project_jobs from public;
revoke all on table public.continuum_project_jobs from anon;
revoke all on table public.continuum_project_jobs from authenticated;
grant select, insert, update on table public.continuum_project_jobs to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-jobs.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-jobs-mutations.sql
-- =====================================================================

-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #11 — founder Open Job mutation log.
-- Additive only. Does not rewrite continuum_project_jobs.
-- Does not delete job rows. Terminal history remains on the job row.
-- Does not add anon/authenticated grants or RLS policies.
-- No Gmail, Human Intake, CoS, or Lifecycle writes.

create table if not exists public.continuum_project_job_mutations (
  mutation_id uuid primary key,
  job_id uuid not null
    references public.continuum_project_jobs (job_id)
    on delete restrict,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  action text not null,
  prior_state text,
  new_state text not null,
  changed_at timestamptz not null,
  changed_by text not null,
  source_system text not null,
  constraint continuum_project_job_mutations_action_check
    check (action in (
      'create',
      'resolve',
      'cancel',
      'snooze',
      'unsnooze',
      'update'
    )),
  constraint continuum_project_job_mutations_prior_state_check
    check (
      prior_state is null
      or prior_state in ('open', 'snoozed', 'resolved', 'cancelled')
    ),
  constraint continuum_project_job_mutations_new_state_check
    check (new_state in ('open', 'snoozed', 'resolved', 'cancelled')),
  constraint continuum_project_job_mutations_source_check
    check (source_system in ('concierge-manual', 'continuum')),
  constraint continuum_project_job_mutations_changed_by_check
    check (char_length(btrim(changed_by)) between 1 and 80)
);

comment on table public.continuum_project_job_mutations is
  'Append-only founder Open Job mutation log. Current job state remains on continuum_project_jobs. Not CoS attention history.';

create index if not exists continuum_project_job_mutations_job_changed_idx
  on public.continuum_project_job_mutations (job_id, changed_at desc);

alter table public.continuum_project_job_mutations enable row level security;

revoke all on table public.continuum_project_job_mutations from public;
revoke all on table public.continuum_project_job_mutations from anon;
revoke all on table public.continuum_project_job_mutations from authenticated;
grant select, insert on table public.continuum_project_job_mutations to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-jobs-mutations.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-artifacts.sql
-- =====================================================================

-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #14 — Hourglass-owned durable Project Artifacts foundation.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Canonical Project files. They are not:
-- Gmail attachment URLs, temporary Gmail previews, reconstruction evidence,
-- Shape Studio captures, Diamond Intelligence archives, or public uploads.
-- Deletion is not available in this foundation. Rows are retained.
-- Storage objects are not deleted. No public object URLs.
-- Does not copy Gmail attachments (#15). Does not write CoS or Lifecycle.
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.

-- ---------------------------------------------------------------------------
-- Private storage bucket (create in activation audit — do not apply now)
-- ---------------------------------------------------------------------------
-- Dashboard / SQL editor later:
--   Name: continuum-project-artifacts
--   Public: OFF (public = false)
--   Service-role writes only. No public URLs. No storage policies for anon.
--   Object path is server-generated: {projectId}/{artifactId}/file.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'continuum-project-artifacts',
  'continuum-project-artifacts',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.continuum_project_artifacts (
  artifact_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  kind text not null,
  title text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null,
  created_by text not null,
  source_system text not null,
  source_ref text,
  created_mutation_id uuid not null,
  constraint continuum_project_artifacts_kind_check
    check (kind in (
      'render',
      'cad',
      'inspiration',
      'finished_image',
      'production_image',
      'document',
      'other'
    )),
  constraint continuum_project_artifacts_title_check
    check (
      char_length(btrim(title)) between 1 and 160
      and title !~ E'[\\n\\r]'
    ),
  constraint continuum_project_artifacts_filename_check
    check (
      char_length(btrim(original_filename)) between 1 and 180
      and original_filename !~ E'[\\n\\r\\\\/]'
      and position('..' in original_filename) = 0
    ),
  constraint continuum_project_artifacts_mime_check
    check (mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    )),
  constraint continuum_project_artifacts_size_check
    check (byte_size >= 1 and byte_size <= 26214400),
  constraint continuum_project_artifacts_bucket_check
    check (storage_bucket = 'continuum-project-artifacts'),
  constraint continuum_project_artifacts_path_check
    check (
      char_length(storage_path) between 1 and 320
      and storage_path !~ E'[\\n\\r]'
      and position('..' in storage_path) = 0
    ),
  constraint continuum_project_artifacts_source_system_check
    check (source_system in ('concierge-manual', 'gmail', 'continuum')),
  constraint continuum_project_artifacts_source_ref_check
    check (
      source_ref is null
      or (
        char_length(source_ref) <= 240
        and source_ref !~ E'[\\n\\r]'
      )
    ),
  constraint continuum_project_artifacts_created_by_check
    check (char_length(btrim(created_by)) between 1 and 80),
  constraint continuum_project_artifacts_created_mutation_uq
    unique (created_mutation_id),
  constraint continuum_project_artifacts_storage_path_uq
    unique (storage_bucket, storage_path)
);

comment on table public.continuum_project_artifacts is
  'Hourglass-owned durable Project files. Not Gmail attachments, Shape Studio captures, or reconstruction evidence. Deletion is not available in this foundation.';

create index if not exists continuum_project_artifacts_project_created_idx
  on public.continuum_project_artifacts (project_id, created_at desc);

alter table public.continuum_project_artifacts enable row level security;

revoke all on table public.continuum_project_artifacts from public;
revoke all on table public.continuum_project_artifacts from anon;
revoke all on table public.continuum_project_artifacts from authenticated;
grant select, insert on table public.continuum_project_artifacts to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-artifacts.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-project-artifact-gmail-copy.sql
-- =====================================================================

-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #15 — Gmail attachment COPY-IN identity for Project Artifacts.
-- Additive #15 migration against already-live #14.
-- Production already has public.continuum_project_artifacts and the private
-- Storage bucket continuum-project-artifacts (public = false, 25 MB, image/PDF MIME).
-- This file does not recreate the #14 table, bucket, RLS, grants, or public access.
-- Existing #14 rows and all other #14 constraints are preserved.
-- Does not copy bytes. Does not alter #16B incremental Gmail sync.
-- Does not create a second artifact system. continuum_project_artifacts remains canonical.
-- Unique identity: destination Project + Gmail message id + attachment id.
-- Encoded in source_ref as gm1|{messageId}|{attachmentId}|{threadId}|{sentAt}|{fromEmailHash}
-- Exact Gmail attachment IDs are retained. They are never truncated or hashed.
-- Gmail source_ref maximum is 2048 characters. Non-Gmail remains 240.
-- Sender is the indexed from-email hash only. Raw mailbox addresses and bodies are not stored.
-- Copied-at is created_at. original_filename and mime_type remain #14 columns.

alter table public.continuum_project_artifacts
  drop constraint if exists continuum_project_artifacts_source_ref_check;

alter table public.continuum_project_artifacts
  add constraint continuum_project_artifacts_source_ref_check
  check (
    source_ref is null
    or (
      source_ref !~ E'[\\n\\r]'
      and char_length(source_ref) <=
        case
          when source_system = 'gmail' then 2048
          else 240
        end
    )
  );

-- Unique on destination Project + Gmail message id + attachment id.
-- Same Gmail message+attachment on two Projects is allowed.
-- Same Gmail message+attachment on one Project is a duplicate.
-- Not unique on filename. Not unique on Gmail identity alone.
create unique index if not exists continuum_project_artifacts_gmail_copy_identity_uq
  on public.continuum_project_artifacts (
    project_id,
    split_part(source_ref, '|', 2),
    split_part(source_ref, '|', 3)
  )
  where source_system = 'gmail'
    and source_ref is not null
    and split_part(source_ref, '|', 1) = 'gm1';

comment on index public.continuum_project_artifacts_gmail_copy_identity_uq is
  'UNAPPLIED #15 Gmail copy-in identity scoped by project_id. Same Gmail attachment may exist on two Projects. Not filename dedupe.';

comment on constraint continuum_project_artifacts_source_ref_check
  on public.continuum_project_artifacts is
  'UNAPPLIED #15 additive replacement of live #14 source_ref check. Gmail 2048. Non-Gmail 240.';

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-project-artifact-gmail-copy.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-set-current-fact.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-set-current-fact.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-source-note-lifecycle.sql
-- =====================================================================

-- UNAPPLIED.
-- Client Memory Slice B — source-note lifecycle + revisions.
-- DO NOT RUN AGAINST PRODUCTION from this change.
-- Additive only. Does not drop continuum_source_notes_import_field_uq.
-- Does not modify Person, Project, Wish, Fact, Human Intake, Gmail, Digital Card, or CoS.
-- Does not add anon/authenticated grants. RLS remains enabled on source notes.
-- No hard delete. Import identity stays occupied when a note is trashed.
--
-- Backfill:
--   source_system = 'concierge-manual' → kept
--   all other existing source notes, including continuum-reconciliation-v3 → absorbed
-- Ambiguous/unknown source_system values are absorbed (safe: retained, not cockpit-visible).
-- No database DEFAULT for lifecycle_status after backfill: every future write must specify it.

alter table public.continuum_source_notes
  add column if not exists lifecycle_status text;

alter table public.continuum_source_notes
  add column if not exists updated_at timestamptz;

alter table public.continuum_source_notes
  add column if not exists updated_by text;

alter table public.continuum_source_notes
  add column if not exists deleted_at timestamptz;

alter table public.continuum_source_notes
  add column if not exists previous_lifecycle text;

update public.continuum_source_notes
set
  lifecycle_status = case
    when source_system = 'concierge-manual' then 'kept'
    else 'absorbed'
  end,
  updated_at = coalesce(updated_at, created_at)
where lifecycle_status is null;

alter table public.continuum_source_notes
  alter column lifecycle_status set not null;

alter table public.continuum_source_notes
  alter column updated_at set not null;

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_lifecycle_status_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_lifecycle_status_check
  check (
    lifecycle_status in ('inbox', 'kept', 'absorbed', 'trashed')
  );

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_previous_lifecycle_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_previous_lifecycle_check
  check (
    previous_lifecycle is null
    or previous_lifecycle in ('inbox', 'kept', 'absorbed', 'trashed')
  );

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_deleted_at_lifecycle_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_deleted_at_lifecycle_check
  check (
    (
      lifecycle_status = 'trashed'
      and deleted_at is not null
    )
    or (
      lifecycle_status <> 'trashed'
      and deleted_at is null
    )
  );

create index if not exists continuum_source_notes_person_lifecycle_idx
  on public.continuum_source_notes (person_id, lifecycle_status, created_at desc);

comment on column public.continuum_source_notes.lifecycle_status is
  'inbox=unfiled capture; kept=founder-visible; absorbed=evidence only; trashed=soft deleted. Same row identity.';

create table if not exists public.continuum_source_note_revisions (
  id uuid primary key,
  note_id uuid not null references public.continuum_source_notes (id),
  mutation_id uuid not null,
  note_text text not null,
  person_id uuid,
  project_id uuid,
  context_layer text not null,
  lifecycle_status text not null check (
    lifecycle_status in ('inbox', 'kept', 'absorbed', 'trashed')
  ),
  change_kind text not null check (
    change_kind in ('edit', 'move', 'trash', 'restore', 'absorb', 'keep')
  ),
  edited_at timestamptz not null,
  edited_by text not null
);

create unique index if not exists continuum_source_note_revisions_mutation_uq
  on public.continuum_source_note_revisions (mutation_id);

create index if not exists continuum_source_note_revisions_note_idx
  on public.continuum_source_note_revisions (note_id, edited_at desc);

comment on table public.continuum_source_note_revisions is
  'Protected prior state of continuum_source_notes. PII plane only. Not a public API.';

alter table public.continuum_source_note_revisions enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Unique index continuum_source_notes_import_field_uq is unchanged.

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-source-note-lifecycle.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-source-note-context-layer.sql
-- =====================================================================

-- UNAPPLIED.
-- Client Memory source-note relationship context layer.
-- Do not apply in this sprint. Do not run against production from this change.
-- Affects only public.continuum_source_notes.context_layer.
-- Does not modify Person, Project, Wish, Fact, or kernel Event/Evidence/Observation rows.
-- Does not add anon/authenticated grants. RLS on continuum_source_notes remains enabled.
-- Unique index continuum_source_notes_import_field_uq is unchanged.
-- No database DEFAULT after backfill: every future write must specify context_layer.

alter table public.continuum_source_notes
  add column if not exists context_layer text;

update public.continuum_source_notes
set context_layer = 'client'
where context_layer is null;

alter table public.continuum_source_notes
  alter column context_layer set not null;

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_context_layer_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_context_layer_check
  check (
    context_layer in ('client', 'networking', 'personal')
  );

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-source-note-context-layer.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-mutate-source-note.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-mutate-source-note.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-client-memory-update-person-contact.sql
-- =====================================================================

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

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-client-memory-update-person-contact.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/agent-os-schema.sql
-- =====================================================================

-- Agent OS operational persistence (scheduling, cadence, delivery metadata).
-- Schema document version: 2
-- Apply via Supabase SQL editor (service role). Repeatable: uses IF NOT EXISTS.
--
-- SERVICE-ROLE ONLY: RLS is enabled with NO policies for anon/authenticated.
-- Application access must use SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not grant table privileges to anon or authenticated roles.
--
-- Scope: Agent OS run records, finding/recommendation lifecycle, cadence metadata,
-- and delivery reservation/outcome metadata. Never stores secrets, API keys,
-- credentials, or raw recipient email addresses.
-- Audit JSON must contain only redacted operational notes (enforced in app code).
--
-- Retention:
--   - State blob runs: last 50 (application-enforced MAX_RETAINED_RUNS)
--   - State blob deliveries: last 100 (application-enforced MAX_RETAINED_DELIVERIES)
--   - Claim rows intended retention: approximately 90 days
--   - Automatic purge: NOT YET ENABLED
--   - Required before or shortly after scheduled-live activation
--   - Rows contain operational metadata only (no raw recipients or secrets)
--
-- Incompatible existing tables: if agent_os_* tables already exist with a
-- different shape, do NOT apply blindly — migrate explicitly or recreate in a
-- non-production environment first. This file does not auto-alter columns.
--
-- JSON payload size: application validates/migrates state and caps retention;
-- oversized or malformed state fails closed in the adapter (no silent truncate
-- of healthy prior rows on CAS miss).

create table if not exists agent_os_persisted_state (
  scope text primary key check (scope in ('live', 'fixture', 'test')),
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint agent_os_persisted_state_version_positive check (version >= 0)
);

create table if not exists agent_os_delivery_claims (
  idempotency_key text primary key,
  delivery_id text not null,
  kind text not null check (kind in ('founder-brief', 'failure-alert')),
  cadence_id text not null,
  cadence_window text not null,
  status text not null check (
    status in (
      'reserved',
      'sending',
      'sent',
      'failed',
      'uncertain',
      'suppressed'
    )
  ),
  brief_fingerprint text not null,
  recipient_config_fingerprint text not null,
  run_id text not null,
  provider_message_id text,
  error_summary text,
  suppression_reason text,
  reserved_at timestamptz not null,
  updated_at timestamptz not null,
  sent_at timestamptz,
  lease_expires_at timestamptz not null,
  claim_owner text not null,
  resolution_audit jsonb not null default '[]'::jsonb,
  -- Full intended uniqueness boundary (matches app idempotency key inputs)
  constraint agent_os_delivery_claims_window_kind_recipient_uq unique (
    cadence_id,
    cadence_window,
    kind,
    recipient_config_fingerprint
  )
);

-- Lease inspection / reclaim scans
create index if not exists agent_os_delivery_claims_status_lease_idx
  on agent_os_delivery_claims (status, lease_expires_at);

-- Cadence window + kind lookup (inspect / recovery)
create index if not exists agent_os_delivery_claims_cadence_window_idx
  on agent_os_delivery_claims (cadence_id, cadence_window, kind);

-- Retention cleanup candidate scans (when purge is enabled later)
create index if not exists agent_os_delivery_claims_updated_at_idx
  on agent_os_delivery_claims (updated_at);

create index if not exists agent_os_persisted_state_updated_at_idx
  on agent_os_persisted_state (updated_at);

alter table agent_os_persisted_state enable row level security;
alter table agent_os_delivery_claims enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Service role bypasses RLS; that is the only intended access path.

-- =====================================================================
-- END SOURCE: lib/supabase/agent-os-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-founder-passkeys-schema.sql
-- =====================================================================

-- Continuum founder passkeys + WebAuthn challenges
-- UNAPPLIED. Do not run from the app. Service-role / SQL editor only after review.
-- Does not store biometric data. Public keys + counters + short-lived challenges only.
-- Separate from Client Memory. No policies. No anon/authenticated/PUBLIC grants.
--
-- Founder WebAuthn user.id (stable, not an email):
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_passkeys');
--   select to_regclass('public.continuum_founder_webauthn_challenges');

create table if not exists public.continuum_founder_passkeys (
  id uuid primary key default gen_random_uuid(),
  founder_user_id text not null,
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb,
  device_type text,
  backed_up boolean,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  label text,
  revoked_at timestamptz
);

create unique index if not exists continuum_founder_passkeys_credential_id_uq
  on public.continuum_founder_passkeys (credential_id);

create index if not exists continuum_founder_passkeys_founder_active_idx
  on public.continuum_founder_passkeys (founder_user_id)
  where revoked_at is null;

alter table public.continuum_founder_passkeys enable row level security;

revoke all on table public.continuum_founder_passkeys from public;
revoke all on table public.continuum_founder_passkeys from anon;
revoke all on table public.continuum_founder_passkeys from authenticated;

grant all on table public.continuum_founder_passkeys to service_role;

create table if not exists public.continuum_founder_webauthn_challenges (
  jti text primary key,
  purpose text not null check (purpose in ('reg', 'auth')),
  founder_user_id text not null,
  challenge text not null,
  origin text not null,
  rp_id text not null,
  session_fingerprint text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists continuum_founder_webauthn_challenges_expires_idx
  on public.continuum_founder_webauthn_challenges (expires_at);

alter table public.continuum_founder_webauthn_challenges enable row level security;

revoke all on table public.continuum_founder_webauthn_challenges from public;
revoke all on table public.continuum_founder_webauthn_challenges from anon;
revoke all on table public.continuum_founder_webauthn_challenges from authenticated;

grant all on table public.continuum_founder_webauthn_challenges to service_role;

create or replace function public.continuum_founder_webauthn_consume_challenge(p_jti text)
returns table (
  jti text,
  purpose text,
  founder_user_id text,
  challenge text,
  origin text,
  rp_id text,
  session_fingerprint text,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_webauthn_challenges as c
  set consumed_at = now()
  where c.jti = p_jti
    and c.consumed_at is null
    and c.expires_at > now()
  returning
    c.jti,
    c.purpose,
    c.founder_user_id,
    c.challenge,
    c.origin,
    c.rp_id,
    c.session_fingerprint,
    c.expires_at,
    c.consumed_at,
    c.created_at;
$$;

revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from public;
revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from anon;
revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from authenticated;

grant execute on function public.continuum_founder_webauthn_consume_challenge(text) to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-founder-passkeys-schema.sql
-- =====================================================================

-- =====================================================================
-- BEGIN SOURCE: lib/supabase/continuum-founder-passkey-pairings-schema.sql
-- =====================================================================

-- Continuum founder iPhone passkey pairing (one-time QR bootstrap)
-- UNAPPLIED. Do not run from the app. Service-role / SQL editor only after review.
-- Separate from Client Memory and from WebAuthn credential storage.
-- Stores token HASH only. Never stores the raw QR bearer token, session
-- cookies, or passwords.
-- No policies. No anon/authenticated/PUBLIC grants.
--
-- Founder WebAuthn user.id (stable, not an email):
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_passkey_pairings');

create table if not exists public.continuum_founder_passkey_pairings (
  id uuid primary key default gen_random_uuid(),
  founder_user_id text not null,
  token_hash text not null,
  status text not null check (
    status in ('pending', 'claimed', 'approved', 'completed', 'cancelled')
  ),
  match_code text not null,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
);

create unique index if not exists continuum_founder_passkey_pairings_token_hash_uq
  on public.continuum_founder_passkey_pairings (token_hash);

create index if not exists continuum_founder_passkey_pairings_status_expires_idx
  on public.continuum_founder_passkey_pairings (status, expires_at);

alter table public.continuum_founder_passkey_pairings enable row level security;

revoke all on table public.continuum_founder_passkey_pairings from public;
revoke all on table public.continuum_founder_passkey_pairings from anon;
revoke all on table public.continuum_founder_passkey_pairings from authenticated;

grant all on table public.continuum_founder_passkey_pairings to service_role;

-- Atomic first claim: pending → claimed. Second caller gets zero rows.
create or replace function public.continuum_founder_passkey_pairing_claim(
  p_token_hash text,
  p_claimed_session_hash text,
  p_device_hint text
)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set
    status = 'claimed',
    claimed_session_hash = p_claimed_session_hash,
    device_hint = p_device_hint,
    claimed_at = now()
  where p.token_hash = p_token_hash
    and p.status = 'pending'
    and p.expires_at > now()
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from public;
revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from anon;
revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_claim(text, text, text) to service_role;

-- Atomic status CAS for desktop approve only.
-- Completion is exclusively via continuum_founder_passkey_pairing_finalize
-- so a credential cannot be omitted.
create or replace function public.continuum_founder_passkey_pairing_transition(
  p_id uuid,
  p_from_status text,
  p_to_status text
)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set
    status = 'approved',
    approved_at = now()
  where p.id = p_id
    and p.status = 'claimed'
    and p.expires_at > now()
    and p_from_status = 'claimed'
    and p_to_status = 'approved'
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from public;
revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from anon;
revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) to service_role;

create or replace function public.continuum_founder_passkey_pairing_cancel(p_id uuid)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set status = 'cancelled'
  where p.id = p_id
    and p.status in ('pending', 'claimed', 'approved')
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from public;
revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from anon;
revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_cancel(uuid) to service_role;

-- Atomic enrollment finalization: lock approved pairing, insert credential,
-- mark pairing completed. One transaction. Unique credential_id aborts the
-- whole function so the pairing stays approved and can retry.
-- Requires public.continuum_founder_passkeys to exist.
create or replace function public.continuum_founder_passkey_pairing_finalize(
  p_pairing_id uuid,
  p_founder_user_id text,
  p_claimed_session_hash text,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports jsonb,
  p_device_type text,
  p_backed_up boolean,
  p_label text,
  p_created_at timestamptz
)
returns table (
  id uuid,
  founder_user_id text,
  credential_id text,
  public_key text,
  counter bigint,
  transports jsonb,
  device_type text,
  backed_up boolean,
  created_at timestamptz,
  last_used_at timestamptz,
  label text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pairing_status text;
  pairing_expires timestamptz;
  pairing_founder text;
  pairing_hash text;
  cred public.continuum_founder_passkeys%rowtype;
  completed_id uuid;
begin
  if p_pairing_id is null
     or p_founder_user_id is null
     or p_claimed_session_hash is null
     or p_credential_id is null
     or p_public_key is null
  then
    return;
  end if;

  select p.status, p.expires_at, p.founder_user_id, p.claimed_session_hash
    into pairing_status, pairing_expires, pairing_founder, pairing_hash
  from public.continuum_founder_passkey_pairings as p
  where p.id = p_pairing_id
  for update;

  if pairing_status is null then
    return;
  end if;

  if pairing_status is distinct from 'approved'
     or pairing_expires <= now()
     or pairing_founder is distinct from p_founder_user_id
     or pairing_hash is distinct from p_claimed_session_hash
  then
    return;
  end if;

  insert into public.continuum_founder_passkeys (
    founder_user_id,
    credential_id,
    public_key,
    counter,
    transports,
    device_type,
    backed_up,
    created_at,
    label
  ) values (
    p_founder_user_id,
    p_credential_id,
    p_public_key,
    p_counter,
    p_transports,
    p_device_type,
    p_backed_up,
    coalesce(p_created_at, now()),
    p_label
  )
  returning * into cred;

  update public.continuum_founder_passkey_pairings as p
  set
    status = 'completed',
    completed_at = now()
  where p.id = p_pairing_id
    and p.status = 'approved'
  returning p.id into completed_id;

  if completed_id is null then
    raise exception 'pairing-finalize-race'
      using errcode = 'P0001';
  end if;

  id := cred.id;
  founder_user_id := cred.founder_user_id;
  credential_id := cred.credential_id;
  public_key := cred.public_key;
  counter := cred.counter;
  transports := cred.transports;
  device_type := cred.device_type;
  backed_up := cred.backed_up;
  created_at := cred.created_at;
  last_used_at := cred.last_used_at;
  label := cred.label;
  revoked_at := cred.revoked_at;
  return next;
end;
$$;

revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from public;
revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from anon;
revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) to service_role;

-- =====================================================================
-- END SOURCE: lib/supabase/continuum-founder-passkey-pairings-schema.sql
-- =====================================================================

-- ============================================================================
-- VERIFICATION (SELECT-only). No data insert. Preview sandbox hrmpzplffuhhvbtxxhnt.
-- ============================================================================
SELECT
  object_name,
  object_kind,
  present
FROM (
  VALUES
    ('continuum_entities', 'table', to_regclass('public.continuum_entities') IS NOT NULL),
    ('continuum_external_identities', 'table', to_regclass('public.continuum_external_identities') IS NOT NULL),
    ('continuum_events', 'table', to_regclass('public.continuum_events') IS NOT NULL),
    ('continuum_evidence', 'table', to_regclass('public.continuum_evidence') IS NOT NULL),
    ('continuum_observations', 'table', to_regclass('public.continuum_observations') IS NOT NULL),
    ('continuum_person_profiles', 'table', to_regclass('public.continuum_person_profiles') IS NOT NULL),
    ('continuum_project_profiles', 'table', to_regclass('public.continuum_project_profiles') IS NOT NULL),
    ('continuum_project_history', 'table', to_regclass('public.continuum_project_history') IS NOT NULL),
    ('continuum_project_history_revisions', 'table', to_regclass('public.continuum_project_history_revisions') IS NOT NULL),
    ('continuum_person_facts', 'table', to_regclass('public.continuum_person_facts') IS NOT NULL),
    ('continuum_source_notes', 'table', to_regclass('public.continuum_source_notes') IS NOT NULL),
    ('continuum_source_note_revisions', 'table', to_regclass('public.continuum_source_note_revisions') IS NOT NULL),
    ('continuum_project_jobs', 'table', to_regclass('public.continuum_project_jobs') IS NOT NULL),
    ('continuum_project_job_mutations', 'table', to_regclass('public.continuum_project_job_mutations') IS NOT NULL),
    ('continuum_candidates', 'table', to_regclass('public.continuum_candidates') IS NOT NULL),
    ('continuum_gmail_messages', 'table', to_regclass('public.continuum_gmail_messages') IS NOT NULL),
    ('continuum_gmail_checkpoints', 'table', to_regclass('public.continuum_gmail_checkpoints') IS NOT NULL),
    ('continuum_gmail_connections', 'table', to_regclass('public.continuum_gmail_connections') IS NOT NULL),
    ('continuum_gmail_attachments', 'table', to_regclass('public.continuum_gmail_attachments') IS NOT NULL),
    ('continuum_attention_items', 'table', to_regclass('public.continuum_attention_items') IS NOT NULL),
    ('continuum_attention_briefs', 'table', to_regclass('public.continuum_attention_briefs') IS NOT NULL),
    ('agent_os_persisted_state', 'table', to_regclass('public.agent_os_persisted_state') IS NOT NULL),
    ('agent_os_delivery_claims', 'table', to_regclass('public.agent_os_delivery_claims') IS NOT NULL),
    ('continuum_founder_passkeys', 'table', to_regclass('public.continuum_founder_passkeys') IS NOT NULL),
    ('continuum_founder_passkey_pairings', 'table', to_regclass('public.continuum_founder_passkey_pairings') IS NOT NULL),
    ('continuum_founder_webauthn_challenges', 'table', to_regclass('public.continuum_founder_webauthn_challenges') IS NOT NULL),
    ('continuum_project_custom_details', 'table', to_regclass('public.continuum_project_custom_details') IS NOT NULL),
    ('continuum_project_repair_details', 'table', to_regclass('public.continuum_project_repair_details') IS NOT NULL),
    ('continuum_project_lifecycle_states', 'table', to_regclass('public.continuum_project_lifecycle_states') IS NOT NULL),
    ('continuum_project_artifacts', 'table', to_regclass('public.continuum_project_artifacts') IS NOT NULL),
    (
      'continuum_client_memory_create_person',
      'function',
      to_regprocedure('public.continuum_client_memory_create_person(uuid, timestamptz, text, jsonb, jsonb)') IS NOT NULL
    ),
    (
      'continuum_client_memory_apply_existing_person',
      'function',
      to_regprocedure('public.continuum_client_memory_apply_existing_person(uuid, timestamptz, jsonb, jsonb)') IS NOT NULL
    ),
    (
      'continuum_client_memory_set_current_person_fact',
      'function',
      to_regprocedure('public.continuum_client_memory_set_current_person_fact(uuid, uuid, text, jsonb, numeric, text, text, text, text, timestamptz, timestamptz, text, timestamptz, text)') IS NOT NULL
    ),
    (
      'continuum_client_memory_mutate_source_note',
      'function',
      to_regprocedure('public.continuum_client_memory_mutate_source_note(uuid, uuid, text, timestamptz, text, uuid, text, uuid, uuid, text, boolean)') IS NOT NULL
    ),
    (
      'continuum_client_memory_update_person_contact',
      'function',
      to_regprocedure('public.continuum_client_memory_update_person_contact(uuid, timestamptz, jsonb, jsonb)') IS NOT NULL
    ),
    (
      'continuum_client_memory_correct_project_spec',
      'function',
      to_regprocedure('public.continuum_client_memory_correct_project_spec(uuid, uuid, uuid, text, text, timestamptz, text, text)') IS NOT NULL
    ),
    (
      'continuum_client_memory_correct_project_kind',
      'function',
      to_regprocedure('public.continuum_client_memory_correct_project_kind(uuid, uuid, uuid, text, timestamptz, text, text)') IS NOT NULL
    ),
    (
      'continuum_client_memory_correct_project_operating_detail',
      'function',
      to_regprocedure('public.continuum_client_memory_correct_project_operating_detail(uuid, uuid, uuid, text, text, timestamptz, text, text)') IS NOT NULL
    ),
    (
      'continuum_client_memory_set_project_lifecycle',
      'function',
      to_regprocedure('public.continuum_client_memory_set_project_lifecycle(uuid, text, uuid, uuid, timestamptz, text, text)') IS NOT NULL
    ),
    (
      'continuum_founder_webauthn_consume_challenge',
      'function',
      to_regprocedure('public.continuum_founder_webauthn_consume_challenge(text)') IS NOT NULL
    ),
    (
      'continuum_founder_passkey_pairing_finalize',
      'function',
      to_regprocedure('public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz)') IS NOT NULL
    )
) AS objects(object_name, object_kind, present)
ORDER BY object_kind, object_name;
