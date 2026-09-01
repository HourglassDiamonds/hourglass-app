import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOM_LIFECYCLE_STAGE_LABELS,
  CUSTOM_LIFECYCLE_STAGES,
  PROJECT_LIFECYCLE_NOT_SET_LABEL,
  REPAIR_LIFECYCLE_STAGE_LABELS,
  REPAIR_LIFECYCLE_STAGES,
  isCustomLifecycleStage,
  isLifecycleKind,
  isRepairLifecycleStage,
  isStageAllowedForKind,
  lifecycleStageLabel,
  parseLifecycleStageInput,
} from "./project-lifecycle";

describe("Project Lifecycle domain", () => {
  it("accepts exactly the Custom stages", () => {
    assert.deepEqual([...CUSTOM_LIFECYCLE_STAGES], [
      "discovery",
      "design",
      "cad",
      "client_approval",
      "production",
      "quality_control",
      "ready_for_delivery",
      "completed",
    ]);
    for (const stage of CUSTOM_LIFECYCLE_STAGES) {
      assert.equal(isCustomLifecycleStage(stage), true);
      assert.equal(isStageAllowedForKind("custom_new_jewelry", stage), true);
      assert.equal(parseLifecycleStageInput("custom_new_jewelry", stage).ok, true);
    }
  });

  it("accepts exactly the Repair stages", () => {
    assert.deepEqual([...REPAIR_LIFECYCLE_STAGES], [
      "intake",
      "evaluation",
      "estimate",
      "client_approval",
      "bench",
      "quality_control",
      "ready_for_return",
      "completed",
    ]);
    for (const stage of REPAIR_LIFECYCLE_STAGES) {
      assert.equal(isRepairLifecycleStage(stage), true);
      assert.equal(isStageAllowedForKind("repair_service", stage), true);
      assert.equal(parseLifecycleStageInput("repair_service", stage).ok, true);
    }
  });

  it("rejects invalid and cross-kind stages", () => {
    assert.equal(parseLifecycleStageInput("custom_new_jewelry", "intake").ok, false);
    assert.equal(parseLifecycleStageInput("repair_service", "cad").ok, false);
    assert.equal(parseLifecycleStageInput("custom_new_jewelry", "bench").ok, false);
    assert.equal(parseLifecycleStageInput("repair_service", "discovery").ok, false);
    assert.equal(parseLifecycleStageInput("custom_new_jewelry", "received").ok, false);
    assert.equal(parseLifecycleStageInput("custom_new_jewelry", "CAD").ok, false);
    assert.equal(isCustomLifecycleStage("intake"), false);
    assert.equal(isRepairLifecycleStage("design"), false);
  });

  it("rejects lifecycle for unsupported kinds", () => {
    for (const kind of [null, "other", "loose_stone_sourcing", "consultation_opportunity"]) {
      assert.equal(isLifecycleKind(kind), false);
      assert.equal(parseLifecycleStageInput(kind, "cad").ok, false);
      assert.equal(parseLifecycleStageInput(kind, "intake").ok, false);
    }
  });

  it("treats empty as Not set and uses founder-facing labels", () => {
    assert.deepEqual(parseLifecycleStageInput("custom_new_jewelry", null), {
      ok: true,
      stage: null,
    });
    assert.deepEqual(parseLifecycleStageInput("repair_service", ""), {
      ok: true,
      stage: null,
    });
    assert.equal(lifecycleStageLabel("custom_new_jewelry", null), PROJECT_LIFECYCLE_NOT_SET_LABEL);
    assert.equal(CUSTOM_LIFECYCLE_STAGE_LABELS.completed, "Complete");
    assert.equal(REPAIR_LIFECYCLE_STAGE_LABELS.completed, "Complete");
    assert.equal(CUSTOM_LIFECYCLE_STAGE_LABELS.cad, "CAD");
    assert.equal(REPAIR_LIFECYCLE_STAGE_LABELS.bench, "Bench");
  });
});
