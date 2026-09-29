import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySourceCommunication,
  classifySourceCommunications,
} from "@/lib/continuum/source-events/classify";
import { extractCurrentMessageOperationalFacts } from "@/lib/continuum/source-events/operational-facts";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import {
  COS_LOOP_PROJECT_A,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import { normalizeCommitment, projectCurrentWork } from "./current-work";
import { reduceWorkLoop } from "./work-loop-state";

function event(
  id: string,
  wording: string,
  day: number,
  actor: SourceCommunicationEvent["actor"] = "vendor_shop",
  extra: Partial<SourceCommunicationEvent> = {},
): SourceCommunicationEvent {
  const direction = actor === "founder" ? "outbound" : "inbound";
  return {
    sourceType: "gmail",
    sourceRef: `gc1|truth-thread|${id}`,
    messageId: id,
    threadId: "truth-thread",
    timestamp: `2026-09-${String(day).padStart(2, "0")}T16:00:00Z`,
    direction,
    actor,
    subject: "HGD x Client-C026350",
    authorOwnedText: wording,
    quotedText: "",
    attachmentFilenames: [],
    hasAttachments: false,
    cadIds: ["C026350"],
    orderIds: [],
    productionJobIds: [],
    personLabel: "Client",
    projectId: COS_LOOP_PROJECT_A,
    workLoopId: `project:${COS_LOOP_PROJECT_A}`,
    semanticClass: classifySourceCommunication({
      actor,
      direction,
      subject: null,
      authorOwnedText: wording,
    }),
    evidenceExcerpt: wording,
    workIdentityBasis: "project",
    provenance: "indexed_gmail+live_operational_fact",
    ...extra,
  };
}

describe("adversarial current-truth regressions", () => {
  it("is clause-level negation aware for terminal and ready states", () => {
    const classify = (wording: string) =>
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: null,
        authorOwnedText: wording,
      });
    assert.equal(classify("The ring is complete."), "work_complete");
    assert.notEqual(classify("The ring is not complete."), "work_complete");
    assert.equal(classify("It is ready for pickup."), "work_ready");
    assert.notEqual(classify("It is not ready for pickup."), "work_ready");
    assert.notEqual(
      classify("CAD is complete but the ring is not complete."),
      "work_complete",
    );
    assert.notEqual(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: null,
        authorOwnedText: "Thanks.",
        quotedText: "The ring is complete.",
      }),
      "work_complete",
    );
  });

  it("reopens delivered work only for explicit later service", () => {
    for (const request of ["Can you resize the ring?", "Please repair the ring."]) {
      const projection = projectCurrentWork([
        event("done", "The ring has been delivered.", 10),
        event("service", request, 11, "client"),
      ])!;
      assert.notEqual(projection.stage, "complete");
      assert.equal(projection.ballHolder, "founder");
      assert.equal(projection.activeObligations.length, 1);
      assert.ok(projection.historicalObligations.length >= 0);
    }
    assert.equal(
      projectCurrentWork([
        event("done", "The ring has been delivered.", 10),
        event("ack", "Thanks!", 11),
      ])?.stage,
      "complete",
    );
    assert.equal(
      projectCurrentWork([
        event("done", "The ring has been delivered.", 10),
        event("quote", "Thanks!", 11, "client", {
          quotedText: "Can you resize the ring?",
        }),
      ])?.stage,
      "complete",
    );
  });

  it("preserves CAD and client obligations with independent identities", () => {
    const cadA = event("cad-a", "Please send CAD C026350.", 10, "founder", {
      cadIds: ["C026350"],
    });
    const orderB = event(
      "order-b",
      "Order confirmation SP99999 attached for C099999.",
      11,
      "vendor_shop",
      { cadIds: ["C099999"], orderIds: ["SP99999"] },
    );
    const projection = projectCurrentWork([cadA, orderB])!;
    assert.ok(projection.activeObligations.some((row) => row.scope === "cad:C026350"));
    assert.ok(projection.activeObligations.some((row) => row.scope === "cad:C099999"));

    const clientRequests = projectCurrentWork([
      event("engraving", "Please confirm the engraving.", 10, "client"),
      event("invoice", "Please update the invoice.", 11, "client"),
    ])!;
    assert.equal(
      clientRequests.activeObligations.filter((row) => row.kind === "client_request").length,
      2,
    );

    const cadAndClient = projectCurrentWork([
      cadA,
      event("engraving", "Please confirm the engraving.", 11, "client"),
    ])!;
    assert.ok(cadAndClient.activeObligations.some((row) => row.kind === "cad"));
    assert.ok(
      cadAndClient.activeObligations.some((row) => row.kind === "client_request"),
    );

    const twoCadRequests = [
      cadA,
      event("cad-b", "Please send CAD C099999.", 10, "founder", {
        cadIds: ["C099999"],
      }),
    ];
    const deliveryB = event("delivery-b", "CAD C099999 attached.", 11, "vendor_shop", {
      cadIds: ["C099999"],
    });
    const afterDelivery = projectCurrentWork([...twoCadRequests, deliveryB])!;
    assert.ok(afterDelivery.activeObligations.some((row) => row.scope === "cad:C026350"));
    assert.ok(afterDelivery.historicalObligations.some((row) => row.scope === "cad:C099999"));
  });

  it("keeps independent canonical Jobs beside production and beside each other", () => {
    const production = event("production", "Production has started.", 10);
    const invoice = fixtureJob({
      jobId: "invoice-job",
      subject: "Send separate invoice",
    });
    const docket = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [invoice],
        projects: fixtureProjects(),
        founderCorrections: [production],
        nowIso: "2026-09-29T16:00:00Z",
      }),
    );
    assert.ok(docket.items.some((item) => item.headline.includes("invoice")));
    assert.ok(docket.watching.some((item) => item.briefingPacket?.projection?.stage === "in_production"));

    const two = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [
          invoice,
          fixtureJob({ jobId: "call-job", subject: "Call client" }),
        ],
        projects: fixtureProjects(),
        nowIso: "2026-09-29T16:00:00Z",
      }),
    );
    assert.equal(two.items.length, 2);
  });

  it("suppresses only the exact source obligation for canonical terminal disposition", () => {
    const source = event("cad", "CAD attached.", 10);
    const unrelated = event("other", "Please confirm the engraving.", 11, "client");
    const run = (state: "open" | "snoozed" | "resolved" | "cancelled") =>
      composeTodayDocket(
        composeCosOperatingLoop({
          jobs: [
            fixtureJob({
              jobId: "linked-job",
              subject: "Review CAD",
              state,
              sourceRef: source.sourceRef,
              deferredUntil:
                state === "snoozed" ? "2026-10-10T00:00:00Z" : null,
            }),
          ],
          projects: fixtureProjects(),
          founderCorrections: [source, unrelated],
          nowIso: "2026-09-29T16:00:00Z",
        }),
      );
    assert.ok(run("open").items.length > 0);
    for (const state of ["snoozed", "resolved", "cancelled"] as const) {
      const result = run(state);
      assert.equal(
        [...result.items, ...result.watching].some((item) =>
          item.briefingPacket?.projection?.activeObligations.some(
            (obligation) => obligation.openedBy === source.sourceRef,
          ),
        ),
        false,
      );
      assert.equal(
        [...result.items, ...result.watching].some((item) =>
          item.briefingPacket?.projection?.activeObligations.some(
            (obligation) => obligation.openedBy === unrelated.sourceRef,
          ),
        ),
        true,
      );
    }
  });

  it("never lets stale legacy remaining text rewrite a structured projection", () => {
    const source = event("engraving", "Please confirm the engraving.", 10, "client");
    const reduced = reduceWorkLoop({
      evidence: [],
      sourceEvents: [source],
      staleInboundSatisfied: true,
      remaining: {
        matchedText: "Send the stale invoice.",
        headline: "Send the stale invoice.",
        explanation: "stale",
        recommended: "stale",
      },
    });
    assert.equal(reduced.projection?.dependency, "Please confirm the engraving.");
    assert.equal(reduced.projection?.ballHolder, "founder");
  });

  it("emits multiple operational events and retains late controlling clauses", () => {
    const classes = classifySourceCommunications({
      actor: "vendor_shop",
      direction: "inbound",
      subject: null,
      authorOwnedText: "CAD attached. Production has started.",
    }).map((row) => row.semanticClass);
    assert.ok(classes.includes("vendor_delivers_artifact"));
    assert.ok(classes.includes("workshop_started"));

    const projected = projectGmailSourceEvents({
      threadContext: new Map([
        [
          "truth-thread",
          {
            subject: "HGD x Client-C026350",
            messages: [
              {
                messageId: "multi-message",
                sentAt: "2026-09-10T16:00:00Z",
                direction: "inbound" as const,
                operationalText: "CAD attached. Production has started.",
                attachmentFilenames: [],
                hasAttachments: false,
              },
            ],
          },
        ],
      ]),
      projectIdByThread: new Map([["truth-thread", COS_LOOP_PROJECT_A]]),
      knownPeople: [],
    });
    assert.deepEqual(
      projected.map((row) => row.semanticClass).sort(),
      ["vendor_delivers_artifact", "workshop_started"],
    );
    assert.equal(new Set(projected.map((row) => row.sourceRef)).size, 1);
    assert.ok(projected.every((row) => row.messageId === "multi-message"));

    const long = [
      ...Array.from({ length: 10 }, (_, index) => `CAD note ${index + 1}.`),
      "Production has started.",
      "Waiting on pearl delivery.",
    ].join(" ");
    const extracted = extractCurrentMessageOperationalFacts(long) ?? "";
    assert.match(extracted, /Production has started/i);
    assert.match(extracted, /pearl delivery/i);
  });

  it("preserves commitment ambiguity, approximation, source anchoring and business days", () => {
    const commitment = (wording: string, day = 10) =>
      normalizeCommitment(event("commitment", wording, day), "CAD")!;
    assert.equal(commitment("I should have it tomorrow.").date, "2026-09-11");
    for (const wording of [
      "Expected ~10 business days.",
      "Expected approximately 10 business days.",
      "Expected roughly 10 business days.",
      "Expected 10 +/- business days.",
    ])
      assert.equal(commitment(wording).precision, "approximate");
    assert.equal(commitment("Delivery by 10/20.").date, "2026-10-20");
    assert.equal(commitment("Delivery by 2026-10-20.").date, "2026-10-20");
    assert.equal(
      classifySourceCommunication({
        actor: "vendor_shop",
        direction: "inbound",
        subject: null,
        authorOwnedText: "Delivery by 2026-10-20.",
      }),
      "vendor_promises",
    );
    const ambiguous = commitment("Delivery by 10/20 or 10/25; date not confirmed.");
    assert.equal(ambiguous.date, null);
    assert.equal(ambiguous.precision, "unresolved");
    assert.equal(commitment("Expected 1 business day.", 11).date, "2026-09-14");
    assert.equal(commitment("Expected 2 business days.", 11).date, "2026-09-15");
  });
});
