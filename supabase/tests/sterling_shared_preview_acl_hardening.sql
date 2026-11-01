-- Run after all migrations on an isolated/disposable PostgreSQL database.
-- This is a read-only privilege and object-integrity regression. It does not
-- create fixtures or exercise canonical client mutations.

begin read only;

do $acl_contract$
declare
  target_table text;
  checked_role text;
  checked_privilege text;
  expected boolean;
  actual boolean;
  direct_privileges text[];
begin
  foreach target_table in array array[
    'public.continuum_candidate_suppression_events',
    'public.continuum_sterling_today_publications'
  ] loop
    if to_regclass(target_table) is null then
      raise exception 'missing ACL target table: %', target_table;
    end if;

    if not (
      select c.relrowsecurity
      from pg_catalog.pg_class c
      where c.oid = to_regclass(target_table)
    ) then
      raise exception 'RLS is disabled on %', target_table;
    end if;

    -- The owner retains PostgreSQL administrative recovery access.
    if (
      select pg_catalog.pg_get_userbyid(c.relowner)
      from pg_catalog.pg_class c
      where c.oid = to_regclass(target_table)
    ) <> 'postgres' then
      raise exception 'unexpected owner for %', target_table;
    end if;

    -- anon/authenticated effective checks also detect any privilege granted to
    -- PUBLIC, because every login role receives PUBLIC privileges.
    foreach checked_role in array array['anon', 'authenticated', 'service_role'] loop
      foreach checked_privilege in array array[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
        'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] loop
        expected := checked_role = 'service_role'
          and checked_privilege in ('SELECT', 'INSERT')
          and target_table = 'public.continuum_candidate_suppression_events';
        expected := expected or (
          checked_role = 'service_role'
          and checked_privilege in ('SELECT', 'INSERT', 'UPDATE')
          and target_table = 'public.continuum_sterling_today_publications'
        );
        actual := pg_catalog.has_table_privilege(
          checked_role,
          target_table,
          checked_privilege
        );
        if actual is distinct from expected then
          raise exception 'effective privilege mismatch: role=% table=% privilege=% expected=% actual=%',
            checked_role, target_table, checked_privilege, expected, actual;
        end if;
      end loop;
    end loop;

    -- Direct grants must also be exact. Effective checks above protect against
    -- privilege inheritance; this check protects the table ACL itself.
    select array_agg(a.privilege_type order by a.privilege_type)
      into direct_privileges
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.oid = to_regclass(target_table)
      and pg_catalog.pg_get_userbyid(a.grantee) = 'service_role';

    if direct_privileges is distinct from (case target_table
      when 'public.continuum_candidate_suppression_events'
        then array['INSERT', 'SELECT']::text[]
      when 'public.continuum_sterling_today_publications'
        then array['INSERT', 'SELECT', 'UPDATE']::text[]
    end) then
      raise exception 'direct service_role ACL mismatch on %: %',
        target_table, direct_privileges;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = to_regclass(target_table)
        and pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
        and a.is_grantable
    ) then
      raise exception 'service_role retained a grant option on %', target_table;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = to_regclass(target_table)
        and a.grantee = 0
    ) then
      raise exception 'PUBLIC retained a direct table grant on %', target_table;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = to_regclass(target_table)
        and pg_catalog.pg_get_userbyid(a.grantee) in ('anon', 'authenticated')
    ) then
      raise exception 'browser role retained a direct table grant on %', target_table;
    end if;
  end loop;

  -- No parent role may silently add privileges to an application credential.
  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles member_role on member_role.oid = membership.member
    where member_role.rolname in ('service_role', 'anon', 'authenticated')
      and membership.inherit_option
  ) then
    raise exception 'application role inherits unexpected role membership';
  end if;
end
$acl_contract$;

do $function_contract$
declare
  function_signature text;
  checked_role text;
  actual boolean;
begin
  foreach function_signature in array array[
    'public.continuum_publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)',
    'public.continuum_sterling_record_canonical_decision(uuid,bigint,text,jsonb,timestamp with time zone,text,text)',
    'public.continuum_sterling_execute_approved_change_set(uuid,bigint,text,timestamp with time zone)'
  ] loop
    if to_regprocedure(function_signature) is null then
      raise exception 'missing Sterling RPC: %', function_signature;
    end if;
    foreach checked_role in array array['anon', 'authenticated', 'service_role'] loop
      actual := pg_catalog.has_function_privilege(
        checked_role,
        function_signature,
        'EXECUTE'
      );
      if actual is distinct from (checked_role = 'service_role') then
        raise exception 'RPC execute privilege mismatch: role=% function=% actual=%',
          checked_role, function_signature, actual;
      end if;
    end loop;
  end loop;
end
$function_contract$;

-- These fingerprints exclude ACLs. They protect columns, defaults, ownership,
-- RLS flags, constraints, indexes, triggers, policies, and function bodies from
-- being changed under cover of an ACL-only correction.
do $object_integrity$
declare
  target record;
  actual text;
begin
  for target in
    select * from (values
      ('table', 'public.continuum_candidate_suppression_events', '0c8c35bea979726a72bdb06dfa773f8c200565e31cb5b0b23ad30d8b2edc057e'),
      ('table', 'public.continuum_sterling_today_publications', 'e143df1d5a8a2e50980b747649910f33c3f70c5214d95dc2757d84693fdcbb58'),
      ('function', 'continuum_private.bump_record_version()', '0fa2c458e6214a16d8789d6fae3407d690e4d9f30089903c0263bbaabae9f033'),
      ('function', 'continuum_private.execute_sterling_approved_change_set(uuid,bigint,text,timestamp with time zone)', '6a194a4dbc009d5ccfa3e1025e6276c185cd28706a6ed28f51e6630a14571ee6'),
      ('function', 'continuum_private.guard_sterling_proposal_update()', '4e82aa2712faa42970299be7d4d869e216681a60c807a1f9cc582dec96b1087b'),
      ('function', 'continuum_private.guard_sterling_today_publication()', '9ac840da85795c458c828df1a2a287944aab11a7f781b9b4887892c3c28aee07'),
      ('function', 'continuum_private.jsonb_sha256(jsonb)', '370416c58a4640749cdf46507a764499bd097039a9b4e86f97d553f68ebf03ae'),
      ('function', 'continuum_private.publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)', 'a26b78d52554b58cc45b9cd348e4feb797fa6c8dd28da3933fb60b60be8b496f'),
      ('function', 'continuum_private.record_sterling_canonical_decision(uuid,bigint,text,jsonb,timestamp with time zone,text,text)', '1eb1528c1bbc63f05d95f7d515c3d794fb59d6580873c00f10fed2a0cad709b8'),
      ('function', 'public.continuum_client_memory_set_project_lifecycle(uuid,text,uuid,uuid,timestamp with time zone,text,text)', 'b3672d66c390bae9eba2c0734214782ae67528d694308fa4ae7d7be478e8d0b8'),
      ('function', 'public.continuum_publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)', '2256cf5a65aa5d69f778747689263314c0cc747e65d08ffae898eb36bfc296df'),
      ('function', 'public.continuum_sterling_execute_approved_change_set(uuid,bigint,text,timestamp with time zone)', '7ff508c43755c245025e3298549bfc62513544d251e8c8a32e84c8f20b7f9d93'),
      ('function', 'public.continuum_sterling_record_canonical_decision(uuid,bigint,text,jsonb,timestamp with time zone,text,text)', 'e556077ec1f8be4de5db1cd07faeb38e3d7e91fcb2b5724ea237d67fc8727627'),
      ('function', 'public.continuum_write_project_job(jsonb,uuid,text,text,jsonb,jsonb)', '673ad47f1b6e9cf37888b5b506cc3fa1d7cbf90c071ce8ca89b348664cc8a539')
    ) expected(kind, identity, fingerprint)
  loop
    if target.kind = 'function' then
      if to_regprocedure(target.identity) is null then
        raise exception 'missing protected function: %', target.identity;
      end if;
      actual := encode(
        digest(pg_catalog.pg_get_functiondef(to_regprocedure(target.identity)), 'sha256'),
        'hex'
      );
    else
      select encode(digest(concat_ws(E'\n',
        format('owner=%s', pg_catalog.pg_get_userbyid(c.relowner)),
        format('rls=%s', c.relrowsecurity),
        format('force_rls=%s', c.relforcerowsecurity),
        coalesce((select string_agg(
          format('%s|%s|%s|%s|%s', a.attnum, a.attname,
            pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull,
            coalesce(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')),
          E'\n' order by a.attnum)
          from pg_catalog.pg_attribute a
          left join pg_catalog.pg_attrdef d
            on d.adrelid = a.attrelid and d.adnum = a.attnum
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), ''),
        coalesce((select string_agg(pg_catalog.pg_get_constraintdef(k.oid, true), E'\n' order by k.conname)
          from pg_catalog.pg_constraint k where k.conrelid = c.oid), ''),
        coalesce((select string_agg(pg_catalog.pg_get_indexdef(i.indexrelid), E'\n' order by pg_catalog.pg_get_indexdef(i.indexrelid))
          from pg_catalog.pg_index i where i.indrelid = c.oid), ''),
        coalesce((select string_agg(pg_catalog.pg_get_triggerdef(g.oid, true), E'\n' order by g.tgname)
          from pg_catalog.pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal), ''),
        coalesce((select string_agg(format('%s|%s|%s|%s', p.polname, p.polcmd,
          coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ''),
          coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '')),
          E'\n' order by p.polname)
          from pg_catalog.pg_policy p where p.polrelid = c.oid), '')
      ), 'sha256'), 'hex') into actual
      from pg_catalog.pg_class c
      where c.oid = to_regclass(target.identity);
    end if;

    if actual is distinct from target.fingerprint then
      raise exception 'protected object fingerprint mismatch: % expected=% actual=%',
        target.identity, target.fingerprint, actual;
    end if;
  end loop;
end
$object_integrity$;

select 'STERLING_SHARED_PREVIEW_ACL_HARDENING_REGRESSION_PASS' as regression_completion_marker;

rollback;
