import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const route = readFileSync(join(directory, "route.ts"), "utf8");
const migration = readFileSync(join(directory, "../../../../../supabase/migrations/20261008161606_continuum_performance_natural_ingestion.sql"), "utf8");
const auditMigration = readFileSync(join(directory, "../../../../../supabase/migrations/20261008162017_continuum_performance_audit_immutability.sql"), "utf8");
const adjustmentMigration = readFileSync(join(directory, "../../../../../supabase/migrations/20261013162343_performance_accept_adjustment_action.sql"), "utf8");
const activationMigration = readFileSync(join(directory, "../../../../../supabase/migrations/20261015215857_performance_program_activation_action.sql"), "utf8");
const tonalMigration = readFileSync(join(directory, "../../../../../supabase/migrations/20261017203000_performance_tonal_program_actions.sql"), "utf8");

test("state reads and writes require the founder session and never return a public source URL", () => {
  assert.match(route, /requireInternalClientMemorySession/); assert.match(route, /status:\s*401/g);
  assert.match(route, /loadPerformanceState\(session\.username/); assert.match(route, /founderKey:\s*session\.username/);
  assert.match(route, /expectedRevision/); assert.match(route, /status:\s*409/); assert.match(route, /PerformanceRevisionConflict/);
  assert.match(route, /export async function DELETE/); assert.match(route, /deletePerformanceSource/);
  assert.doesNotMatch(route, /getPublicUrl|createSignedUrl/);
});

test("migration keeps state and source objects private with explicit service-role access", () => {
  assert.match(migration, /continuum-performance-sources[\s\S]*false/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all[\s\S]*anon, authenticated/);
  assert.match(migration, /grant select, insert, update[\s\S]*continuum_performance_state[\s\S]*service_role/);
  assert.match(migration, /grant select, insert[\s\S]*continuum_performance_audit[\s\S]*service_role/);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*service_role/);
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /p_expected_revision/);
  assert.match(migration, /errcode = '40001'/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke execute on function[\s\S]*public, anon, authenticated/);
  assert.match(migration, /source_expires_at/);
  assert.match(migration, /sensitive_expires_at/);
  assert.match(auditMigration, /before update or delete/);
  assert.match(auditMigration, /continuum_performance_audit_is_immutable/);
  assert.match(adjustmentMigration, /continuum_performance_audit_action_check/);
  assert.match(adjustmentMigration, /'accept_adjustment'/);
  assert.doesNotMatch(adjustmentMigration, /grant|create policy|continuum_performance_state|continuum_performance_evidence/i);
  assert.match(activationMigration, /continuum_performance_audit_action_check/);
  assert.match(activationMigration, /'accept_adjustment'/);
  assert.match(activationMigration, /'activate_program'/);
  assert.doesNotMatch(activationMigration, /grant|create policy|continuum_performance_state|continuum_performance_evidence/i);
  assert.match(tonalMigration, /'configure_strength_program'/);
  assert.match(tonalMigration, /'transition_strength_program'/);
  assert.match(tonalMigration, /'accept_adjustment'/);
  assert.match(tonalMigration, /'activate_program'/);
  assert.doesNotMatch(tonalMigration, /grant|create policy|continuum_performance_state|continuum_performance_evidence|create table/i);
});
