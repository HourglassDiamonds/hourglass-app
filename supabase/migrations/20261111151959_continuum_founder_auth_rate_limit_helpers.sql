-- Add the failure-only founder-auth rate-limit helpers without changing the
-- existing counter table or consume_abuse_rate_limit implementation.

create or replace function public.check_abuse_rate_limit(
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
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_window_start bigint;
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

  select t.hit_count, t.window_start_epoch_ms, t.expires_at
    into v_count, v_window_start, v_expires_at
  from public.abuse_rate_limits as t
  where t.bucket_key = p_bucket_key;

  if not found
     or v_expires_at <= to_timestamp(p_now_epoch_ms / 1000.0)
     or v_window_start <> p_window_start_epoch_ms then
    return query select true, 0, 0;
    return;
  end if;

  v_retry := greatest(
    1,
    ceil((p_window_start_epoch_ms + p_window_ms - p_now_epoch_ms) / 1000.0)::integer
  );

  if v_count >= p_limit then
    return query select false, v_retry, v_count;
  else
    return query select true, 0, v_count;
  end if;
end;
$$;

revoke all on function public.check_abuse_rate_limit(text, bigint, integer, integer, bigint) from public;
revoke all on function public.check_abuse_rate_limit(text, bigint, integer, integer, bigint) from anon;
revoke all on function public.check_abuse_rate_limit(text, bigint, integer, integer, bigint) from authenticated;

grant execute on function public.check_abuse_rate_limit(text, bigint, integer, integer, bigint) to service_role;

create or replace function public.clear_abuse_rate_limit(
  p_bucket_key text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_bucket_key is null
     or length(p_bucket_key) <> 64
     or p_bucket_key !~ '^[0-9a-f]+$' then
    return;
  end if;

  delete from public.abuse_rate_limits as t
  where t.bucket_key = p_bucket_key;
end;
$$;

revoke all on function public.clear_abuse_rate_limit(text) from public;
revoke all on function public.clear_abuse_rate_limit(text) from anon;
revoke all on function public.clear_abuse_rate_limit(text) from authenticated;

grant execute on function public.clear_abuse_rate_limit(text) to service_role;
