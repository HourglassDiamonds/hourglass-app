-- Metadata-only continuity for founder-triggered Sterling Today evidence assembly.
-- UNAPPLIED: database execution requires separate founder authorization.
-- Stores keyed digests and chronology metadata only; never Gmail identifiers or content.
begin;

create table public.continuum_sterling_today_thread_verifications (
  thread_key_digest text primary key,
  indexed_fingerprint text not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  latest_indexed_message_at timestamptz,
  indexed_message_count integer not null,
  verification_status text not null default 'complete_live',
  revision bigint not null default 1,
  updated_at timestamptz not null,
  constraint continuum_sterling_today_thread_verifications_key_check
    check (thread_key_digest ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_today_thread_verifications_fingerprint_check
    check (indexed_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_today_thread_verifications_count_check
    check (indexed_message_count >= 0 and indexed_message_count <= 10000),
  constraint continuum_sterling_today_thread_verifications_status_check
    check (verification_status = 'complete_live'),
  constraint continuum_sterling_today_thread_verifications_revision_check
    check (revision > 0),
  constraint continuum_sterling_today_thread_verifications_expiry_check
    check (expires_at = verified_at + interval '15 minutes'),
  constraint continuum_sterling_today_thread_verifications_update_check
    check (updated_at >= verified_at - interval '2 minutes')
);

alter table public.continuum_sterling_today_thread_verifications enable row level security;

revoke all on table public.continuum_sterling_today_thread_verifications
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.continuum_sterling_today_thread_verifications
  to service_role;

comment on table public.continuum_sterling_today_thread_verifications is
  'Service-role-only Sterling assembly verification metadata. Contains no Gmail identifiers, content, participants, attachments, prompts, responses, or client data.';

create or replace function public.continuum_read_sterling_today_thread_verifications(
  p_thread_key_digests text[]
) returns table (
  thread_key_digest text,
  indexed_fingerprint text,
  verified_at timestamptz,
  expires_at timestamptz,
  latest_indexed_message_at timestamptz,
  indexed_message_count integer,
  verification_status text,
  revision bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_thread_key_digests is null
     or coalesce(array_length(p_thread_key_digests, 1), 0) > 512
     or exists (
       select 1 from unnest(p_thread_key_digests) as requested(digest)
       where requested.digest is null or requested.digest !~ '^[a-f0-9]{64}$'
     ) then
    raise exception 'sterling_today_verification_read_invalid';
  end if;

  return query
  select
    verification.thread_key_digest,
    verification.indexed_fingerprint,
    verification.verified_at,
    verification.expires_at,
    verification.latest_indexed_message_at,
    verification.indexed_message_count,
    verification.verification_status,
    verification.revision
  from public.continuum_sterling_today_thread_verifications as verification
  where verification.thread_key_digest = any (p_thread_key_digests);
end;
$$;

create or replace function public.continuum_record_sterling_today_thread_verification(
  p_thread_key_digest text,
  p_indexed_fingerprint text,
  p_verified_at timestamptz,
  p_latest_indexed_message_at timestamptz,
  p_indexed_message_count integer,
  p_expected_revision bigint
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.continuum_sterling_today_thread_verifications%rowtype;
  resulting_revision bigint;
begin
  if p_thread_key_digest is null
     or p_thread_key_digest !~ '^[a-f0-9]{64}$'
     or p_indexed_fingerprint is null
     or p_indexed_fingerprint !~ '^[a-f0-9]{64}$'
     or p_verified_at is null
     or p_verified_at < clock_timestamp() - interval '2 minutes'
     or p_verified_at > clock_timestamp() + interval '2 minutes'
     or p_indexed_message_count is null
     or p_indexed_message_count < 0
     or p_indexed_message_count > 10000
     or (p_expected_revision is not null and p_expected_revision <= 0) then
    raise exception 'sterling_today_verification_write_invalid';
  end if;

  if p_expected_revision is null then
    insert into public.continuum_sterling_today_thread_verifications (
      thread_key_digest,
      indexed_fingerprint,
      verified_at,
      expires_at,
      latest_indexed_message_at,
      indexed_message_count,
      verification_status,
      revision,
      updated_at
    ) values (
      p_thread_key_digest,
      p_indexed_fingerprint,
      p_verified_at,
      p_verified_at + interval '15 minutes',
      p_latest_indexed_message_at,
      p_indexed_message_count,
      'complete_live',
      1,
      clock_timestamp()
    )
    on conflict (thread_key_digest) do nothing
    returning revision into resulting_revision;

    if found then
      return resulting_revision;
    end if;
  end if;

  select * into existing
  from public.continuum_sterling_today_thread_verifications
  where thread_key_digest = p_thread_key_digest
  for update;

  if not found then
    return null;
  end if;

  if existing.indexed_fingerprint = p_indexed_fingerprint
     and existing.verified_at = p_verified_at
     and existing.latest_indexed_message_at is not distinct from p_latest_indexed_message_at
     and existing.indexed_message_count = p_indexed_message_count
     and existing.verification_status = 'complete_live' then
    return existing.revision;
  end if;

  if p_expected_revision is null or existing.revision <> p_expected_revision then
    return null;
  end if;

  update public.continuum_sterling_today_thread_verifications
  set indexed_fingerprint = p_indexed_fingerprint,
      verified_at = p_verified_at,
      expires_at = p_verified_at + interval '15 minutes',
      latest_indexed_message_at = p_latest_indexed_message_at,
      indexed_message_count = p_indexed_message_count,
      verification_status = 'complete_live',
      revision = existing.revision + 1,
      updated_at = clock_timestamp()
  where thread_key_digest = p_thread_key_digest
    and revision = existing.revision
  returning revision into resulting_revision;

  return resulting_revision;
end;
$$;

revoke all on function public.continuum_read_sterling_today_thread_verifications(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.continuum_read_sterling_today_thread_verifications(text[])
  to service_role;

revoke all on function public.continuum_record_sterling_today_thread_verification(
  text, text, timestamptz, timestamptz, integer, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_record_sterling_today_thread_verification(
  text, text, timestamptz, timestamptz, integer, bigint
) to service_role;

commit;

-- Safe rollback when no assembly is running:
-- drop function public.continuum_record_sterling_today_thread_verification(text, text, timestamptz, timestamptz, integer, bigint);
-- drop function public.continuum_read_sterling_today_thread_verifications(text[]);
-- drop table public.continuum_sterling_today_thread_verifications;
