-- Continuum Performance natural ingestion — founder beta.
-- Applied only to the non-production Continuum Preview project. Do not run against production without separate approval.
-- Service-role only. Founder authorization is enforced by the existing
-- executive-dashboard session before any server adapter is reached.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'continuum-performance-sources',
  'continuum-performance-sources',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.continuum_performance_state (
  founder_key text primary key,
  schema_version integer not null check (schema_version = 3),
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.continuum_performance_audit (
  id uuid primary key,
  founder_key text not null references public.continuum_performance_state (founder_key) on delete cascade,
  idempotency_key text not null,
  action text not null check (action in ('bootstrap', 'snapshot', 'accept_meal', 'accept_activity', 'edit_meal', 'edit_activity', 'reject_proposal', 'delete_source')),
  entry_id text,
  source_type text check (source_type is null or source_type in ('text', 'meal_photo', 'nutrition_label', 'activity_screenshot')),
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint continuum_performance_audit_idempotency_uq unique (founder_key, idempotency_key)
);

create table if not exists public.continuum_performance_evidence (
  audit_id uuid primary key references public.continuum_performance_audit (id),
  founder_key text not null,
  raw_input text,
  proposal jsonb,
  accepted jsonb,
  corrections jsonb not null default '[]'::jsonb,
  source_storage_path text,
  source_expires_at timestamptz,
  source_deleted_at timestamptz,
  sensitive_expires_at timestamptz not null,
  sensitive_deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists continuum_performance_audit_entry_idx
  on public.continuum_performance_audit (founder_key, entry_id, created_at desc);

alter table public.continuum_performance_state enable row level security;
alter table public.continuum_performance_audit enable row level security;
alter table public.continuum_performance_evidence enable row level security;

revoke all on table public.continuum_performance_state from public, anon, authenticated;
revoke all on table public.continuum_performance_audit from public, anon, authenticated;
revoke all on table public.continuum_performance_evidence from public, anon, authenticated;
grant select, insert, update on table public.continuum_performance_state to service_role;
grant select, insert on table public.continuum_performance_audit to service_role;
grant select, insert, update on table public.continuum_performance_evidence to service_role;

create or replace function public.continuum_performance_save(
  p_founder_key text,
  p_expected_revision bigint,
  p_schema_version integer,
  p_state jsonb,
  p_audit_id uuid,
  p_idempotency_key text,
  p_action text,
  p_entry_id text,
  p_source_type text,
  p_evidence_hash text,
  p_raw_input text,
  p_proposal jsonb,
  p_accepted jsonb,
  p_corrections jsonb,
  p_source_storage_path text,
  p_source_expires_at timestamptz,
  p_sensitive_expires_at timestamptz,
  p_created_at timestamptz
)
returns table(saved_state jsonb, saved_revision bigint, was_duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb;
  v_revision bigint;
begin
  if p_expected_revision < 0 then
    raise exception 'performance_revision_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_founder_key, 0));
  select state, revision into v_state, v_revision
    from public.continuum_performance_state
    where founder_key = p_founder_key
    for update;

  if exists (
    select 1 from public.continuum_performance_audit
    where founder_key = p_founder_key and idempotency_key = p_idempotency_key
  ) then
    if v_revision is null then raise exception 'performance_duplicate_without_state'; end if;
    return query select v_state, v_revision, true;
    return;
  end if;

  if coalesce(v_revision, 0) <> p_expected_revision then
    raise exception using errcode = '40001', message = 'performance_revision_conflict', detail = concat('expected=', p_expected_revision, ',current=', coalesce(v_revision, 0));
  end if;

  v_revision := coalesce(v_revision, 0) + 1;
  insert into public.continuum_performance_state (founder_key, schema_version, state, revision, created_at, updated_at)
  values (p_founder_key, p_schema_version, p_state, v_revision, p_created_at, p_created_at)
  on conflict (founder_key) do update set
    schema_version = excluded.schema_version,
    state = excluded.state,
    revision = excluded.revision,
    updated_at = excluded.updated_at;

  insert into public.continuum_performance_audit (id, founder_key, idempotency_key, action, entry_id, source_type, evidence_hash, created_at)
  values (p_audit_id, p_founder_key, p_idempotency_key, p_action, p_entry_id, p_source_type, p_evidence_hash, p_created_at);

  if p_action = 'delete_source' and p_source_storage_path is not null then
    update public.continuum_performance_evidence
      set source_deleted_at = p_created_at
      where founder_key = p_founder_key
        and source_storage_path = p_source_storage_path
        and source_deleted_at is null;
  end if;

  insert into public.continuum_performance_evidence (audit_id, founder_key, raw_input, proposal, accepted, corrections, source_storage_path, source_expires_at, source_deleted_at, sensitive_expires_at, created_at)
  values (p_audit_id, p_founder_key, p_raw_input, p_proposal, p_accepted, coalesce(p_corrections, '[]'::jsonb), p_source_storage_path, p_source_expires_at, case when p_action = 'delete_source' then p_created_at else null end, p_sensitive_expires_at, p_created_at);

  return query select p_state, v_revision, false;
end;
$$;

revoke execute on function public.continuum_performance_save(text, bigint, integer, jsonb, uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.continuum_performance_save(text, bigint, integer, jsonb, uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz, timestamptz) to service_role;

comment on table public.continuum_performance_state is
  'Founder-scoped canonical Performance state. Service-role only; schema v3 anchors Week 1 on 2026-10-12.';
comment on table public.continuum_performance_audit is
  'Immutable mutation provenance, integrity hashes, and idempotency ledger. Sensitive evidence is separated for minimization.';
comment on table public.continuum_performance_evidence is
  'Founder-scoped evidence with 90-day source and sensitive-payload retention metadata. Cleanup is manual until verified; approved structured state is retained.';
