import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20261030164152_sterling_transactional_canonical_approval.sql",
  import.meta.url,
);
const sqlTestUrl = new URL(
  "../../../supabase/tests/sterling_transactional_canonical_approval.sql",
  import.meta.url,
);
const aclMigrationUrl = new URL(
  "../../../supabase/migrations/20261101213243_sterling_shared_preview_acl_hardening.sql",
  import.meta.url,
);
const aclSqlTestUrl = new URL(
  "../../../supabase/tests/sterling_shared_preview_acl_hardening.sql",
  import.meta.url,
);

describe("Sterling transactional canonical approval migration", () => {
  it("uses private definers, fixed search paths, and service-role-only wrappers", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /create schema if not exists continuum_private/i);
    assert.match(sql, /security definer\s+set search_path = ''/i);
    assert.match(sql, /create or replace function public\.continuum_sterling_execute_approved_change_set[\s\S]*security invoker/i);
    assert.match(sql, /revoke all on function public\.continuum_sterling_execute_approved_change_set[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.continuum_sterling_execute_approved_change_set[\s\S]*to service_role/i);
    assert.match(sql, /revoke all on function public\.continuum_sterling_record_canonical_decision[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /revoke all on function public\.continuum_publish_sterling_today[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /if current_user <> 'service_role'/i);
  });

  it("defines explicit version, immutable approval, locking, and atomic history semantics", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /continuum_sterling_proposals[\s\S]*add column record_version bigint not null default 1/i);
    assert.match(sql, /continuum_candidates[\s\S]*add column record_version bigint not null default 1/i);
    assert.match(sql, /immutable-proposal-payload/i);
    assert.match(sql, /immutable-founder-decision/i);
    assert.match(sql, /old\.proposal_type in \('canonical_change_set', 'source_suppression'\)[\s\S]*immutable-founder-decision/i);
    assert.match(sql, /approved-payload-fingerprint-mismatch/i);
    assert.match(sql, /order by person\.person_id[\s\S]*for key share/i);
    assert.match(sql, /order by job\.job_id[\s\S]*for update/i);
    assert.match(sql, /stale-lifecycle-version/i);
    assert.match(sql, /stale-job-version/i);
    assert.match(sql, /stale-candidate-version/i);
    assert.match(sql, /cross-client-reassignment/i);
    assert.match(sql, /public\.continuum_client_memory_set_project_lifecycle/i);
    assert.match(sql, /public\.continuum_write_project_job/i);
    assert.match(sql, /operation_kind not in \('set_project_lifecycle','update_open_job_holder','resolve_open_job','cancel_open_job'\)/i);
    assert.match(sql, /continuum_candidate_suppression_events/i);
    assert.match(sql, /jsonb_array_length\(source_refs\) <> 1/i);
    assert.match(sql, /candidate-email-identity-unsupported/i);
    assert.match(sql, /from public\.continuum_candidate_suppression_events suppression_history/i);
    assert.match(sql, /suppression_history\.operation = 'suppress'/i);
  });

  it("keeps page publication durable, expiring, and separate from model execution", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /create table public\.continuum_sterling_today_publications/i);
    assert.match(sql, /expires_at <= published_at \+ interval '30 minutes'/i);
    assert.match(sql, /continuum_sterling_today_one_active_publication_idx/i);
    assert.match(sql, /continuum_publish_sterling_today/i);
    assert.match(sql, /publication-fingerprint-mismatch/i);
    assert.match(sql, /update public\.continuum_sterling_today_publications[\s\S]*set status = 'superseded'[\s\S]*where status = 'active'/i);
  });

  it("ships an executable disposable-DB regression covering the safety cases", async () => {
    const sql = await readFile(sqlTestUrl, "utf8");
    for (const expected of [
      "founder-approval-required",
      "approval-idempotency-conflict",
      "person-not-on-project",
      "stale-job-version",
      "stale-lifecycle-version",
      "stale-candidate-version",
      "injected-late-operation-failure",
      "partial history escaped rollback",
      "suppression compensation failed",
      "legacy defer-to-approve compatibility failed",
      "candidate-source-ref-mismatch",
      "candidate-email-hash-mismatch",
      "candidate-email-identity-unsupported",
      "suppression compensation history lookup failed",
      "successful lifecycle operation failed",
      "successful Job resolution failed",
    ]) assert.match(sql, new RegExp(expected));
    assert.match(sql, /test_expect_database_error/i);
    assert.doesNotMatch(sql, /raise exception 'expected (?:founder|approval|person|stale|injected)/i);
    assert.match(sql, /approved_payload=original_proposal[\s\S]*executed_payload=approved_payload/i);
    assert.match(sql, /set local role anon/i);
    assert.match(sql, /STERLING_TRANSACTIONAL_CANONICAL_APPROVAL_REGRESSION_PASS/);
    assert.match(sql, /regression_completion_marker;[\s\S]*rollback;\s*$/i);
    assert.match(sql, /rollback;\s*$/i);
  });

  it("hardens only the two Sterling table ACLs with revoke-all then narrow grants", async () => {
    const sql = await readFile(aclMigrationUrl, "utf8");
    const statements = sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);

    assert.deepEqual(statements, [
      "revoke all on table public.continuum_candidate_suppression_events from public, anon, authenticated, service_role",
      "grant select, insert on table public.continuum_candidate_suppression_events to service_role",
      "revoke all on table public.continuum_sterling_today_publications from public, anon, authenticated, service_role",
      "grant select, insert, update on table public.continuum_sterling_today_publications to service_role",
    ]);
  });

  it("ships a read-only runtime regression for exact direct and effective ACLs", async () => {
    const sql = await readFile(aclSqlTestUrl, "utf8");
    assert.match(sql, /begin read only/i);
    assert.match(sql, /pg_catalog\.has_table_privilege/i);
    assert.match(sql, /pg_catalog\.aclexplode/i);
    assert.match(sql, /pg_catalog\.pg_auth_members/i);
    assert.match(sql, /'MAINTAIN'/);
    assert.match(sql, /pg_catalog\.has_function_privilege/i);
    assert.match(sql, /relrowsecurity/i);
    assert.match(sql, /continuum_client_memory_set_project_lifecycle/i);
    assert.match(sql, /continuum_write_project_job/i);
    assert.match(sql, /STERLING_SHARED_PREVIEW_ACL_HARDENING_REGRESSION_PASS/);
    assert.match(sql, /rollback;\s*$/i);
    assert.doesNotMatch(sql, /^\s*(?:insert|update|delete|truncate|alter|create|drop|grant|revoke)\b/im);
  });
});
