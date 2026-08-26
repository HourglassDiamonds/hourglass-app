-- Continuum digital business card + identity-exchange (schema version 1).
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Public card fields live here, not on continuum_person_profiles.
-- Visitor identity still resolves to canonical Client Memory Persons.
-- Interaction records stay on the protected PII plane (not the kernel).
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create kernel Event/Evidence/Observation tables.
-- Does not create Person, fact, note, wish, or Gmail tables.

-- ---------------------------------------------------------------------------
-- Owner digital cards (curated public identity)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_digital_cards (
  id uuid primary key,
  owner_username text not null,
  owner_person_id uuid references public.continuum_entities (id),
  slug text not null,
  published boolean not null default false,
  display_name text not null,
  memorable_title text,
  professional_title text,
  company text,
  email text,
  email_public boolean not null default true,
  phone text,
  phone_public boolean not null default true,
  website_url text,
  linkedin_url text,
  instagram_url text,
  additional_links jsonb not null default '[]'::jsonb,
  avatar_url text,
  source_system text not null default 'continuum-card' check (source_system = 'continuum-card'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint continuum_digital_cards_slug_format_chk check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 48
  ),
  constraint continuum_digital_cards_display_name_chk check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  constraint continuum_digital_cards_additional_links_chk check (
    jsonb_typeof(additional_links) = 'array'
  )
);

comment on table public.continuum_digital_cards is
  'Curated public digital card. Not a Person profile. Private Continuum fields never belong here.';

comment on column public.continuum_digital_cards.slug is
  'Durable public URL key for /c/[slug]. Not an internal Continuum UUID.';

comment on column public.continuum_digital_cards.owner_person_id is
  'Optional later link to the owner Person. V1 cards are keyed by owner_username.';

create unique index if not exists continuum_digital_cards_slug_uq
  on public.continuum_digital_cards (slug);

create unique index if not exists continuum_digital_cards_owner_uq
  on public.continuum_digital_cards (owner_username);

alter table public.continuum_digital_cards enable row level security;

revoke all on table public.continuum_digital_cards from public;
revoke all on table public.continuum_digital_cards from anon;
revoke all on table public.continuum_digital_cards from authenticated;

grant all on table public.continuum_digital_cards to service_role;

-- ---------------------------------------------------------------------------
-- Optional networking-mode context (architectural hook, no V1 UI)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_digital_card_contexts (
  id uuid primary key,
  card_id uuid not null references public.continuum_digital_cards (id),
  public_token text not null,
  label text not null,
  status text not null check (status in ('draft', 'active', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  source_system text not null default 'continuum-card' check (source_system = 'continuum-card'),
  created_at timestamptz not null default now(),
  constraint continuum_digital_card_contexts_token_chk check (
    char_length(public_token) between 8 and 64
  ),
  constraint continuum_digital_card_contexts_label_chk check (
    char_length(btrim(label)) between 1 and 120
  )
);

comment on table public.continuum_digital_card_contexts is
  'Future networking-mode sessions. Exchanges may inherit context. V1 has no founder UI.';

comment on column public.continuum_digital_card_contexts.public_token is
  'Opaque public token for ?ctx=. Never the internal context UUID.';

create unique index if not exists continuum_digital_card_contexts_token_uq
  on public.continuum_digital_card_contexts (public_token);

create unique index if not exists continuum_digital_card_contexts_one_active_uq
  on public.continuum_digital_card_contexts (card_id)
  where status = 'active';

alter table public.continuum_digital_card_contexts enable row level security;

revoke all on table public.continuum_digital_card_contexts from public;
revoke all on table public.continuum_digital_card_contexts from anon;
revoke all on table public.continuum_digital_card_contexts from authenticated;

grant all on table public.continuum_digital_card_contexts to service_role;

-- ---------------------------------------------------------------------------
-- Identity-exchange interactions (protected PII plane)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_identity_exchanges (
  id uuid primary key,
  occurred_at timestamptz not null,
  card_id uuid not null references public.continuum_digital_cards (id),
  card_slug text not null,
  context_id uuid references public.continuum_digital_card_contexts (id),
  owner_username text not null,
  owner_person_id uuid references public.continuum_entities (id),
  counterparty_person_id uuid references public.continuum_entities (id),
  event_type text not null check (event_type in ('identity_exchange', 'digital_card_exchange')),
  source_system text not null default 'continuum-card' check (source_system = 'continuum-card'),
  resolution_status text not null check (
    resolution_status in ('matched', 'created', 'review')
  ),
  reason_code text not null,
  submission_id uuid not null,
  submitted_contact jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.continuum_identity_exchanges is
  'Protected identity-exchange events. Counterparty PII is here and on Person, never on public card routes or kernel events.';

comment on column public.continuum_identity_exchanges.submitted_contact is
  'Original visitor payload for audit and Concierge review. Internal only. Never copy submitted contact snapshots into the PII-free kernel.';

create unique index if not exists continuum_identity_exchanges_submission_uq
  on public.continuum_identity_exchanges (submission_id);

create index if not exists continuum_identity_exchanges_person_idx
  on public.continuum_identity_exchanges (counterparty_person_id, occurred_at desc);

create index if not exists continuum_identity_exchanges_card_idx
  on public.continuum_identity_exchanges (card_id, occurred_at desc);

alter table public.continuum_identity_exchanges enable row level security;

revoke all on table public.continuum_identity_exchanges from public;
revoke all on table public.continuum_identity_exchanges from anon;
revoke all on table public.continuum_identity_exchanges from authenticated;

grant all on table public.continuum_identity_exchanges to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
