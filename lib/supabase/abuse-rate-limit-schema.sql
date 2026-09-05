-- Public abuse rate-limit counters (Diamond Intelligence + Shape Studio).
-- UNAPPLIED. Additive only. Do not run from the app. Service-role / SQL editor
-- after review. Old production app remains compatible: this table is unused
-- until the matching code deploy.
--
-- Activation order:
--   1. Apply this SQL in Supabase (no app behavior change).
--   2. Deploy the security-hardening code.
-- If code lands first on Vercel production without this RPC, the limiter
-- fail-closes (429) until the function exists.
--
-- Stores hashed bucket keys only — never raw IPs, session tokens, or PII.
-- bucket_key is SHA-256(pepper, namespace, window TYPE, identity) — stable
-- across aligned window instances. The RPC reuses that row and resets
-- hit_count when the window instance changes, so cardinality is bounded by
-- distinct live identities x window types. Abandoned expired rows are removed
-- via the expires_at index in small SKIP LOCKED batches (not a full-table
-- scan on every request).
--
-- SECURITY DEFINER is required so the write RPC resolves relations only
-- through the empty search_path, independent of the invoker. Execute is not
-- granted to PUBLIC / anon / authenticated.

create table if not exists public.abuse_rate_limits (
  bucket_key text not null,
  window_start_epoch_ms bigint not null,
  hit_count integer not null check (hit_count >= 0),
  expires_at timestamptz not null,
  primary key (bucket_key)
);

create index if not exists abuse_rate_limits_expires_at_idx
  on public.abuse_rate_limits (expires_at);

alter table public.abuse_rate_limits enable row level security;

revoke all on table public.abuse_rate_limits from public;
revoke all on table public.abuse_rate_limits from anon;
revoke all on table public.abuse_rate_limits from authenticated;

grant all on table public.abuse_rate_limits to service_role;

create or replace function public.consume_abuse_rate_limit(
  p_bucket_key text,
  p_window_start_epoch_ms bigint,
  p_window_ms integer,
  p_limit integer,
  p_now_epoch_ms bigint
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  hit_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_expires_at timestamptz;
  v_retry integer;
begin
  if p_bucket_key is null
     or length(p_bucket_key) <> 64
     or p_bucket_key !~ '^[0-9a-f]+$'
     or p_limit < 1
     or p_window_ms < 1000
     or p_window_start_epoch_ms is null
     or p_now_epoch_ms is null then
    return query select false, 30, 0;
    return;
  end if;

  v_expires_at := to_timestamp((p_window_start_epoch_ms + p_window_ms) / 1000.0);

  insert into public.abuse_rate_limits as t (
    bucket_key,
    window_start_epoch_ms,
    hit_count,
    expires_at
  )
  values (
    p_bucket_key,
    p_window_start_epoch_ms,
    1,
    v_expires_at
  )
  on conflict (bucket_key)
  do update set
    hit_count = case
      when t.window_start_epoch_ms = excluded.window_start_epoch_ms
      then t.hit_count + 1
      else 1
    end,
    window_start_epoch_ms = excluded.window_start_epoch_ms,
    expires_at = excluded.expires_at
  returning t.hit_count into v_count;

  delete from public.abuse_rate_limits as stale
  using (
    select s.bucket_key
    from public.abuse_rate_limits as s
    where s.expires_at < to_timestamp(p_now_epoch_ms / 1000.0)
    order by s.expires_at
    limit 32
    for update skip locked
  ) as expired
  where stale.bucket_key = expired.bucket_key;

  v_retry := greatest(
    1,
    ceil((p_window_start_epoch_ms + p_window_ms - p_now_epoch_ms) / 1000.0)::integer
  );

  if v_count <= p_limit then
    return query select true, 0, v_count;
  else
    return query select false, v_retry, v_count;
  end if;
end;
$$;

revoke all on function public.consume_abuse_rate_limit(text, bigint, integer, integer, bigint) from public;
revoke all on function public.consume_abuse_rate_limit(text, bigint, integer, integer, bigint) from anon;
revoke all on function public.consume_abuse_rate_limit(text, bigint, integer, integer, bigint) from authenticated;

grant execute on function public.consume_abuse_rate_limit(text, bigint, integer, integer, bigint) to service_role;
