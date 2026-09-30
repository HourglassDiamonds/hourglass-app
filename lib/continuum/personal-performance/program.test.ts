import assert from "node:assert/strict";
import test from "node:test";
import {
  PERFORMANCE_PARAMETERS,
  phaseForWeek,
  prescriptionForDate,
  programPositionForDate,
  programWeekForDate,
  weekDateKeys,
} from "./program";

test("keeps pre-start dates in PREP without fictional Week 1 progress", () => {
  assert.deepEqual(programPositionForDate("2026-09-30"), {
    status: "prep",
    week: null,
    phase: null,
    startsInDays: 5,
  });
  assert.equal(programWeekForDate("2026-10-04"), null);
  assert.equal(prescriptionForDate("2026-09-30").title, "Prepare the runway");
  assert.match(prescriptionForDate("2026-09-30").recovery, /does not count toward adherence/);
});

test("starts Week 1 and RE-ENTRY on Monday October 5", () => {
  assert.deepEqual(programPositionForDate("2026-10-05"), {
    status: "active",
    week: 1,
    phase: "RE-ENTRY",
    startsInDays: 0,
  });
  const dayOne = prescriptionForDate("2026-10-05");
  assert.equal(dayOne.day, "Monday");
  assert.equal(dayOne.domain, "strength");
  assert.equal(dayOne.title, "Foundation A");
});

test("maps the twelve weeks into re-entry, build, and perform", () => {
  assert.equal(phaseForWeek(1), "RE-ENTRY");
  assert.equal(phaseForWeek(5), "BUILD");
  assert.equal(phaseForWeek(9), "PERFORM");
  assert.equal(programWeekForDate("2026-11-02"), 5);
  assert.equal(programWeekForDate("2026-11-30"), 9);
  assert.equal(programWeekForDate("2026-12-21"), 12);
});

test("keeps early recovery work easy and excludes aggressive rucking", () => {
  const wednesday = prescriptionForDate("2026-10-07");
  assert.equal(wednesday.title, "Easy 20 lb ruck");
  assert.match(wednesday.summary, /20 lb ruck/);
  assert.match(wednesday.summary, /90 lb ruck parked/);
  assert.match(wednesday.recovery, /full sentences/);
});

test("keeps Friday lower-body stress away from the Saturday run", () => {
  const friday = prescriptionForDate("2026-10-09");
  assert.equal(friday.title, "Upper + trunk");
  assert.doesNotMatch(friday.exercises.map((row) => row.name).join(" "), /squat|deadlift/i);
  assert.match(friday.recovery, /No lower-body finishers/);
});

test("peaks for the Week 11 December 19 5K and continues afterward", () => {
  const firstSaturday = prescriptionForDate("2026-10-10");
  const rehearsal = prescriptionForDate("2026-12-12");
  const race = prescriptionForDate(PERFORMANCE_PARAMETERS.eventDate);
  const postRace = prescriptionForDate("2026-12-26");
  assert.match(firstSaturday.title, /Run \/ walk 1:2/);
  assert.match(firstSaturday.summary, /wanting one more round/);
  assert.match(rehearsal.title, /4K rehearsal/);
  assert.match(rehearsal.summary, /not a time trial/);
  assert.equal(race.title, "Christmas 5K");
  assert.equal(programPositionForDate(PERFORMANCE_PARAMETERS.eventDate).week, 11);
  assert.equal(postRace.title, "Post-race aerobic reset");
  assert.equal(programPositionForDate("2026-12-28").status, "complete");
});

test("models nutrition targets as explicit adjustable parameters", () => {
  assert.equal(PERFORMANCE_PARAMETERS.nutrition.dailyCalories, 2400);
  assert.equal(PERFORMANCE_PARAMETERS.nutrition.dailyProteinG, 190);
  assert.ok(PERFORMANCE_PARAMETERS.nutrition.dailyCalories >= 2000);
  assert.deepEqual(weekDateKeys("2026-10-07"), [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ]);
});
