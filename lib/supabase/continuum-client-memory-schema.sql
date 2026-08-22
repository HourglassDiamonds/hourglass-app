-- Continuum Client Memory V1 (Phase 1).
-- Schema document version: 1
-- UNAPPLIED DRAFT. DO NOT APPLY TO PRODUCTION.
--
-- Repeatable in intent (IF NOT EXISTS) but this file is not an activation
-- path. Do not run it in the Supabase SQL editor until a later reviewed gate.
--
-- SERVICE-ROLE ONLY: RLS is enabled with NO policies for anon/authenticated.
-- Application access must use SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not grant table privileges to anon or authenticated roles.
--
-- Person remains continuum_entities.kind = 'person'. Client is a role on
-- Person, not a separate entity kind. Household/vendor/CAD-production and
-- financial-ledger tables are out of scope for this draft.
--
-- Protected PII plane: raw name/email/phone/address/notes live only in
-- Client Memory profile and source-note tables. They must never be copied
-- into continuum_events.payload, continuum_evidence.summary, or
-- continuum_observations.statement/value.
--
-- HubSpot deal IDs are not person identities (no hubspot_deal_id identity_kind).

-- ---------------------------------------------------------------------------
-- Kernel extensions (existing Phase 1B tables). Documented, not applied.
-- Production continuum_external_identities currently allows:
--   hubspot_contact_id, email_hash, phone_hash, google_contact_id
-- Client Memory V1 also requires import_row_key. After review, replace the
-- identity_kind check and allow source_system 'continuum-reconciliation-v3'.
-- Example (DO NOT RUN):
--   alter table continuum_external_identities drop constraint if exists
--     continuum_external_identities_identity_kind_check;
--   alter table continuum_external_identities add constraint
--     continuum_external_identities_identity_kind_check
--     check (identity_kind in (
--       'hubspot_contact_id',
--       'email_hash',
--       'phone_hash',
--       'google_contact_id',
--       'import_row_key'
--     ));
-- Do not add hubspot_deal_id.
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
  roles text[] not null default '{}',
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table continuum_person_profiles is
  'Protected one-to-one Person profile. Raw PII. Client is a role, not an entity.';

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
      'household-member'
    )
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
  visibility text not null,
  usage_permission text not null,
  valid_from timestamptz,
  valid_until timestamptz,
  supersedes_id uuid references continuum_person_facts (id),
  source_system text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists continuum_person_facts_person_idx
  on continuum_person_facts (person_id, fact_type, status);

comment on table continuum_person_facts is
  'Constrained person facts. No silent overwrite; supersede with a new row.';

create table if not exists continuum_source_notes (
  id uuid primary key,
  person_id uuid references continuum_entities (id),
  project_id uuid references continuum_entities (id),
  source_system text not null,
  source_artifact text not null,
  source_sheet text not null,
  import_row_key text not null,
  gmail_thread_id text,
  note_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists continuum_source_notes_person_idx
  on continuum_source_notes (person_id);

create index if not exists continuum_source_notes_project_idx
  on continuum_source_notes (project_id);

create unique index if not exists continuum_source_notes_import_row_uq
  on continuum_source_notes (source_system, import_row_key);

comment on table continuum_source_notes is
  'Protected raw notes. Prose/PII belongs here, not in generic Evidence summary.';

create table if not exists continuum_wishes (
  id uuid primary key,
  person_id uuid not null references continuum_entities (id),
  household_id uuid,
  project_id uuid references continuum_entities (id),
  related_fact_id uuid references continuum_person_facts (id),
  description text not null,
  category text,
  status text not null,
  visibility text not null,
  usage_permission text not null,
  source_system text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create index if not exists continuum_wishes_person_idx
  on continuum_wishes (person_id);

create table if not exists continuum_project_profiles (
  project_id uuid primary key references continuum_entities (id),
  display_title text not null,
  cad_job_number text,
  order_number text,
  gmail_thread_id text,
  match_judgment text,
  attributes jsonb not null default '{}'::jsonb,
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table continuum_project_profiles is
  'Protected/internal project profile. CAD/job number is not a HubSpot deal id. Finger size/metal/stone stay project-scoped unless later promoted.';

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
alter table continuum_identity_reviews enable row level security;
alter table continuum_fact_evidence enable row level security;
alter table continuum_wish_evidence enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Service role bypasses RLS; that is the only intended access path.
