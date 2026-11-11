import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceCommit = "e3f0e677eb863a834ceab871fc02a39290475e85";
const artifactPath =
  "supabase/release/20261110_continuum_concierge_fresh_install.sql";
const artifactSha256 =
  "2b21179eb227c9b4540aa40baea1bf495c281d72bdbb3bc1df0fb2272141ccf2";
const basePath =
  "supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql";
const outputPath =
  "supabase/release/20261111_continuum_concierge_production_install.sql";

const normalizeLf = (value) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const md5 = (value) => createHash("md5").update(value, "utf8").digest("hex");

function functionBody(sql, name) {
  const declaration = `create or replace function public.${name}(`;
  const declarationIndex = sql.indexOf(declaration);
  assert.notEqual(declarationIndex, -1, `${name} declaration is required`);
  const bodyStartMarker = "as $$";
  const bodyStart = sql.indexOf(bodyStartMarker, declarationIndex);
  assert.notEqual(bodyStart, -1, `${name} body start is required`);
  const contentStart = bodyStart + bodyStartMarker.length;
  const contentEnd = sql.indexOf("$$;", contentStart);
  assert.notEqual(contentEnd, -1, `${name} body end is required`);
  return sql.slice(contentStart, contentEnd);
}

const artifact = normalizeLf(readFileSync(resolve(root, artifactPath), "utf8"));
const base = normalizeLf(readFileSync(resolve(root, basePath), "utf8"));
assert.equal(sha256(artifact), artifactSha256, "atomic artifact checksum drift");
assert.equal((artifact.match(/^begin;$/gm) ?? []).length, 1);
assert.equal((artifact.match(/^commit;$/gm) ?? []).length, 1);

const acceptBodyMd5 = md5(
  functionBody(base, "continuum_accept_concierge_funnel_v1"),
);
const transitionBodyMd5 = md5(
  functionBody(base, "continuum_transition_concierge_ack_v1"),
);

const preconditions = String.raw`
set local lock_timeout = '2s';
set local statement_timeout = '30s';
set local idle_in_transaction_session_timeout = '30s';
set local transaction_timeout = '45s';

do $preflight$
declare v_schema_fp text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 37 then
    raise exception 'unexpected migration count';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version in ('20261104201449', '20261110194159')
  ) then
    raise exception 'Concierge migration history drift';
  end if;
  if to_regclass('public.continuum_concierge_ack_outbox') is not null then
    raise exception 'Concierge outbox already exists';
  end if;
  if to_regprocedure(
    'public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)'
  ) is not null then
    raise exception 'accept RPC already exists';
  end if;
  if to_regprocedure(
    'public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)'
  ) is not null then
    raise exception 'transition RPC already exists';
  end if;

  select md5(string_agg(
    concat_ws(
      '|', table_name, ordinal_position, column_name, data_type, udt_name,
      is_nullable, coalesce(column_default, '')
    ),
    E'\n' order by table_name, ordinal_position
  ))
  into v_schema_fp
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('continuum_candidates', 'continuum_website_intakes');

  if v_schema_fp <> 'bfaa0aaf078fb6e176fb7745eecd7368' then
    raise exception 'Candidate/intake schema drift';
  end if;

  perform set_config(
    'continuum.release.candidate_fp',
    (select md5(coalesce(string_agg(
      to_jsonb(t)::text, E'\n' order by candidate_id::text
    ), '')) from public.continuum_candidates t),
    true
  );
  perform set_config(
    'continuum.release.intake_fp',
    (select md5(coalesce(string_agg(
      to_jsonb(t)::text, E'\n' order by intake_id::text
    ), '')) from public.continuum_website_intakes t),
    true
  );
  perform set_config(
    'continuum.release.jobs_fp',
    (select md5(coalesce(string_agg(
      to_jsonb(t)::text, E'\n' order by job_id::text
    ), '')) from public.continuum_project_jobs t),
    true
  );
  perform set_config(
    'continuum.release.lifecycle_fp',
    (select md5(coalesce(string_agg(
      to_jsonb(t)::text, E'\n' order by project_id::text
    ), '')) from public.continuum_project_lifecycle_states t),
    true
  );
  perform set_config(
    'continuum.release.proposals_fp',
    (select md5(coalesce(string_agg(
      to_jsonb(t)::text, E'\n' order by proposal_id::text
    ), '')) from public.continuum_sterling_proposals t),
    true
  );

  if (select count(*) from public.continuum_project_evidence_associations) <> 0
    or (select count(*) from public.continuum_founder_sessions) <> 0 then
    raise exception 'release ledger rows changed';
  end if;
end
$preflight$;
`;

const postconditions = String.raw`
do $postflight$
declare
  v_rel oid := 'public.continuum_concierge_ack_outbox'::regclass;
  v_accept oid :=
    'public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)'::regprocedure;
  v_transition oid :=
    'public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)'::regprocedure;
  v_unique_columns text[];
begin
  if (select count(*) from public.continuum_concierge_ack_outbox) <> 0 then
    raise exception 'unexpected Concierge outbox rows';
  end if;
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'continuum_concierge_ack_outbox'
  ) <> 27 then
    raise exception 'unexpected Concierge column count';
  end if;
  if (
    select count(*) from pg_indexes
    where schemaname = 'public'
      and tablename = 'continuum_concierge_ack_outbox'
  ) <> 11 then
    raise exception 'unexpected Concierge index count';
  end if;
  if (
    select count(distinct conindid)
    from pg_constraint
    where conrelid = v_rel
      and contype in ('p', 'u')
      and conindid <> 0
  ) <> 9 then
    raise exception 'unexpected constraint-backed Concierge index count';
  end if;
  if (
    select count(*)
    from pg_index i
    left join pg_constraint c
      on c.conindid = i.indexrelid
      and c.contype in ('p', 'u')
    where i.indrelid = v_rel
      and c.oid is null
  ) <> 2 then
    raise exception 'unexpected explicit Concierge index count';
  end if;

  select array_agg(a.attname order by a.attname)
  into v_unique_columns
  from pg_constraint c
  cross join lateral unnest(c.conkey) key(attnum)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum
  where c.conrelid = v_rel
    and c.contype = 'u'
    and array_length(c.conkey, 1) = 1;

  if v_unique_columns is distinct from array[
    'acknowledgement_idempotency_key', 'action_id', 'candidate_id',
    'concierge_idempotency_key', 'event_id', 'intake_id', 'lead_id',
    'submission_id_hash'
  ]::text[] then
    raise exception 'unexpected UNIQUE index ownership';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = v_rel
      and contype = 'p'
      and conname = 'continuum_concierge_ack_outbox_pkey'
      and conindid <> 0
  ) then
    raise exception 'outbox primary-key index ownership missing';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'continuum_concierge_ack_outbox'
      and indexname = 'continuum_concierge_ack_outbox_founder_idx'
      and indexdef like '%(created_at, intake_id)%'
      and indexdef like '%pending_approval%'
      and indexdef like '%ready%'
      and indexdef like '%delivery_unknown%'
      and indexdef like '%failed%'
  ) then
    raise exception 'founder partial index missing or changed';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'continuum_concierge_ack_outbox'
      and indexname = 'continuum_concierge_ack_outbox_reconciliation_idx'
      and indexdef like '%(updated_at, outbox_id)%'
      and indexdef like '%reconciliation_required = true%'
  ) then
    raise exception 'reconciliation partial index missing or changed';
  end if;
  if (
    select count(*) from pg_index
    where indrelid = v_rel and indpred is not null
  ) <> 2 then
    raise exception 'unexpected partial-index count';
  end if;
  if exists (
    select 1
    from pg_constraint con
    cross join lateral unnest(con.conkey) key(attnum)
    where con.conrelid = v_rel
      and con.contype = 'f'
      and not exists (
        select 1 from pg_index idx
        where idx.indrelid = con.conrelid
          and key.attnum = any(idx.indkey)
      )
  ) then
    raise exception 'unindexed Concierge foreign key';
  end if;

  if not (
    select relrowsecurity and relforcerowsecurity
    from pg_class where oid = v_rel
  ) then
    raise exception 'Concierge forced RLS missing';
  end if;
  if (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename = 'continuum_concierge_ack_outbox'
  ) <> 0 then
    raise exception 'unexpected Concierge policy';
  end if;
  if (select pg_get_userbyid(relowner) from pg_class where oid = v_rel)
    <> 'postgres' then
    raise exception 'unexpected Concierge table owner';
  end if;

  if not has_table_privilege(
    'service_role', 'public.continuum_concierge_ack_outbox',
    'SELECT,INSERT,UPDATE'
  ) or has_table_privilege(
    'service_role', 'public.continuum_concierge_ack_outbox',
    'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'unexpected Concierge service_role table privileges';
  end if;
  if has_table_privilege(
    'anon', 'public.continuum_concierge_ack_outbox',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) or has_table_privilege(
    'authenticated', 'public.continuum_concierge_ack_outbox',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'browser Concierge table access detected';
  end if;

  if not has_function_privilege('service_role', v_accept, 'EXECUTE')
    or not has_function_privilege('service_role', v_transition, 'EXECUTE') then
    raise exception 'service_role RPC access missing';
  end if;
  if has_function_privilege('public', v_accept, 'EXECUTE')
    or has_function_privilege('anon', v_accept, 'EXECUTE')
    or has_function_privilege('authenticated', v_accept, 'EXECUTE')
    or has_function_privilege('public', v_transition, 'EXECUTE')
    or has_function_privilege('anon', v_transition, 'EXECUTE')
    or has_function_privilege('authenticated', v_transition, 'EXECUTE') then
    raise exception 'browser or PUBLIC RPC access detected';
  end if;
  if exists (
    select 1 from pg_proc
    where oid in (v_accept, v_transition)
      and (
        prosecdef
        or proconfig is distinct from array['search_path=""']::text[]
        or pg_get_userbyid(proowner) <> 'postgres'
      )
  ) then
    raise exception 'unexpected RPC security, search path, or owner';
  end if;
  if (select md5(prosrc) from pg_proc where oid = v_accept)
    <> '${acceptBodyMd5}' then
    raise exception 'accept RPC body mismatch';
  end if;
  if (select md5(prosrc) from pg_proc where oid = v_transition)
    <> '${transitionBodyMd5}' then
    raise exception 'transition RPC body mismatch';
  end if;
  if (
    select count(*) from pg_trigger
    where tgrelid = v_rel and not tgisinternal
  ) <> 0 then
    raise exception 'unexpected Concierge trigger';
  end if;

  if (select md5(coalesce(string_agg(
    to_jsonb(t)::text, E'\n' order by candidate_id::text
  ), '')) from public.continuum_candidates t)
    <> current_setting('continuum.release.candidate_fp') then
    raise exception 'Candidate records changed';
  end if;
  if (select md5(coalesce(string_agg(
    to_jsonb(t)::text, E'\n' order by intake_id::text
  ), '')) from public.continuum_website_intakes t)
    <> current_setting('continuum.release.intake_fp') then
    raise exception 'intake records changed';
  end if;
  if (select md5(coalesce(string_agg(
    to_jsonb(t)::text, E'\n' order by job_id::text
  ), '')) from public.continuum_project_jobs t)
    <> current_setting('continuum.release.jobs_fp') then
    raise exception 'Job records changed';
  end if;
  if (select md5(coalesce(string_agg(
    to_jsonb(t)::text, E'\n' order by project_id::text
  ), '')) from public.continuum_project_lifecycle_states t)
    <> current_setting('continuum.release.lifecycle_fp') then
    raise exception 'lifecycle records changed';
  end if;
  if (select md5(coalesce(string_agg(
    to_jsonb(t)::text, E'\n' order by proposal_id::text
  ), '')) from public.continuum_sterling_proposals t)
    <> current_setting('continuum.release.proposals_fp') then
    raise exception 'proposal records changed';
  end if;
  if (select count(*) from public.continuum_project_evidence_associations) <> 0
    or (select count(*) from public.continuum_founder_sessions) <> 0 then
    raise exception 'release ledger records changed';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 37
    or exists (
      select 1 from supabase_migrations.schema_migrations
      where version in ('20261104201449', '20261110194159')
    ) then
    raise exception 'migration history changed during schema transaction';
  end if;
end
$postflight$;
`;

const executable = artifact
  .replace("\nbegin;\n", `\nbegin;${preconditions}\n`)
  .replace("\ncommit;\n", `\n${postconditions}\ncommit;\n`);

assert.equal((executable.match(/^begin;$/gm) ?? []).length, 1);
assert.equal((executable.match(/^commit;$/gm) ?? []).length, 1);
assert.match(executable, /E'\\n' order by table_name, ordinal_position/);
assert.match(executable, /contype in \('p', 'u'\)/);

const output = [
  `-- GENERATED PRODUCTION EXECUTABLE. Source commit: ${sourceCommit}`,
  `-- Atomic artifact SHA-256 (LF): ${artifactSha256}`,
  `-- Accept RPC body MD5: ${acceptBodyMd5}`,
  `-- Transition RPC body MD5: ${transitionBodyMd5}`,
  "-- Do not edit by hand. Regenerate with scripts/build-continuum-concierge-production-install.mjs.",
  "",
  executable.trimEnd(),
  "",
].join("\n");

writeFileSync(resolve(root, outputPath), output, "utf8");
console.log(`${outputPath} ${sha256(output)}`);
