-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Continuum Blue Book repair quoting V1.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Source: Geller Blue Book Version 5.0 Release 6.50
-- Structured export pointer: RepairTaskSKUs.2026-08-26-17-29-10(1).xlsx
-- Bold Price columns = Geller retail. Cost columns = Hourglass cost basis.
-- Hourglass formula: 2.5 × (Cost Labor × 1.25 + Cost Parts + Cost Other), applied once.
-- Does NOT ship a Geller/Edge price catalog. Does NOT invent repair prices or dwt.
-- Does NOT treat Geller retail as cost. Does NOT mark up Geller retail.
-- Project-linked only. Repair / Service Kind required at write time.
-- Issued quotes are immutable; mutations are append-only.
-- No anon/authenticated grants. RLS remains enabled. No dynamic SQL.
-- No public pricing calculator. No Gmail bodies, notes, or operating-detail inference.

create table if not exists public.continuum_repair_quotes (
  quote_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  quote_number integer not null,
  state text not null,
  repair_type text not null,
  metal_family text not null,
  associated_person_id uuid
    references public.continuum_person_profiles (person_id)
    on delete restrict,
  source_edition_label text not null,
  source_sku text not null,
  line jsonb not null,
  calculation jsonb not null,
  override jsonb,
  issued_at timestamptz,
  issued_by text,
  voided_at timestamptz,
  voided_by text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  created_mutation_id uuid not null,
  issued_mutation_id uuid,
  constraint continuum_repair_quotes_number_uq unique (project_id, quote_number),
  constraint continuum_repair_quotes_created_mutation_uq unique (created_mutation_id),
  constraint continuum_repair_quotes_state_check
    check (state in ('draft', 'issued', 'voided')),
  constraint continuum_repair_quotes_type_check
    check (repair_type in (
      'sizing',
      'head_prong_replacement',
      'laser_work',
      'stone_reset',
      'platinum_labor',
      'fourteen_k_operation'
    )),
  constraint continuum_repair_quotes_metal_check
    check (metal_family in (
      'gold_10k',
      'gold_14k',
      'gold_18k',
      'platinum',
      'other'
    )),
  constraint continuum_repair_quotes_source_edition_check
    check (
      source_edition_label = 'Geller Blue Book Version 5.0 Release 6.50'
    ),
  constraint continuum_repair_quotes_source_sku_check
    check (
      char_length(btrim(source_sku)) between 1 and 40
      and source_sku !~ E'[\\n\\r]'
    ),
  constraint continuum_repair_quotes_cost_basis_check
    check (
      calculation ? 'sourceAmounts'
      and (calculation->>'laborBurdenNumerator') = '5'
      and (calculation->>'laborBurdenDenominator') = '4'
      and (calculation->>'hourglassMarkupNumerator') = '5'
      and (calculation->>'hourglassMarkupDenominator') = '2'
      and (calculation->>'expressSelected') = 'false'
    ),
  constraint continuum_repair_quotes_issued_lock
    check (
      (state = 'issued' and issued_at is not null and issued_by is not null)
      or (state <> 'issued' and issued_at is null)
    ),
  constraint continuum_repair_quotes_voided_lock
    check (
      (state = 'voided' and voided_at is not null and voided_by is not null)
      or (state <> 'voided' and voided_at is null and voided_by is null)
    )
);

comment on table public.continuum_repair_quotes is
  'Geller Blue Book Version 5.0 Release 6.50 repair quotes. Cost columns are the Hourglass basis. Issued rows are immutable snapshots of source Price/Cost, 1.25 labor burden, 2.5x cost markup, raw computed quote, override, and final quote.';

alter table public.continuum_repair_quotes enable row level security;

create table if not exists public.continuum_repair_quote_mutations (
  mutation_id uuid primary key,
  quote_id uuid not null
    references public.continuum_repair_quotes (quote_id)
    on delete restrict,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  action text not null,
  prior_state text,
  new_state text not null,
  prior_hourglass_quote_eighth_cents integer,
  new_hourglass_quote_eighth_cents integer,
  changed_at timestamptz not null,
  changed_by text not null,
  constraint continuum_repair_quote_mutations_action_check
    check (action in ('create', 'revise_draft', 'override', 'issue', 'void'))
);

comment on table public.continuum_repair_quote_mutations is
  'Append-only repair quote history. Issued quotes are never silently repriced.';

alter table public.continuum_repair_quote_mutations enable row level security;

grant select, insert, update on table public.continuum_repair_quotes to service_role;
grant select, insert on table public.continuum_repair_quote_mutations to service_role;
