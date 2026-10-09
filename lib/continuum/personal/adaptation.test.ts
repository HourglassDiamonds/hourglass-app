import assert from "node:assert/strict";
import test from "node:test";
import { applySterlingProposal, proposeSterlingAdjustment } from "./adaptation";
import { createInitialPersonalState, shiftDate } from "./program";

test("four hours sleep / gassed / ruck today / weights tomorrow is proposed, confirmed, and reflowed", () => {
  const today = "2026-10-05";
  const state = createInitialPersonalState(today);
  const original = state.schedule.find((workout) => workout.date === today)!;
  const proposal = proposeSterlingAdjustment(state, "I got about four hours of sleep and I’m gassed. Skip the weights today. I’m going to ruck. Move the weights to tomorrow.", today);
  assert.ok(proposal);
  assert.equal(state.schedule.find((workout) => workout.id === original.id)?.status, "planned", "proposal must not mutate canonical state");
  const confirmed = applySterlingProposal(state, proposal!);
  const originalOccurrence = confirmed.schedule.find((workout) => workout.id === original.id);
  const moved = confirmed.schedule.find((workout) => workout.replacesWorkoutId === original.id && workout.date === "2026-10-06");
  const replacement = confirmed.schedule.find((workout) => workout.replacesWorkoutId === original.id && workout.date === today);
  assert.equal(originalOccurrence?.status, "deferred");
  assert.equal(moved?.prescription.id, original.prescription.id);
  assert.deepEqual(moved?.prescription.exercises, original.prescription.exercises);
  assert.equal(replacement?.prescription.mode, "ruck");
  assert.equal(replacement?.prescription.intent, "easy");
  assert.deepEqual(confirmed.recoveryEntries[0]?.sleepHours, { value: 4, source: "manual" });
  assert.equal(confirmed.recoveryEntries[0]?.fatigue?.value, "high");
  assert.equal(confirmed.schedule.length, state.schedule.length + 2, "defer history, moved work, and replacement must not erase an occurrence");
  assert.equal(new Set(confirmed.schedule.map((workout) => workout.id)).size, confirmed.schedule.length);
  const activeStrength = confirmed.schedule.filter((workout) => workout.status === "planned" && workout.prescription.domain === "strength").sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < activeStrength.length; index += 1) assert.notEqual(shiftDate(activeStrength[index - 1]!.date, 1), activeStrength[index]!.date);
});

test("Sterling can propose a recovery-only entry without fabricating WHOOP values", () => {
  const state = createInitialPersonalState("2026-10-05");
  const proposal = proposeSterlingAdjustment(state, "I slept about four hours and feel wrecked. No pain.", "2026-10-05");
  assert.ok(proposal);
  assert.deepEqual(proposal?.recovery?.sleepHours, { value: 4, source: "manual" });
  assert.equal(proposal?.recovery?.hrvMs, undefined);
  assert.equal(proposal?.affectedWorkoutIds.length, 0);
});
