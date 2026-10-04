import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proposeTodayFounderOperation } from "@/lib/continuum/concierge-sol/founder-command";
import type { TodayBriefingPacket } from "./briefing-packet";
import type { CosDocketItemView } from "./types";
import {
  normalizeFounderFacingSource,
  presentTodayItem,
} from "./today-presentation";

function packet(overrides: Partial<TodayBriefingPacket> = {}): TodayBriefingPacket {
  return {
    itemId: "brief:ben",
    displayName: "Ben C.",
    entityType: "client",
    briefingKind: "generic",
    projectName: "Custom ring",
    projectId: "project-ben",
    personId: "person-ben",
    organizationLabel: null,
    vendorContactName: null,
    identifiers: [],
    lifecycle: "active",
    latestMeaningfulExternalEvent: null,
    latestMeaningfulFounderAction: null,
    ballHolder: "founder",
    unresolvedFounderObligation: "Review the CAD and send Ben the update.",
    externalCommitment: null,
    nextExpectedEvent: null,
    candidateNextAction: "Review the CAD and send Ben the update.",
    uncertainty: [],
    mustNotState: [],
    sourceRefs: ["gmail:ben"],
    authoritative: true,
    ...overrides,
  };
}

function item(overrides: Partial<CosDocketItemView> = {}): CosDocketItemView {
  return {
    id: "brief:ben",
    lane: "live_work",
    origin: "brief",
    subject: "Ben C. / Custom ring",
    headline: "CAD review.",
    context: "Waiting on CAD review.",
    job: null,
    brief: null,
    decision: null,
    anomaly: null,
    briefingPacket: packet(),
    briefing: {
      displayName: "Ben C.",
      projectName: "Custom ring",
      stateChip: "YOUR MOVE",
      headline: "CAD is in.",
      stand: "The shop delivered the CAD.",
      nextKind: "best_next_step",
      nextLabel: "Best next step",
      nextBody: "Review the CAD and send Ben the update.",
      source: "deterministic",
    },
    cosBriefing: {
      modelId: "cos-briefing-v1",
      currentState: "CAD is ready for review.",
      timingFacts: [],
      timingProse: null,
      checkpoint: null,
      checkpointProse: "Review the CAD and send Ben the update.",
      why: null,
      currentFounderAction: true,
    },
    ...overrides,
  };
}

describe("Sterling-curated Today presentation", () => {
  it("gives Ben one consistent founder action", () => {
    const presented = presentTodayItem(item());
    assert.equal(presented.stateLabel, "FOUNDER ACTION");
    assert.equal(presented.ownerLabel, "Justin");
    assert.equal(presented.founderCheckpoint, "Review the CAD and send Ben the update.");
    assert.doesNotMatch(presented.founderCheckpoint, /nothing needed/i);
  });

  it("fails closed to Review instead of showing a contradictory confident row", () => {
    const contradictory = item({
      cosBriefing: {
        ...item().cosBriefing!,
        checkpointProse: "Nothing needed now.",
        currentFounderAction: false,
      },
    });
    const presented = presentTodayItem(contradictory);
    assert.equal(presented.stateLabel, "REVIEW");
    assert.equal(presented.conflict, true);
    assert.match(presented.founderCheckpoint, /sources conflict/i);
  });

  it("turns Jennifer-style repeated email copy into one dismissible semantic sentence", () => {
    const noisy = "Please confirm the receipt of this email. Please confirm the receipt of this email. Please confirm the receipt of this email.";
    const presented = presentTodayItem(item({
      id: "brief:jennifer",
      subject: "Jennifer Flores",
      headline: noisy,
      context: noisy,
      briefing: { ...item().briefing!, displayName: "Jennifer Flores", headline: noisy, stand: noisy, nextBody: noisy },
      briefingPacket: packet({ itemId: "brief:jennifer", displayName: "Jennifer Flores", candidateNextAction: noisy, unresolvedFounderObligation: noisy }),
    }));
    assert.equal(presented.title, "Receipt confirmation request");
    assert.equal(presented.summary, "The sender is asking for confirmation that the message arrived.");
    assert.equal(presented.likelyNoise, true);
    assert.equal(presented.suggestedAction, "Dismiss");
    assert.doesNotMatch(`${presented.title} ${presented.summary}`, /receipt.*receipt/i);
  });

  it("removes quoted chains, signatures, and duplicate sentences", () => {
    const normalized = normalizeFounderFacingSource("CAD is ready. CAD is ready.\nOn Monday, Justin wrote:\nold copy\nBest regards,\nVendor");
    assert.equal(normalized, "CAD is ready.");
  });
});

describe("row-scoped Sterling commands", () => {
  it("uses row context for waiting, hold, resolution, dismissal, and timed snooze", () => {
    const p = packet();
    const waiting = proposeTodayFounderOperation("Waiting on the shop now.", p);
    assert.equal(waiting?.kind, "correct");
    if (waiting?.kind === "correct") {
      assert.deepEqual(waiting.truth, { ballHolder: "vendor_shop", dependency: "the shop now" });
      assert.equal(waiting.scope?.workLoopId, "ben");
    }
    assert.equal(proposeTodayFounderOperation("Hold until I contact Ben again.", p)?.kind, "correct");
    assert.deepEqual(proposeTodayFounderOperation("I already handled this.", p), { kind: "resolve", target: "Ben C.", days: null });
    assert.deepEqual(proposeTodayFounderOperation("Don't show me this again.", p), { kind: "cancel", target: "Ben C.", days: null });
    assert.deepEqual(
      proposeTodayFounderOperation("Bring this back Monday.", p, new Date("2026-10-04T12:00:00-04:00")),
      { kind: "snooze", target: "Ben C.", days: 1 },
    );
  });

  it("answers questions without proposing a mutation", () => {
    assert.equal(proposeTodayFounderOperation("Should we hold this?", packet()), null);
  });

  it("maps the live Ben and Dylan directives to durable scoped dispositions", () => {
    const ben = proposeTodayFounderOperation(
      "Ben can be put on the backburner. I need to get his wife’s ring size.",
      packet({ itemId: "brief:cad:C026156", projectId: null, personId: null, identifiers: [{ value: "C026156", role: "cadId", current: true }] }),
    );
    assert.equal(ben?.kind, "correct");
    if (ben?.kind === "correct") {
      assert.deepEqual(ben.truth, { ballHolder: "unknown", dependency: "waiting for ring size" });
      assert.equal(ben.scope?.workLoopId, "cad:C026156");
      assert.deepEqual(ben.scope?.cadIds, ["C026156"]);
    }

    const dylan = proposeTodayFounderOperation(
      "This job is in production. Move it accordingly.",
      packet({ itemId: "brief:cad:C025610", displayName: "Dylon D.", projectId: null, personId: null, identifiers: [{ value: "C025610", role: "cadId", current: true }] }),
    );
    assert.equal(dylan?.kind, "correct");
    if (dylan?.kind === "correct") {
      assert.deepEqual(dylan.truth, { stage: "in_production", ballHolder: "vendor_shop", dependency: "vendor production" });
      assert.equal(dylan.scope?.workLoopId, "cad:C025610");
    }
  });
});
