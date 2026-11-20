import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectFinalCadWorkflow } from "./final-cad-workflow";

describe("final CAD founder workflow", () => {
  it("turns final-CAD delivery into a specific founder review without leaving CAD", () => {
    const projected = projectFinalCadWorkflow({ decision: "delivered", eventOn: "2026-11-19" });
    assert.equal(projected.lifecycleStage, "cad");
    assert.equal(projected.waitingOn, "founder");
    assert.equal(projected.attentionPriority, "action_now");
    assert.deepEqual(projected.obligationUpdates?.map((row) => [row.obligationId, row.status]), [
      ["shop-final-cad", "fulfilled"],
      ["founder-cad-review", "open"],
    ]);
  });

  it("keeps a requested revision in CAD and returns the turn to the shop", () => {
    const projected = projectFinalCadWorkflow({ decision: "revision_requested", eventOn: "2026-11-20" });
    assert.equal(projected.lifecycleStage, "cad");
    assert.equal(projected.waitingOn, "vendor_shop");
    assert.equal(projected.productionEstimate, undefined);
  });

  it("starts Production on approval, waits on the shop, and reports a pending ETA without a quote", () => {
    const projected = projectFinalCadWorkflow({ decision: "approved", eventOn: "2026-11-20" });
    assert.equal(projected.lifecycleStage, "production");
    assert.equal(projected.lifecycleEffectiveOn, "2026-11-20");
    assert.equal(projected.waitingOn, "vendor_shop");
    assert.equal(projected.operationalSubstage, "In production · Production ETA pending");
    assert.deepEqual(projected.productionEstimate, {
      status: "pending",
      completionOn: null,
      quotedLeadTime: null,
      sourceRef: null,
    });
    assert.equal(projected.obligationUpdates?.find(
      (row) => row.obligationId === "shop-production-completion",
    )?.status, "open");
  });

  it("calculates completion from the quoted production lead time and keeps its source", () => {
    const projected = projectFinalCadWorkflow({
      decision: "approved",
      eventOn: "2026-11-20",
      productionLeadTime: {
        quantity: 10,
        unit: "business_days",
        quotedText: "about 10 business days in production",
        sourceRef: "gmail:thread:synthetic-shop-quote",
      },
    });
    assert.deepEqual(projected.productionEstimate, {
      status: "estimated",
      completionOn: "2026-12-04",
      quotedLeadTime: "about 10 business days in production",
      sourceRef: "gmail:thread:synthetic-shop-quote",
    });
  });

  it("preserves the first approval date on replay", () => {
    const replayed = projectFinalCadWorkflow({
      decision: "approved",
      eventOn: "2026-11-23",
      existingApprovalOn: "2026-11-20",
    });
    assert.equal(replayed.lifecycleEffectiveOn, "2026-11-20");
  });
});
