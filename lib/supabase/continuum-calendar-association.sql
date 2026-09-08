-- Continuum Calendar association — Sprint #23
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Confirmed Calendar event → Person / Project links after
-- founder approval. Event bodies and descriptions are never stored.
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not mint Persons, merge Persons, change Project Kind or lifecycle,
-- create Open Jobs, or broaden Calendar OAuth.

-- ---------------------------------------------------------------------------
-- Confirmed Calendar source links (event → canonical Person or Project)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_calendar_source_links (
  source_ref text not null check (
    char_length(source_ref) >= 8
    and char_length(source_ref) <= 2048
    and source_ref like 'cal1|%'
  ),
  calendar_id text not null check (char_length(calendar_id) >= 1),
  calendar_event_id text not null check (char_length(calendar_event_id) >= 1),
  entity_id text not null check (char_length(entity_id) >= 1),
  entity_kind text not null check (
    entity_kind in ('person', 'project')
  ),
  link_status text not null check (
    link_status = 'confirmed'
  ),
  participant_email_hash text,
  created_at timestamptz not null default now(),
  primary key (source_ref, entity_id)
);

comment on table public.continuum_calendar_source_links is
  'Founder-confirmed Calendar event associations. Written only after explicit Candidate approval. Never event descriptions.';

comment on column public.continuum_calendar_source_links.source_ref is
  'cal1|{calendar_id}|{calendar_event_id}. Matches the frozen Candidate identity pointer.';

comment on column public.continuum_calendar_source_links.participant_email_hash is
  'Supporting attendee/organizer hash when the founder confirmed a Person. Never identity by itself.';

create index if not exists continuum_calendar_source_links_entity_idx
  on public.continuum_calendar_source_links (entity_id);

alter table public.continuum_calendar_source_links enable row level security;

revoke all on table public.continuum_calendar_source_links from public;
revoke all on table public.continuum_calendar_source_links from anon;
revoke all on table public.continuum_calendar_source_links from authenticated;

grant select, insert, update on table public.continuum_calendar_source_links to service_role;

-- ---------------------------------------------------------------------------
-- Founder-confirmed Calendar participant mappings (email_hash → Person)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_calendar_participant_mappings (
  email_hash text not null check (char_length(email_hash) = 64),
  person_id text not null check (char_length(person_id) >= 1),
  confirmed_at timestamptz not null default now(),
  primary key (email_hash, person_id)
);

comment on table public.continuum_calendar_participant_mappings is
  'Exact Calendar participant mappings confirmed by the founder. Email remains supporting evidence until this confirmation.';

alter table public.continuum_calendar_participant_mappings enable row level security;

revoke all on table public.continuum_calendar_participant_mappings from public;
revoke all on table public.continuum_calendar_participant_mappings from anon;
revoke all on table public.continuum_calendar_participant_mappings from authenticated;

grant select, insert, update on table public.continuum_calendar_participant_mappings to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not create continuum_calendar_events.
-- Do not store descriptions, hangout links, or plaintext email.
-- Do not create Open Jobs or change Project Kind / lifecycle from this file.
-- Do not grant delete.
