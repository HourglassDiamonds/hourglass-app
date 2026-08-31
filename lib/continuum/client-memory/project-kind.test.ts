import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROJECT_KIND_CLEAR_LABEL,
  PROJECT_KIND_CHIP_LABELS,
  PROJECT_KIND_LABELS,
  PROJECT_KIND_NOT_SET_LABEL,
  PROJECT_KINDS,
  isProjectKind,
  parseProjectKindInput,
  projectKindChipLabel,
  projectKindFromUnknown,
  projectKindLabel,
} from "./project-kind";

describe("Project Kind helpers", () => {
  it("A. accepts only the five canonical kinds", () => {
    assert.deepEqual([...PROJECT_KINDS], [
      "custom_new_jewelry",
      "repair_service",
      "loose_stone_sourcing",
      "consultation_opportunity",
      "other",
    ]);
    for (const kind of PROJECT_KINDS) {
      assert.equal(isProjectKind(kind), true);
      assert.equal(parseProjectKindInput(kind).ok, true);
    }
  });

  it("B. rejects invalid values without coercion", () => {
    for (const value of [
      "ring",
      "repair",
      "custom",
      "SP13040",
      "C010657",
      "unknown",
      "not_set",
      "undefined",
      "Custom / New Jewelry",
      1,
      false,
    ]) {
      assert.equal(isProjectKind(value), false);
      assert.equal(parseProjectKindInput(value).ok, false);
      assert.equal(projectKindFromUnknown(value), null);
    }
  });

  it("C. treats NULL, empty, and absent as unclassified", () => {
    assert.deepEqual(parseProjectKindInput(null), { ok: true, kind: null });
    assert.deepEqual(parseProjectKindInput(""), { ok: true, kind: null });
    assert.deepEqual(parseProjectKindInput("  "), { ok: true, kind: null });
    assert.equal(projectKindFromUnknown(undefined), null);
    assert.equal(projectKindLabel(null), PROJECT_KIND_NOT_SET_LABEL);
    assert.notEqual(PROJECT_KIND_LABELS.other, PROJECT_KIND_NOT_SET_LABEL);
    assert.equal(PROJECT_KIND_CLEAR_LABEL.includes("Not set"), true);
  });

  it("exposes founder-facing labels without duplicating literals in callers", () => {
    assert.equal(projectKindLabel("custom_new_jewelry"), "Custom / New Jewelry");
    assert.equal(projectKindLabel("repair_service"), "Repair / Service");
    assert.equal(projectKindLabel("loose_stone_sourcing"), "Loose Stone / Sourcing");
    assert.equal(
      projectKindLabel("consultation_opportunity"),
      "Consultation / Opportunity",
    );
    assert.equal(projectKindLabel("other"), "Other");
    assert.equal(
      projectKindChipLabel("custom_new_jewelry"),
      PROJECT_KIND_CHIP_LABELS.custom_new_jewelry,
    );
  });
});
