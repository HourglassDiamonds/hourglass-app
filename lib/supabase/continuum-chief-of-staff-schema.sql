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
