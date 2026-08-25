-- Continuum Chief of Staff 2.0 Phase 1A — attention spine.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION.
--
-- Protected founder attention. May contain person names and recommended actions.
-- Does NOT write into continuum_observations (kernel remains PII-free).
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Depends on continuum_entities from lib/supabase/continuum-schema.sql.

-- ---------------------------------------------------------------------------
-- Attention items
-- ---------------------------------------------------------------------------

create table if not exists continuum_attention_items (
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
  person_id uuid references continuum_entities (id),
  project_id uuid references continuum_entities (id),
  observation_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
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

comment on table continuum_attention_items is
  'Protected Chief of Staff attention items. Founder-only copy. Not kernel observations.';

create unique index if not exists continuum_attention_items_open_dedupe_uq
  on continuum_attention_items (dedupe_key)
  where status in ('new', 'seen', 'acknowledged', 'snoozed');

create index if not exists continuum_attention_items_status_idx
  on continuum_attention_items (status, created_at desc);

create index if not exists continuum_attention_items_person_idx
  on continuum_attention_items (person_id)
  where person_id is not null;

create index if not exists continuum_attention_items_project_idx
  on continuum_attention_items (project_id)
  where project_id is not null;

-- ---------------------------------------------------------------------------
-- Daily brief snapshot (one row per America/New_York local date)
-- ---------------------------------------------------------------------------

create table if not exists continuum_attention_briefs (
  id uuid primary key,
  local_date date not null,
  generated_at timestamptz not null,
  attention_item_ids uuid[] not null default '{}',
  worth_knowing jsonb not null default '[]'::jsonb,
  silence_reason text,
  created_at timestamptz not null default now()
);

comment on table continuum_attention_briefs is
  'Canonical daily Chief of Staff snapshot. One row per founder-local date.';

create unique index if not exists continuum_attention_briefs_local_date_uq
  on continuum_attention_briefs (local_date);

alter table continuum_attention_items enable row level security;
alter table continuum_attention_briefs enable row level security;

revoke all on table continuum_attention_items from public;
revoke all on table continuum_attention_items from anon;
revoke all on table continuum_attention_items from authenticated;
revoke all on table continuum_attention_briefs from public;
revoke all on table continuum_attention_briefs from anon;
revoke all on table continuum_attention_briefs from authenticated;

grant select, insert, update, delete on table continuum_attention_items to service_role;
grant select, insert, update, delete on table continuum_attention_briefs to service_role;
