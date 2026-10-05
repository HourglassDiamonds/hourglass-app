import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { proposeTodayFounderOperation } from "@/lib/continuum/concierge-sol/founder-command";
import type { TodayBriefingPacket } from "./briefing-packet";
import type { CosDocketItemView } from "./types";
import { authoritativeTodayDocket, TODAY_DOCKET_VERSION } from "./docket";
import { presentCosFeedback } from "@/lib/continuum/cos-feedback/feedback";
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
    todayDocketVersion: TODAY_DOCKET_VERSION,
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
    assert.equal(presented.title, "Review the CAD and send Ben the update.");
    assert.equal(presented.founderCheckpoint, "");
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
    assert.equal(presented.noiseKind, "receipt");
    assert.equal(presented.suggestedAction, "Dismiss");
    assert.doesNotMatch(`${presented.title} ${presented.summary}`, /receipt.*receipt/i);
  });

  it("removes quoted chains, signatures, and duplicate sentences", () => {
    const normalized = normalizeFounderFacingSource("CAD is ready. CAD is ready.\nOn Monday, Justin wrote:\nold copy\nBest regards,\nVendor");
    assert.equal(normalized, "CAD is ready.");
  });

  it("keeps a real invoice useful while rejecting its contact-footer sentence as the action", () => {
    const footer = "please do not hesitate to get in touch by emailing; invoicing@nivoda";
    const presented = presentTodayItem(item({
      id: "brief:invoice",
      subject: "Unassigned",
      headline: footer,
      context: "The client answered a design question.",
      briefing: {
        ...item().briefing!,
        displayName: "Unassigned",
        headline: footer,
        stand: "The invoice is attached and ready for payment.",
        nextBody: footer,
      },
      briefingPacket: packet({
        itemId: "brief:invoice",
        displayName: "Unassigned",
        entityType: "unknown",
        projectName: null,
        projectId: null,
        personId: null,
        candidateNextAction: footer,
        unresolvedFounderObligation: footer,
        latestMeaningfulExternalEvent: {
          at: "2026-10-03T18:51:15.000Z",
          speaker: "client",
          summary: "Your invoice is attached and ready for payment.",
          sourceRef: "gc1|invoice-thread|invoice-message",
        },
      }),
    }));

    assert.equal(presented.title, "Review the invoice");
    assert.equal(presented.summary, "Your invoice is attached and ready for payment.");
    assert.equal(presented.likelyNoise, false);
    assert.doesNotMatch(`${presented.title} ${presented.summary}`, /do not hesitate|invoicing@/i);
  });

  it("presents Abbey as one concise sale-blocking founder action", () => {
    const rawAsk = "Can you send me a rendering?";
    const abbey = item({
      id: "brief:abbey",
      subject: "Abbey / C026137",
      headline: rawAsk,
      context: "Option #2 is good. I want a little more movement in the marquise. Can you send me a rendering?",
      briefingPacket: packet({
        itemId: "brief:abbey",
        displayName: "Abbey",
        projectName: "C026137",
        candidateNextAction: rawAsk,
        unresolvedFounderObligation: rawAsk,
      }),
      briefing: {
        ...item().briefing!,
        displayName: "Abbey",
        projectName: "C026137",
        headline: rawAsk,
        stand: "Option #2 is good. I want a little more movement in the marquise.",
        nextBody: rawAsk,
      },
    });
    const presented = presentTodayItem(abbey);
    assert.equal(presented.title, "Send Abbey the revised rendering");
    assert.equal(presented.summary, "She likes option #2 and wants a little more movement in the marquise.");
    assert.equal(presented.founderCheckpoint, "");
    assert.equal(presented.reason, "Active design decision is blocking the sale.");
    assert.doesNotMatch(`${presented.title} ${presented.summary} ${presented.founderCheckpoint} ${presented.reason}`, /Can you send me a rendering/i);
  });

  it("reclassifies receipt noise and stale founder ownership before rendering or feedback", () => {
    const abbey = item({
      id: "brief:abbey",
      subject: "Abbey / C026137",
      headline: "Can you send me a rendering?",
      context: "Option #2 is good. A little more movement in the marquise.",
      briefingPacket: packet({ itemId: "brief:abbey", displayName: "Abbey", projectName: "C026137" }),
    });
    const jennifer = item({
      id: "brief:jennifer",
      subject: "Jennifer Flores",
      headline: "Please confirm the receipt of this email.",
      context: "Please confirm the receipt of this email.",
      briefingPacket: packet({ itemId: "brief:jennifer", displayName: "Jennifer Flores" }),
    });
    const travis = item({
      id: "brief:travis",
      subject: "Travis",
      headline: "Approved",
      context: "Waiting on client reply / finger size.",
      briefingPacket: packet({
        itemId: "brief:travis",
        displayName: "Travis",
        projection: {
          workstreamId: "travis",
          stage: "approved",
          dependency: "Waiting on client reply / finger size.",
          ballHolder: "founder",
          activeObligations: [],
          historicalObligations: [],
          commitment: null,
          controllingSourceRefs: ["gmail:travis"],
          asOf: "2026-10-05T12:00:00.000Z",
          provenance: [],
        },
      }),
    });
    const automated = item({
      id: "brief:automated",
      subject: "Unassigned",
      headline: "This is an automated message. Do not reply.",
      context: "This is an automated message. Do not reply.",
      briefingPacket: packet({ itemId: "brief:automated", displayName: "Unassigned" }),
    });
    const docket = authoritativeTodayDocket({
      todayDocketVersion: TODAY_DOCKET_VERSION,
      title: "Up next",
      items: [jennifer, automated, travis, abbey],
      queuedCount: 0,
      watchingCount: 0,
      watching: [],
      showCaughtUp: false,
      showDisconnected: false,
      caughtUpHeading: "",
      caughtUpDetail: null,
      disconnectedHeading: null,
      disconnectedDetail: null,
    });
    assert.deepEqual(docket.items.map((row) => row.id), ["brief:abbey"]);
    assert.deepEqual(docket.watching.map((row) => row.id), ["brief:travis"]);
    assert.deepEqual(docket.cleanup?.map((row) => row.id), ["brief:jennifer"]);
    assert.equal(docket.watching[0]?.detail, "Waiting for client finger size.");

    const cleanupHtml = renderToStaticMarkup(createElement(ChiefOfStaffToday, { docket }));
    const cleanupSection = cleanupHtml.split("data-cos-cleanup")[1] ?? "";
    assert.match(cleanupSection, /Receipt confirmation request/);
    assert.doesNotMatch(cleanupSection, /data-cos-founder-verb=/);
    assert.doesNotMatch(cleanupHtml, /This is an automated message/);

    const feedback = presentCosFeedback({
      docket,
      sourceWatermark: "acceptance",
      nowIso: "2026-10-05T12:00:00.000Z",
    });
    assert.match(feedback.founderGuidance, /one meaningful founder action right now: send Abbey the revised rendering/i);
    assert.match(feedback.founderGuidance, /Travis is waiting on the client/i);
    assert.match(feedback.founderGuidance, /Jennifer’s receipt request looks like low-value admin and can be dismissed/i);
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

    const delivered = proposeTodayFounderOperation(
      "This was hand delivered weeks ago.",
      packet({ itemId: "brief:travis", displayName: "Travis" }),
    );
    assert.equal(delivered?.kind, "correct");
    if (delivered?.kind === "correct")
      assert.deepEqual(delivered.truth, {
        stage: "complete",
        ballHolder: "unknown",
        dependency: null,
      });

    const followedUp = proposeTodayFounderOperation(
      "I already followed up this morning.",
      packet({
        itemId: "brief:cad:C025999",
        displayName: "Vendor contact",
        ballHolder: "founder",
        identifiers: [{ value: "C025999", role: "cadId", current: true }],
      }),
    );
    assert.equal(followedUp?.kind, "correct");
    if (followedUp?.kind === "correct") {
      assert.equal(followedUp.truth.ballHolder, "vendor_shop");
      assert.equal(followedUp.truth.dependency, "waiting for vendor response");
    }
  });
});
