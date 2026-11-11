-- Run after 20261111151959_continuum_founder_auth_rate_limit_helpers.sql on
-- an isolated Production-shaped database. All fixture writes roll back.

begin;

set local statement_timeout = '10s';
set local lock_timeout = '5s';

do $contract$
declare
  checked_role text;
  signature text;
begin
  if to_regclass('public.abuse_rate_limits') is null then
    raise exception 'missing abuse_rate_limits baseline table';
  end if;

  if to_regprocedure('public.consume_abuse_rate_limit(text,bigint,integer,integer,bigint)') is null then
    raise exception 'missing consume_abuse_rate_limit baseline function';
  end if;

  foreach signature in array array[
    'public.check_abuse_rate_limit(text,bigint,integer,integer,bigint)',
    'public.clear_abuse_rate_limit(text)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'missing helper: %', signature;
    end if;

    if (
      select p.prosecdef
      from pg_catalog.pg_proc p
      where p.oid = to_regprocedure(signature)
    ) then
      raise exception 'helper must remain SECURITY INVOKER: %', signature;
    end if;

    if (
      select p.proconfig
      from pg_catalog.pg_proc p
      where p.oid = to_regprocedure(signature)
    ) is distinct from array['search_path=""']::text[] then
      raise exception 'helper search_path drift: %', signature;
    end if;

    foreach checked_role in array array['anon', 'authenticated'] loop
      if pg_catalog.has_function_privilege(checked_role, signature, 'EXECUTE') then
        raise exception 'browser role can execute helper: role=% helper=%',
          checked_role, signature;
      end if;
    end loop;

    if not pg_catalog.has_function_privilege('service_role', signature, 'EXECUTE') then
      raise exception 'service_role cannot execute helper: %', signature;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(p.proacl) acl
      where p.oid = to_regprocedure(signature)
        and acl.grantee = 0
    ) then
      raise exception 'PUBLIC retained direct EXECUTE on helper: %', signature;
    end if;
  end loop;
end
$contract$;

set local role service_role;

do $behavior$
declare
  bucket_a constant text := repeat('a', 64);
  bucket_b constant text := repeat('b', 64);
  window_start constant bigint := 1800000000000;
  now_epoch constant bigint := 1800000001000;
  result_row record;
  before_check integer;
  after_check integer;
begin
  delete from public.abuse_rate_limits
  where bucket_key in (bucket_a, bucket_b);

  select * into result_row
  from public.consume_abuse_rate_limit(
    bucket_a, window_start, 900000, 2, now_epoch
  );
  if result_row.allowed is distinct from true or result_row.hit_count <> 1 then
    raise exception 'consume compatibility failed for first attempt: %', result_row;
  end if;

  select hit_count into before_check
  from public.abuse_rate_limits
  where bucket_key = bucket_a;

  select * into result_row
  from public.check_abuse_rate_limit(
    bucket_a, window_start, 900000, 2, now_epoch
  );
  if result_row.allowed is distinct from true or result_row.hit_count <> 1 then
    raise exception 'non-consuming check returned unexpected result: %', result_row;
  end if;

  select hit_count into after_check
  from public.abuse_rate_limits
  where bucket_key = bucket_a;
  if after_check is distinct from before_check then
    raise exception 'check consumed an attempt: before=% after=%',
      before_check, after_check;
  end if;

  select * into result_row
  from public.consume_abuse_rate_limit(
    bucket_a, window_start, 900000, 2, now_epoch
  );
  if result_row.allowed is distinct from true or result_row.hit_count <> 2 then
    raise exception 'consume compatibility failed for second attempt: %', result_row;
  end if;

  select * into result_row
  from public.check_abuse_rate_limit(
    bucket_a, window_start, 900000, 2, now_epoch
  );
  if result_row.allowed is distinct from false or result_row.hit_count <> 2 then
    raise exception 'blocked check returned unexpected result: %', result_row;
  end if;

  select * into result_row
  from public.consume_abuse_rate_limit(
    bucket_b, window_start, 900000, 5, now_epoch
  );
  if result_row.hit_count <> 1 then
    raise exception 'second bucket fixture failed: %', result_row;
  end if;

  perform public.clear_abuse_rate_limit(bucket_a);

  if exists (
    select 1 from public.abuse_rate_limits where bucket_key = bucket_a
  ) then
    raise exception 'clear did not remove the specified bucket';
  end if;

  if not exists (
    select 1 from public.abuse_rate_limits
    where bucket_key = bucket_b and hit_count = 1
  ) then
    raise exception 'clear modified an unrelated bucket';
  end if;

  select * into result_row
  from public.check_abuse_rate_limit(
    repeat('c', 64), window_start, 900000, 5, now_epoch
  );
  if result_row.allowed is distinct from true or result_row.hit_count <> 0 then
    raise exception 'fresh founder login did not pass rate-limit check: %', result_row;
  end if;
end
$behavior$;

reset role;

do $marker$
begin
  raise notice 'CONTINUUM_FOUNDER_AUTH_RATE_LIMIT_HELPERS_REGRESSION_PASS';
end
$marker$;

select 'CONTINUUM_FOUNDER_AUTH_RATE_LIMIT_HELPERS_REGRESSION_PASS' as marker;

rollback;
