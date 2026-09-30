-- First-party HourglassDiamonds.com inquiry intake. UNAPPLIED: do not deploy from this branch.
-- Prerequisite: projectless/atomic Open Jobs migration. This ledger is not a second CRM;
-- Person identity and founder work remain canonical in existing Continuum tables.
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'continuum_project_jobs'
      and column_name = 'project_id' and is_nullable = 'YES'
  ) or to_regprocedure(
    'public.continuum_write_project_job(jsonb,uuid,text,text,jsonb,jsonb)'
  ) is null then
    raise exception 'website intake requires verified projectless/atomic Open Jobs';
  end if;
end $$;

create table public.continuum_website_intakes (
  intake_id uuid primary key,
  idempotency_key_hash text not null unique,
  payload_hash text not null,
  source text not null default 'hourglassdiamonds.com/concierge',
  status text not null check (status in ('ready', 'needs_review', 'synthetic_verified')),
  identity_status text not null check (identity_status in ('matched', 'new', 'needs_review', 'synthetic')),
  person_id uuid references public.continuum_person_profiles (person_id) on delete restrict,
  job_id uuid references public.continuum_project_jobs (job_id) on delete restrict,
  identity_review_id uuid references public.continuum_identity_reviews (id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  preferred_contact_method text not null check (preferred_contact_method in ('email', 'phone', 'text', 'any')),
  category text not null check (category in (
    'engagement_ring', 'custom_design', 'wedding_bands',
    'jewelry_diamond_sourcing', 'repair_service',
    'existing_client_follow_up', 'other'
  )),
  project_type text not null,
  shape_interest text not null,
  design_direction text not null,
  ring_presence text not null,
  timeline text not null,
  budget_range text not null,
  inspiration_notes text not null default '',
  attribution jsonb not null default '{}'::jsonb,
  synthetic boolean not null default false,
  acknowledgement_state text not null check (
    acknowledgement_state in ('not_expected', 'pending', 'sent', 'failed')
  ),
  hubspot_status text not null default 'pending' check (
    hubspot_status in ('pending', 'succeeded', 'failed', 'skipped')
  ),
  hubspot_contact_id text,
  hubspot_deal_id text,
  hubspot_error_code text,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint continuum_website_intakes_hashes_check check (
    idempotency_key_hash ~ '^[a-f0-9]{64}$' and payload_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint continuum_website_intakes_shape_check check (
    char_length(full_name) between 1 and 120
    and char_length(email) between 3 and 254
    and (phone is null or char_length(phone) <= 40)
    and char_length(project_type) between 1 and 80
    and char_length(shape_interest) between 1 and 80
    and char_length(design_direction) between 1 and 80
    and char_length(ring_presence) between 1 and 80
    and char_length(timeline) between 1 and 80
    and char_length(budget_range) between 1 and 80
    and char_length(inspiration_notes) <= 5000
    and octet_length(attribution::text) <= 8192
  ),
  constraint continuum_website_intakes_synthetic_isolation_check check (
    (synthetic and status = 'synthetic_verified' and identity_status = 'synthetic'
      and person_id is null and job_id is null and identity_review_id is null
      and hubspot_status = 'skipped')
    or
    (not synthetic and status in ('ready', 'needs_review')
      and identity_status in ('matched', 'new', 'needs_review') and job_id is not null)
  )
);

create index continuum_website_intakes_review_idx
  on public.continuum_website_intakes (status, submitted_at desc)
  where status = 'needs_review';
create index continuum_website_intakes_person_idx
  on public.continuum_website_intakes (person_id, submitted_at desc)
  where person_id is not null;

alter table public.continuum_website_intakes enable row level security;
revoke all on table public.continuum_website_intakes from public, anon, authenticated;
grant select, insert, update on table public.continuum_website_intakes to service_role;

comment on table public.continuum_website_intakes is
  'Service-role-only first-party inquiry ledger and provenance. Canonical people and work remain in existing Continuum tables.';
comment on column public.continuum_website_intakes.idempotency_key_hash is
  'SHA-256 of the opaque public submission token; never a Continuum entity identifier.';

create or replace function public.continuum_ingest_website_inquiry(
  p_intake_id uuid,
  p_person_id uuid,
  p_email_identity_id uuid,
  p_phone_identity_id uuid,
  p_identity_review_id uuid,
  p_job_id uuid,
  p_job_mutation_id uuid,
  p_idempotency_key_hash text,
  p_payload_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.continuum_website_intakes%rowtype;
  matched_people uuid[];
  resolved_person_id uuid;
  resolved_identity_status text;
  resolved_status text;
  resolved_review_id uuid;
  is_synthetic boolean := coalesce((p_payload->>'synthetic')::boolean, false);
  submitted_at timestamptz := (p_payload->>'submitted_at')::timestamptz;
  job_subject text;
  job_detail text;
  acknowledgement_state text;
begin
  if p_intake_id is null or p_person_id is null or p_email_identity_id is null
     or p_phone_identity_id is null or p_identity_review_id is null
     or p_job_id is null or p_job_mutation_id is null
     or p_idempotency_key_hash !~ '^[a-f0-9]{64}$'
     or p_payload_hash !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ?& array[
       'full_name','given_name','email','email_hash','preferred_contact_method',
       'category','project_type','shape_interest','design_direction','ring_presence',
       'timeline','budget_range','inspiration_notes','attribution','source',
       'acknowledgement_expected','synthetic','submitted_at'
     ]) then
    raise exception 'invalid-input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key_hash, 0));
  select * into existing from public.continuum_website_intakes
    where idempotency_key_hash = p_idempotency_key_hash;
  if found then
    if existing.payload_hash is distinct from p_payload_hash then
      raise exception 'idempotency-conflict';
    end if;
    return jsonb_build_object(
      'status', 'already-present', 'intake_id', existing.intake_id,
      'identity_status', existing.identity_status, 'person_id', existing.person_id,
      'job_id', existing.job_id, 'hubspot_status', existing.hubspot_status
    );
  end if;

  if char_length(p_payload->>'full_name') not between 1 and 120
     or (p_payload->>'full_name') ~ E'[\\n\\r]'
     or char_length(p_payload->>'email') not between 3 and 254
     or (p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or (p_payload->>'email_hash') !~ '^[a-f0-9]{64}$'
     or (p_payload->>'phone_hash' is not null and p_payload->>'phone_hash' !~ '^[a-f0-9]{64}$')
     or coalesce(char_length(p_payload->>'phone'), 0) > 40
     or p_payload->>'preferred_contact_method' not in ('email','phone','text','any')
     or p_payload->>'category' not in (
       'engagement_ring','custom_design','wedding_bands','jewelry_diamond_sourcing',
       'repair_service','existing_client_follow_up','other'
     )
     or p_payload->>'project_type' not in ('Engagement Ring','Custom Jewelry','Wedding Band','Still Exploring')
     or p_payload->>'shape_interest' not in ('Round','Oval','Radiant','Cushion','Emerald','Pear','Marquise','Not Sure Yet')
     or p_payload->>'design_direction' not in ('Quiet Elegance','Modern Minimal','Classic Timeless','Bold Presence','Still Discovering')
     or p_payload->>'ring_presence' not in ('Understated','Balanced','Statement','Still Exploring')
     or p_payload->>'timeline' not in ('0–2 months','3–4 months','6+ months','Flexible')
     or p_payload->>'budget_range' not in ('Under 10k','10–20k','20–30k','30–50k','50k+','Prefer to Discuss')
     or char_length(p_payload->>'inspiration_notes') > 5000
     or jsonb_typeof(p_payload->'attribution') <> 'object'
     or octet_length((p_payload->'attribution')::text) > 8192
     or p_payload->>'source' <> 'hourglassdiamonds.com/concierge'
     or submitted_at is null then
    raise exception 'invalid-input';
  end if;

  acknowledgement_state := case
    when (p_payload->>'acknowledgement_expected')::boolean then 'pending'
    else 'not_expected'
  end;

  if is_synthetic then
    insert into public.continuum_website_intakes (
      intake_id, idempotency_key_hash, payload_hash, source, status,
      identity_status, full_name, email, phone, preferred_contact_method,
      category, project_type, shape_interest, design_direction, ring_presence,
      timeline, budget_range, inspiration_notes, attribution, synthetic,
      acknowledgement_state, hubspot_status, submitted_at, created_at, updated_at
    ) values (
      p_intake_id, p_idempotency_key_hash, p_payload_hash, p_payload->>'source',
      'synthetic_verified', 'synthetic', p_payload->>'full_name', p_payload->>'email',
      nullif(p_payload->>'phone',''), p_payload->>'preferred_contact_method',
      p_payload->>'category', p_payload->>'project_type', p_payload->>'shape_interest',
      p_payload->>'design_direction', p_payload->>'ring_presence', p_payload->>'timeline',
      p_payload->>'budget_range', p_payload->>'inspiration_notes', p_payload->'attribution',
      true, acknowledgement_state, 'skipped', submitted_at, submitted_at, submitted_at
    );
    return jsonb_build_object(
      'status','created','intake_id',p_intake_id,'identity_status','synthetic',
      'person_id',null,'job_id',null,'hubspot_status','skipped'
    );
  end if;

  -- Serialize exact identity claims so concurrent first submissions cannot mint two People.
  perform pg_advisory_xact_lock(hashtextextended(p_payload->>'email_hash', 1));
  if p_payload->>'phone_hash' is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_payload->>'phone_hash', 1));
  end if;

  select coalesce(array_agg(distinct i.entity_id) filter (where i.entity_id is not null), '{}'::uuid[])
    into matched_people
  from public.continuum_external_identities i
  join public.continuum_person_profiles profile on profile.person_id = i.entity_id
  where i.revoked_at is null and (
    (i.identity_kind = 'email_hash' and i.identifier = p_payload->>'email_hash')
    or
    (p_payload->>'phone_hash' is not null and i.identity_kind = 'phone_hash'
      and i.identifier = p_payload->>'phone_hash')
  );

  if cardinality(matched_people) > 1 then
    resolved_identity_status := 'needs_review';
    resolved_status := 'needs_review';
    resolved_person_id := null;
    resolved_review_id := p_identity_review_id;
    insert into public.continuum_identity_reviews (
      id, status, reason_code, left_person_id, right_person_id, import_row_key,
      issue_text, resolution_text, source_system, created_at
    ) values (
      p_identity_review_id, 'open', 'REVIEW_CROSS_KEY_CONFLICT', matched_people[1],
      matched_people[2], 'website-intake:' || p_idempotency_key_hash,
      'Website inquiry identity claims resolve to multiple existing People.',
      null, 'continuum', submitted_at
    );
  elsif cardinality(matched_people) = 1 then
    resolved_identity_status := 'matched';
    resolved_status := 'ready';
    resolved_person_id := matched_people[1];
    resolved_review_id := null;
  else
    resolved_identity_status := 'new';
    resolved_status := 'ready';
    resolved_person_id := p_person_id;
    resolved_review_id := null;
    insert into public.continuum_entities (id, kind, created_at, created_by)
      values (p_person_id, 'person', submitted_at, 'website-intake');
    insert into public.continuum_person_profiles (
      person_id, display_name, given_name, family_name, organization_name,
      email, phone, street_address, city, state, country, postal_code,
      roles, source_system, created_at, updated_at
    ) values (
      p_person_id, p_payload->>'full_name', p_payload->>'given_name',
      nullif(p_payload->>'family_name',''), null, p_payload->>'email',
      nullif(p_payload->>'phone',''), null, null, null, null, null,
      array['prospect']::text[], 'continuum', submitted_at, submitted_at
    );
    insert into public.continuum_external_identities (
      id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at
    ) values (
      p_email_identity_id, p_person_id, 'continuum', 'email_hash',
      p_payload->>'email_hash', submitted_at, null
    );
    if p_payload->>'phone_hash' is not null then
      insert into public.continuum_external_identities (
        id, entity_id, source_system, identity_kind, identifier, created_at, revoked_at
      ) values (
        p_phone_identity_id, p_person_id, 'continuum', 'phone_hash',
        p_payload->>'phone_hash', submitted_at, null
      );
    end if;
  end if;

  job_subject := left('Website inquiry — ' || p_payload->>'full_name', 160);
  job_detail := left(concat_ws(E'\n',
    'Classification: ' || p_payload->>'category',
    'Project type: ' || p_payload->>'project_type',
    'Timeline: ' || p_payload->>'timeline',
    'Budget: ' || p_payload->>'budget_range',
    'Preferred contact: ' || p_payload->>'preferred_contact_method',
    case when resolved_identity_status = 'needs_review' then 'Identity: needs review' else null end,
    case when p_payload->>'inspiration_notes' <> '' then E'Notes:\n' || p_payload->>'inspiration_notes' else null end
  ), 2000);

  perform public.continuum_write_project_job(
    jsonb_build_object(
      'job_id', p_job_id, 'project_id', null, 'kind', 'required_action',
      'subject', job_subject, 'detail', job_detail, 'waiting_on_actor', 'founder',
      'associated_person_id', resolved_person_id, 'state', 'open', 'due_at', null,
      'deferred_until', null, 'resolved_at', null, 'cancelled_at', null,
      'created_at', submitted_at, 'updated_at', submitted_at,
      'created_by', 'website-intake', 'source_system', 'continuum',
      'source_ref', 'website-intake:' || p_intake_id::text,
      'created_mutation_id', p_job_mutation_id
    ),
    p_job_mutation_id, 'create', 'website-intake', null,
    jsonb_build_object('operation','website-inquiry-intake','intake_id',p_intake_id)
  );

  insert into public.continuum_website_intakes (
    intake_id, idempotency_key_hash, payload_hash, source, status, identity_status,
    person_id, job_id, identity_review_id, full_name, email, phone,
    preferred_contact_method, category, project_type, shape_interest,
    design_direction, ring_presence, timeline, budget_range, inspiration_notes,
    attribution, synthetic, acknowledgement_state, hubspot_status,
    submitted_at, created_at, updated_at
  ) values (
    p_intake_id, p_idempotency_key_hash, p_payload_hash, p_payload->>'source',
    resolved_status, resolved_identity_status, resolved_person_id, p_job_id,
    resolved_review_id, p_payload->>'full_name', p_payload->>'email',
    nullif(p_payload->>'phone',''), p_payload->>'preferred_contact_method',
    p_payload->>'category', p_payload->>'project_type', p_payload->>'shape_interest',
    p_payload->>'design_direction', p_payload->>'ring_presence', p_payload->>'timeline',
    p_payload->>'budget_range', p_payload->>'inspiration_notes', p_payload->'attribution',
    false, acknowledgement_state, 'pending', submitted_at, submitted_at, submitted_at
  );

  return jsonb_build_object(
    'status','created','intake_id',p_intake_id,'identity_status',resolved_identity_status,
    'person_id',resolved_person_id,'job_id',p_job_id,'hubspot_status','pending'
  );
end;
$$;

revoke all on function public.continuum_ingest_website_inquiry(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.continuum_ingest_website_inquiry(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,jsonb
) to service_role;

create or replace function public.continuum_record_website_intake_hubspot(
  p_intake_id uuid,
  p_status text,
  p_contact_id text default null,
  p_deal_id text default null,
  p_error_code text default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status not in ('succeeded','failed','skipped')
     or coalesce(char_length(p_contact_id),0) > 120
     or coalesce(char_length(p_deal_id),0) > 120
     or coalesce(char_length(p_error_code),0) > 120 then
    raise exception 'invalid-input';
  end if;
  update public.continuum_website_intakes set
    hubspot_status = p_status,
    hubspot_contact_id = case when p_status = 'succeeded' then p_contact_id else null end,
    hubspot_deal_id = case when p_status = 'succeeded' then p_deal_id else null end,
    hubspot_error_code = case when p_status = 'failed' then p_error_code else null end,
    updated_at = now()
  where intake_id = p_intake_id and synthetic = false;
end;
$$;

revoke all on function public.continuum_record_website_intake_hubspot(
  uuid,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.continuum_record_website_intake_hubspot(
  uuid,text,text,text,text
) to service_role;

commit;
