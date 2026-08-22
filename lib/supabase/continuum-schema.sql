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
