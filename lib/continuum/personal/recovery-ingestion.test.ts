import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createInitialPersonalState } from "./program";
import type { NaturalIngestionProposal, RecoveryEntry } from "./types";
import { validatePersonalState, validateRecoveryEntry } from "./validation";

const proposal: Extract<NaturalIngestionProposal, { kind: "recovery" }> = {
  id: "proposal-recovery", proposedAt: "2026-10-20T12:00:00Z", sourceType: "recovery_screenshot", confidence: "high", assumptions: [],
  summary: "WHOOP recovery", model: "fixture", sourceDigest: "a".repeat(64), normalizedSourceDigest: "a".repeat(64), kind: "recovery",
  recovery: { recoveryScore: { value: 68, source: "observed" }, strain: { value: 11.2, source: "observed" } },
  sourceDate: { month: 10, day: 20, year: 2026, evidence: "observed" }, guidance: "Daily strain remains recovery context.",
};

function entry(overrides: Partial<RecoveryEntry> = {}): RecoveryEntry {
  return {
    id: "recovery-a", date: "2026-10-20", recordedAt: "2026-10-20T12:01:00Z", recoveryScore: proposal.recovery.recoveryScore,
    strain: proposal.recovery.strain, sourceType: "recovery_screenshot", source: { name: "whoop.png", type: "image/png", size: 128 }, sterlingProposal: proposal,
    assumptions: [], corrections: [], idempotencyKey: `accept-recovery-${proposal.sourceDigest}`, provenance: ["sterling", "user_confirmed"], ...overrides,
  };
}

test("recovery evidence accepts partial visible metrics and keeps daily strain out of activities", () => {
  const recovery = entry({ recoveryScore: undefined });
  assert.deepEqual(validateRecoveryEntry(recovery), []);
  const state = { ...createInitialPersonalState("2026-10-20"), recoveryEntries: [recovery] };
  assert.deepEqual(validatePersonalState(state), []);
  assert.equal(state.activities.length, 0);
  assert.equal(state.recoveryEntries[0]?.strain?.value, 11.2);
});

test("a conflicting visible recovery date requires an explicit reviewed correction", () => {
  const unconfirmed = entry({ date: "2026-10-19" });
  assert.ok(validateRecoveryEntry(unconfirmed).includes("recovery-date-confirmation"));
  const confirmed = entry({ date: "2026-10-19", corrections: [{ field: "date", from: "Oct 20, 2026", to: "2026-10-19" }] });
  assert.deepEqual(validateRecoveryEntry(confirmed), []);
});

test("recovery metric ranges reject fabricated or malformed values", () => {
  assert.ok(validateRecoveryEntry(entry({ recoveryScore: { value: 101, source: "manual" } })).includes("recovery-recoveryScore"));
  assert.ok(validateRecoveryEntry(entry({ sleepHours: { value: 25, source: "manual" } })).includes("recovery-sleepHours"));
  assert.ok(validateRecoveryEntry(entry({ strain: { value: 22, source: "observed" } })).includes("recovery-strain"));
});

test("recovery ingestion migration only extends existing audit vocabulary", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261020153000_performance_recovery_ingestion.sql"),
    "utf8",
  ).toLowerCase();

  for (const action of [
    "bootstrap", "snapshot", "accept_meal", "accept_activity", "accept_adjustment", "configure_strength_program",
    "plan_strength_session", "activate_program", "transition_strength_program", "edit_meal", "edit_activity",
    "reject_proposal", "delete_source", "accept_recovery",
  ]) {
    assert.match(sql, new RegExp(`'${action}'`));
  }
  for (const sourceType of ["text", "meal_photo", "nutrition_label", "activity_screenshot", "tonal_program_screenshot", "recovery_screenshot"]) {
    assert.match(sql, new RegExp(`'${sourceType}'`));
  }

  assert.doesNotMatch(sql, /create\s+table|create\s+(?:or\s+replace\s+)?function|\bgrant\b|create\s+policy|enable\s+row\s+level\s+security|\binsert\b|\bupdate\b|\bdelete\b/);
  assert.equal((sql.match(/alter\s+table\s+public\.continuum_performance_audit/g) ?? []).length, 4);
});
