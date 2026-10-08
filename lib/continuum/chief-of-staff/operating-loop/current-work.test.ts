import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reduceWorkLoop } from "./work-loop-state";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { finalizeTodayDocket } from "./today-docket-boundary";
import { classifySourceCommunication } from "@/lib/continuum/source-events/classify";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { COS_LOOP_PROJECT_A, fixtureProjects, fixtureJob } from "./fixtures";
import {
  proposeFounderOperation,
  correctionNote,
  correctionEventsFromNotes,
} from "@/lib/continuum/concierge-sol/founder-command";
import { normalizeCommitment } from "./current-work";
import { projectTodaySnapshot } from "@/lib/continuum/today-snapshot";

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
    subject: "HGD x Duane-C026350",
    authorOwnedText: wording,
    quotedText: "",
    attachmentFilenames: [],
    hasAttachments: false,
    cadIds: ["C026350"],
    orderIds: [],
    productionJobIds: [],
    personLabel: "Duane",
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
function project(events: SourceCommunicationEvent[]) {
  return reduceWorkLoop({ evidence: [], sourceEvents: events }).projection!;
}
function docket(
  events: SourceCommunicationEvent[],
  now = "2026-09-29T16:00:00Z",
  duplicate = false,
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    projects: fixtureProjects(),
    candidates: [],
    founderCorrections: duplicate ? [...events, ...events] : events,
    nowIso: now,
  });
  const result = composeTodayDocket(loop);
  return {
    result,
    packets: [
      ...result.items.map((i) => i.briefingPacket),
      ...result.watching.map((i) => i.briefingPacket),
    ].filter((p) => p?.projection),
  };
}
function both(
  events: SourceCommunicationEvent[],
  stage: string,
  dependency?: string,
) {
  const p = project(events);
  assert.equal(p.stage, stage);
  if (dependency) assert.equal(p.dependency, dependency);
  const d = docket(events);
  assert.equal(d.packets.length, stage === "complete" ? 0 : 1);
  if (stage !== "complete") assert.deepEqual(d.packets[0]!.projection, p);
  return p;
}
describe("Phase 2 current truth through reducer and final docket", () => {
  it("newer vendor handoff removes the older phase-review Job but preserves a distinct client dependency", () => {
    const phaseJob = fixtureJob({
      jobId: "phase-review",
      subject: "In-person stone review",
      updatedAt: "2026-09-19T16:00:00Z",
    });
    const loop = composeCosOperatingLoop({
      jobs: [phaseJob],
      projects: fixtureProjects(),
      candidates: [],
      founderCorrections: [
        event("vendor-handoff", "This center is headed to you.", 20, "founder", {
          semanticClass: "founder_requests_vendor",
        }),
        event("engraving", "I'll get the engraving idea finalized and over tonight.", 21, "client", {
          semanticClass: "client_promises",
        }),
      ],
      nowIso: "2026-09-22T16:00:00Z",
    });
    const today = finalizeTodayDocket(loop);
    const hay = JSON.stringify(today);
    assert.doesNotMatch(hay, /in-person stone review/i);
    assert.match(hay, /engraving idea/i);
    assert.deepEqual(loop.supersededActionJobIds, [phaseJob.jobId]);
  });

  it("does not create an external dependency from a bare promise verb", () => {
    const result = reduceWorkLoop({ evidence: [], sourceEvents: [
      event("bare-promise", "I will send", 29, "client", {
        semanticClass: "client_promises",
      }),
    ] });
    assert.equal(result.projection, undefined);
  });

  it("Shannon: a newer package arrival supersedes the prior founder send obligation", () => {
    const projection = project([
      event("promise", "I'll send chain video, options, and pricing.", 10, "founder", {
        personLabel: "Shannon Hruza",
        semanticClass: "founder_fulfills_commitment",
      }),
      event("arrival", "The relevant package arrived today.", 11, "client", {
        personLabel: "Shannon Hruza",
        semanticClass: "material_arrives",
      }),
    ]);
    assert.equal(projection.ballHolder, "unknown");
    assert.equal(projection.dependency, null);
    assert.equal(projection.activeObligations.length, 0);
    assert.ok(projection.historicalObligations.some((row) => /chain video/i.test(row.deliverable)));
  });

  it("Abbey: later founder vendor follow-up wins and repeated client copy is collapsed", () => {
    const projection = project([
      event("request", "Can you send me a rendering Can you send me a rendering Can you send me a rendering", 10, "client", {
        personLabel: "Abbey",
        semanticClass: "client_requests",
      }),
      event("follow-up", "Checking on the revised rendering.", 11, "founder", {
        personLabel: "Abbey",
        semanticClass: "founder_requests_vendor",
      }),
    ]);
    assert.equal(projection.ballHolder, "vendor_shop");
    assert.equal(projection.dependency, "revised CAD");
    assert.equal(projection.activeObligations.length, 1);
    assert.doesNotMatch(JSON.stringify(projection), /rendering Can you send me a rendering/i);
  });

  it("Christopher: year-old source-only fragments cannot re-enter current work", () => {
    const stale = event("old", "Can you send the old December and January details?", 10, "client", {
      timestamp: "2025-12-10T16:00:00Z",
      personLabel: "Christopher Kotwicki",
      projectId: null,
      workLoopId: "thread:christopher-old",
      threadId: "christopher-old",
      sourceRef: "gc1|christopher-old|old",
      semanticClass: "client_requests",
      workIdentityBasis: "candidate_message",
    });
    const loop = composeCosOperatingLoop({
      jobs: [],
      projects: new Map(),
      candidates: [],
      founderCorrections: [stale],
      nowIso: "2026-10-06T16:00:00Z",
    });
    const final = finalizeTodayDocket(loop);
    assert.equal(final.upNext.some((row) => /Christopher|December|January/i.test(`${row.subject} ${row.headline}`)), false);
    assert.equal(final.watching.some((row) => /Christopher|December|January/i.test(`${row.title} ${row.detail}`)), false);
  });
  it("canonical production supersedes an older approval/place-order projection", () => {
    const projection = reduceWorkLoop({
      evidence: [],
      sourceEvents: [event("approve", "Approved. Please place the order.", 12, "client")],
      lifecycle: "production",
      projectId: COS_LOOP_PROJECT_A,
    }).projection!;
    assert.equal(projection.stage, "in_production");
    assert.equal(projection.ballHolder, "vendor_shop");
    assert.equal(projection.dependency, "production completion");
    assert.ok(projection.historicalObligations.some((row) => row.deliverable === "place order"));
    assert.equal(projection.provenance.at(-1)?.origin, "canonical_project_lifecycle");
  });

  it("canonical production supersedes a stale client finger-size wait", () => {
    const projection = reduceWorkLoop({
      evidence: [],
      sourceEvents: [event("size", "Waiting for the client's finger size.", 12, "founder", {
        semanticClass: "founder_updates_client",
      })],
      lifecycle: "in_production",
      projectId: COS_LOOP_PROJECT_A,
    }).projection!;
    assert.equal(projection.stage, "in_production");
    assert.equal(projection.ballHolder, "vendor_shop");
    assert.equal(projection.dependency, "production completion");
  });

  it("a later founder correction remains authoritative over canonical lifecycle", () => {
    const projection = reduceWorkLoop({
      evidence: [],
      sourceEvents: [event("hold", "Put this on the backburner.", 12, "founder", {
        semanticClass: "founder_correction",
        provenance: "founder_correction",
        correction: { stage: "waiting_external", ballHolder: "client", dependency: "ring size" },
      })],
      lifecycle: "production",
      projectId: COS_LOOP_PROJECT_A,
    }).projection!;
    assert.equal(projection.stage, "waiting_external");
    assert.equal(projection.ballHolder, "client");
    assert.equal(projection.dependency, "ring size");
    assert.equal(projection.provenance.at(-1)?.origin, "founder_correction");
  });

  it("A clean Duane special-order confirmation advances directly to production; stale CAD review closes", () => {
    const events = [
      event("request", "Please send the CAD.", 10, "founder"),
      event("cad", "CAD attached.", 11),
      event("approve", "Approved.", 12, "client"),
      event("order", "Order confirmation SP13530 attached.", 13),
    ];
    const confirmed = both(events, "in_production", "production completion");
    assert.equal(confirmed.ballHolder, "vendor_shop");
    const p = both(
      [...events, event("production", "Production has started.", 14)],
      "in_production",
      "vendor production",
    );
    assert.ok(p.historicalObligations.some((o) => /CAD/.test(o.deliverable)));
    assert.equal(p.activeObligations.length, 1);
  });

  it("Duane precedence: canonical production suppresses an earlier confirmation-discrepancy founder action", () => {
    const reduced = reduceWorkLoop({
      evidence: [],
      sourceEvents: [
        event(
          "confirmation-review",
          "Order confirmation SP13530: please review discrepancy.",
          10,
        ),
        event("production-start", "Production has started.", 11),
      ],
      lifecycle: "production",
      projectId: COS_LOOP_PROJECT_A,
    });
    assert.equal(reduced.projection?.stage, "in_production");
    assert.equal(reduced.projection?.ballHolder, "vendor_shop");
    assert.equal(reduced.projection?.dependency, "production completion");
    assert.equal(
      reduced.projection?.activeObligations.some(
        (obligation) => obligation.kind === "confirmation",
      ),
      false,
    );
  });

  it("Nate: later send and client acknowledgement permanently close the older founder promise", () => {
    const projection = project([
      event("promise", "I'll send over the pic of the pendant size tomorrow.", 25, "founder", {
        personLabel: "Nate",
        cadIds: ["C026176"],
        semanticClass: "founder_fulfills_commitment",
      }),
      event("sent", "Here are the pendant-size visuals.", 29, "founder", {
        personLabel: "Nate",
        cadIds: ["C026176"],
        semanticClass: "founder_fulfills_commitment",
        hasAttachments: true,
        attachmentFilenames: ["pendant-size.jpg"],
      }),
      event("ack", "Sounds great. Thanks!", 30, "client", {
        timestamp: "2026-10-05T21:37:08Z",
        personLabel: "Nate",
        cadIds: ["C026176"],
        semanticClass: "client_replies_nonblocking",
      }),
    ]);
    assert.equal(projection.ballHolder, "unknown");
    assert.equal(projection.dependency, null);
    assert.equal(projection.activeObligations.length, 0);
    assert.ok(projection.historicalObligations.some((row) => /pendant/i.test(row.deliverable)));
  });

  it("a later client acknowledgement alone can close a same-scope founder promise when the send event was not indexed", () => {
    const projection = project([
      event("promise", "I'll send the pendant-size picture tomorrow.", 25, "founder", {
        cadIds: ["C026176"],
        semanticClass: "founder_fulfills_commitment",
      }),
      event("ack", "Sounds great. Thanks!", 30, "client", {
        timestamp: "2026-10-05T21:37:08Z",
        cadIds: ["C026176"],
        semanticClass: "client_replies_nonblocking",
      }),
    ]);
    assert.equal(projection.ballHolder, "unknown");
    assert.equal(projection.activeObligations.length, 0);
  });

  it("Nate precedence: a closed mixed-CAD founder promise cannot be resurrected by replayed lower-authority text", () => {
    const promise = event(
      "promise",
      "I'll send the pendant-size picture tomorrow.",
      25,
      "founder",
      {
        cadIds: ["C017492", "C026176"],
        semanticClass: "founder_fulfills_commitment",
      },
    );
    const acknowledgement = event(
      "ack",
      "Sounds great. Thanks!",
      26,
      "client",
      {
        cadIds: ["C026176"],
        semanticClass: "client_replies_nonblocking",
      },
    );
    const replayed = event(
      "quoted-replay",
      "I'll send the pendant-size picture tomorrow.",
      27,
      "founder",
      {
        cadIds: ["C026176"],
        semanticClass: "founder_fulfills_commitment",
      },
    );
    const projection = project([promise, acknowledgement, replayed]);
    assert.equal(projection.ballHolder, "unknown");
    assert.equal(projection.dependency, null);
    assert.equal(projection.activeObligations.length, 0);
    assert.match(
      projection.provenance.at(-1)?.reason ?? "",
      /cannot reopen without explicit new intent/i,
    );
  });

  it("acceptance lifecycle and ownership records resolve from newest material evidence", () => {
    const abbey = project([
      event("old-client-ask", "Can you send me a rendering?", 20, "client", {
        cadIds: ["C026137"], semanticClass: "client_requests",
      }),
      event("mod2", "Updated CAD Mod 2 attached.", 21, "vendor_shop", {
        timestamp: "2026-10-06T19:20:02Z", cadIds: ["C026137"],
        semanticClass: "vendor_delivers_artifact", attachmentFilenames: ["Abbey-C026137-Mod2.jpg"], hasAttachments: true,
      }),
    ]);
    assert.equal(abbey.stage, "cad_review");
    assert.equal(abbey.ballHolder, "founder");
    assert.equal(abbey.dependency, "CAD review");

    const audrey = project([
      event("revisions", "Please make these revisions.", 22, "founder", {
        timestamp: "2026-10-07T12:16:43Z", cadIds: ["C026401"], semanticClass: "founder_requests_vendor",
      }),
    ]);
    assert.equal(audrey.ballHolder, "vendor_shop");
    assert.equal(audrey.stage, "revision_requested");

    for (const [cad, order] of [["C025610", "SP13591"], ["C025885", "SP13477"], ["C026350", "SP13530"]]) {
      const production = project([
        event("cad", "CAD attached.", 20, "vendor_shop", { cadIds: [cad], semanticClass: "vendor_delivers_artifact" }),
        event("order", `Order confirmation ${order} attached.`, 21, "vendor_shop", {
          cadIds: [cad], orderIds: [order], semanticClass: "vendor_order_confirmation",
        }),
      ]);
      assert.equal(production.stage, "in_production");
      assert.equal(production.ballHolder, "vendor_shop");
      assert.equal(production.dependency, "production completion");
    }

    for (const cad of ["C025519", "C025964"]) {
      const production = project([
        event("shop", "Production has started; delivery is expected by end of next week.", 22, "vendor_shop", {
          cadIds: [cad], semanticClass: "workshop_started",
        }),
      ]);
      assert.equal(production.stage, "in_production");
      assert.equal(production.ballHolder, "vendor_shop");
    }

    const madi = project([
      event("follow-up", "Here's the latest CAD — let me know what you think.", 22, "founder", {
        timestamp: "2026-10-02T16:00:00Z", cadIds: ["C026000"], semanticClass: "founder_updates_client",
      }),
    ]);
    assert.equal(madi.ballHolder, "client");
    assert.equal(madi.dependency, "client reply");

    const sarah = project([
      event("request", "Please revise the STL.", 20, "founder", {
        cadIds: ["C026143"], semanticClass: "founder_requests_vendor",
      }),
      event("mod7", "STL Mod 7 attached.", 21, "vendor_shop", {
        timestamp: "2026-10-05T15:45:22Z", cadIds: ["C026143"], semanticClass: "vendor_delivers_artifact",
        attachmentFilenames: ["Sarah-C026143-Mod7.stl"], hasAttachments: true,
      }),
      event("receipt", "Thanks, received.", 22, "founder", {
        timestamp: "2026-10-05T16:57:44Z", cadIds: ["C026143"], semanticClass: "unknown_communication",
      }),
    ]);
    assert.equal(sarah.stage, "cad_review");
    assert.equal(sarah.ballHolder, "founder");
    assert.equal(sarah.dependency, "STL review");

    const sarahReceiptRecovery = project([
      event("request", "Please send the revised STL.", 20, "founder", {
        cadIds: ["C026143"], semanticClass: "founder_requests_vendor",
      }),
      event("vendor-ack", "I sent it over.", 21, "vendor_shop", {
        cadIds: ["C026143"], semanticClass: "vendor_acknowledges",
      }),
      event("receipt", "Thanks, received.", 22, "founder", {
        cadIds: ["C026143"], semanticClass: "unknown_communication",
      }),
    ]);
    assert.equal(sarahReceiptRecovery.stage, "cad_review");
    assert.equal(sarahReceiptRecovery.ballHolder, "founder");
    assert.equal(sarahReceiptRecovery.dependency, "STL review");

    const ben = project([
      event("cad", "CAD attached for your review.", 14, "vendor_shop", {
        cadIds: ["C026156"], semanticClass: "vendor_delivers_artifact",
      }),
      event("hold", "Hold until I release it.", 15, "founder", {
        timestamp: "2026-10-05T11:34:22Z", cadIds: ["C026156"], semanticClass: "founder_correction",
        provenance: "founder_correction", correction: { stage: "cad_review", ballHolder: "unknown", dependency: "held until the founder releases the hold" },
      }),
    ]);
    assert.equal(ben.ballHolder, "unknown");
    assert.match(ben.dependency ?? "", /held/i);

    const overdueCad = project([
      event("cad", "CAD attached for founder review.", 14, "vendor_shop", {
        cadIds: ["C026999"], semanticClass: "vendor_delivers_artifact",
      }),
    ]);
    assert.equal(overdueCad.ballHolder, "founder");
    assert.equal(overdueCad.dependency, "CAD review");
  });
  it("B Sarah flooding tomorrow is anchored to source, independent of viewing date", () => {
    const events = [
      event("request", "Please revise the CAD.", 10, "founder"),
      event(
        "promise",
        "Flooding caused a delay. I should have it tomorrow.",
        11,
      ),
    ];
    const p = both(events, "revision_requested", "revised CAD");
    assert.equal(p.commitment?.date, "2026-09-12");
    assert.deepEqual(
      docket(events, "2026-10-01T16:00:00Z").packets[0]?.projection,
      docket(events, "2027-02-01T16:00:00Z").packets[0]?.projection,
    );
  });
  it("C Tim/Jenn workshop receipt retains final CAD approximate lead time", () => {
    const p = both(
      [
        event(
          "workshop",
          "Stone received at workshop RN08318. Final CAD expected approximately 10 +/- business days.",
          10,
        ),
      ],
      "waiting_external",
      "final CAD",
    );
    assert.equal(p.commitment?.precision, "approximate");
    assert.equal(p.commitment?.date, "2026-09-24");
    assert.match(p.provenance[0].wording, /RN08318/);
  });
  it("D Nate STL delivered then pearl replaces the old blocker", () => {
    const p = both(
      [
        event("request", "Please send the STL.", 10, "founder"),
        event("stl", "STL attached. Waiting on pearl delivery.", 11),
      ],
      "waiting_external",
      "pearl delivery",
    );
    assert.equal(p.activeObligations.length, 1);
    assert.equal(p.historicalObligations[0].status, "satisfied");
  });
  it("same-CAD founder fulfillment attachment closes an older shop wait and a later request reopens it", () => {
    const request = event("request", "Please revise the CAD.", 16, "founder");
    const fulfillment = event("client-update", "Sent the updated CAD to the client.", 22, "founder", {
      threadId: "client-thread",
      sourceRef: "gc1|client-thread|client-update",
      semanticClass: "founder_fulfills_commitment",
      hasAttachments: true,
      attachmentFilenames: ["image0.jpeg"],
      workIdentityBasis: "cad",
    });
    const closed = project([request, fulfillment]);
    assert.equal(closed.activeObligations.length, 0);
    assert.equal(closed.ballHolder, "unknown");
    assert.equal(closed.historicalObligations[0]?.status, "satisfied");

    const reopened = project([
      request,
      fulfillment,
      event("new-request", "Please revise the CAD.", 23, "founder"),
    ]);
    assert.equal(reopened.ballHolder, "vendor_shop");
    assert.equal(reopened.stage, "revision_requested");
    assert.equal(reopened.activeObligations.length, 1);
  });
  it("E marketing admits no work", () => {
    const rows = [
      event("marketing", "Growth Support for Independent Jewelers", 10),
    ];
    assert.equal(project(rows), undefined);
    assert.equal(docket(rows).packets.length, 0);
  });
  it("F repeated revisions close old cycles; wrong revision cannot satisfy latest", () => {
    const rows = [
      event("r1", "Please revise CAD Mod 1.", 10, "founder"),
      event("d1", "CAD Mod 1 attached.", 11),
      event("r2", "Please revise CAD Mod 2.", 12, "founder"),
      event("d2", "CAD Mod 2 attached.", 13),
    ];
    const p = both(rows, "cad_review");
    assert.equal(p.activeObligations.length, 1);
    assert.equal(p.historicalObligations.length, 3);
    const pending = project([
      ...rows.slice(0, 3),
      event("wrong", "CAD Mod 1 attached.", 14),
    ]);
    assert.equal(pending.stage, "revision_requested");
  });
  it("G final merge and duplicate wrappers preserve newer production", () => {
    const rows = [
      event("cad", "CAD attached.", 10),
      event("production", "Production has started.", 11),
    ];
    const d = docket(rows, undefined, true);
    assert.equal(d.packets.length, 1);
    assert.equal(d.packets[0]?.projection?.stage, "in_production");
  });
  it("H complete closes prior work and ignores stale later artifact; explicit service reopens", () => {
    const rows = [
      event("cad", "CAD attached.", 10),
      event("complete", "The ring has been delivered.", 11),
      event("late", "CAD attached.", 12),
    ];
    const p = both(rows, "complete");
    assert.equal(p.activeObligations.length, 0);
    assert.equal(
      project([
        ...rows,
        event("service", "Please send a new repair CAD.", 13, "founder"),
      ]).stage,
      "design_requested",
    );
  });
  it("founder delivery attachment closes the same-CAD shop obligation", () => {
    const request = event("request", "Please send the CAD.", 10, "founder");
    const deliveredToClient = event(
      "client-delivery",
      "I sent the updated CAD to the client. Attached.",
      11,
      "founder",
      {
        semanticClass: "founder_fulfills_commitment",
        attachmentFilenames: ["image0.jpeg"],
        hasAttachments: true,
      },
    );
    const projection = project([request, deliveredToClient]);
    assert.equal(projection.activeObligations.length, 0);
    assert.equal(projection.historicalObligations.at(-1)?.status, "satisfied");
    assert.equal(projection.historicalObligations.at(-1)?.deliverable, "CAD");

    const unrelatedTextOnlyFulfillment = project([
      request,
      event("text-only", "I emailed the client.", 11, "founder", {
        semanticClass: "founder_fulfills_commitment",
      }),
    ]);
    assert.equal(unrelatedTextOnlyFulfillment.activeObligations.length, 1);
  });
  it("an attachment alone cannot close a newer CAD review without explicit fulfillment evidence", () => {
    const projection = project([
      event("mod2", "Updated CAD Mod 2 attached.", 20, "vendor_shop", {
        cadIds: ["C026137"],
        semanticClass: "vendor_delivers_artifact",
        hasAttachments: true,
        attachmentFilenames: ["C026137-Mod2.jpg"],
      }),
      event("outbound-attachment", "", 21, "founder", {
        cadIds: ["C026137"],
        semanticClass: "founder_fulfills_commitment",
        hasAttachments: true,
        attachmentFilenames: ["C026137-Mod2.jpg"],
      }),
    ]);
    assert.equal(projection.stage, "cad_review");
    assert.equal(projection.ballHolder, "founder");
    assert.equal(projection.dependency, "CAD review");
  });
  it("I replay, equal timestamps and missing timestamps remain deterministic", () => {
    const rows = [
      event("a", "Please send the CAD.", 10, "founder"),
      event("b", "CAD attached.", 10),
      event("c", "Production has started.", 11),
      event("missing", "Please revise CAD.", 12, "founder", { timestamp: "" }),
    ];
    const expected = project(rows);
    for (const reordered of [
      [...rows].reverse(),
      [rows[2], rows[0], rows[3], rows[1], rows[0]],
    ]) {
      assert.deepEqual(project(reordered), expected);
      assert.deepEqual(docket(reordered).packets[0]?.projection, expected);
    }
  });
  it("separate production stage and discrepancy responsibility", () => {
    const p = both(
      [
        event(
          "confirm",
          "Order confirmation SP13530: please review discrepancy.",
          10,
        ),
        event("start", "Production has started.", 11),
      ],
      "in_production",
      "confirmation discrepancy review",
    );
    assert.equal(p.ballHolder, "founder");
    assert.equal(p.activeObligations.length, 2);
  });
  it("founder corrections enter the same chronology and later delivery can supersede them", () => {
    for (const wording of [
      "Flora is in manufacturing.",
      "Ben C is waiting on him to reply, not in a hurry — I need to get his finger size.",
    ]) {
      const op = proposeFounderOperation(wording)!;
      assert.equal(op.kind, "correct");
      if (op.kind !== "correct") return;
      const corrections = correctionEventsFromNotes(COS_LOOP_PROJECT_A, [
        {
          id: "manual",
          personId: null,
          personName: null,
          contextLayer: "client",
          sourceSystem: "concierge-manual",
          sourceArtifact: "concierge",
          sourceSheet: "manual-note",
          sourceField: "note",
          noteText: correctionNote(op),
          createdAt: "2026-09-12T16:00:00Z",
        },
      ]);
      const p = both(
        [event("cad", "CAD attached.", 10), ...corrections],
        wording.startsWith("Flora") ? "in_production" : "cad_review",
      );
      assert.equal(
        p.ballHolder,
        wording.startsWith("Flora") ? "vendor_shop" : "client",
      );
      assert.equal(p.commitment, null);
      assert.equal(p.provenance.at(-1)?.origin, "founder_correction");
      if (wording.startsWith("Ben"))
        assert.equal(p.dependency, "client reply / finger size");

      const newerGmail = both(
        [
          event("cad", "CAD attached.", 10),
          ...corrections,
          event("newer-production", "Production has started.", 13),
        ],
        "in_production",
        "vendor production",
      );
      assert.equal(newerGmail.ballHolder, "vendor_shop");
      assert.equal(
        newerGmail.provenance.at(-1)?.origin,
        "indexed_gmail+live_operational_fact",
      );
    }
  });
  it("a recent explicit founder correction can correct an erroneous terminal state", () => {
    const p = both([
      event("complete", "The ring has been delivered.", 10),
      event("correction", "Flora is in manufacturing.", 11, "founder", { semanticClass: "founder_correction", provenance: "founder_correction", correction: { stage: "in_production", ballHolder: "vendor_shop", dependency: "vendor production" } }),
    ], "in_production", "vendor production");
    assert.equal(p.provenance.at(-1)?.origin, "founder_correction");
  });
  it("deferred open and snoozed jobs vanish from final counts, return at expiry", () => {
    for (const state of ["open", "snoozed"] as const) {
      const job = fixtureJob({
        jobId: "job-ben",
        subject: "Get finger size",
        state,
        deferredUntil: "2026-09-13T16:00:00Z",
      });
      const run = (nowIso: string) =>
        composeTodayDocket(
          composeCosOperatingLoop({
            jobs: [job],
            projects: fixtureProjects(),
            nowIso,
          }),
        );
      assert.equal(run("2026-09-12T16:00:00Z").items.length, 0);
      assert.equal(run("2026-09-12T16:00:00Z").queuedCount, 0);
      assert.equal(run("2026-09-13T16:00:00Z").items.length, 1);
    }
  });
  it("all-undated conflicts never establish a newer obligation", () => {
    const rows = [
      event("unknown-cad", "CAD attached.", 10, "vendor_shop", {
        timestamp: "",
      }),
      event("unknown-request", "Please revise CAD.", 11, "founder", {
        timestamp: "",
      }),
    ];
    const p = project(rows);
    assert.equal(p.ballHolder, "unknown");
    assert.equal(p.activeObligations.length, 0);
    assert.deepEqual(project([...rows].reverse()), p);
  });
  it("Eliah precedence: a terminal founder disposition survives mixed project associations and older CAD evidence", () => {
    const correction = event(
      "terminal",
      "This work is dead and closed.",
      15,
      "founder",
      {
        timestamp: "2026-10-05T16:27:23Z",
        projectId: null,
        workLoopId: "cad:C026130",
        cadIds: ["C026130"],
        semanticClass: "founder_correction",
        provenance: "founder_correction",
        correction: { stage: "complete", ballHolder: "unknown", dependency: null },
      },
    );
    const rows = [
      event("older-cad", "CAD attached.", 10, "vendor_shop", {
        projectId: "project-a",
        workLoopId: "cad:C026130",
        cadIds: ["C026130"],
      }),
      event("contaminated-cad", "CAD attached.", 11, "vendor_shop", {
        projectId: "project-b",
        workLoopId: "cad:C026130",
        cadIds: ["C026130"],
      }),
      correction,
    ];
    const projection = project(rows);
    assert.equal(projection.stage, "complete");
    assert.equal(projection.ballHolder, "unknown");
    assert.equal(projection.activeObligations.length, 0);
    assert.equal(projection.provenance.at(-1)?.origin, "founder_correction");
  });

  it("enforces founder directive > lifecycle > newer email > older evidence", () => {
    const terminal = event("terminal", "This work is dead and closed.", 12, "founder", {
      semanticClass: "founder_correction",
      provenance: "founder_correction",
      correction: { stage: "complete", ballHolder: "unknown", dependency: null },
    });
    const founderWins = reduceWorkLoop({
      evidence: [],
      sourceEvents: [event("old-cad", "CAD attached.", 10), terminal],
      lifecycle: "production",
      projectId: COS_LOOP_PROJECT_A,
    }).projection!;
    assert.equal(founderWins.stage, "complete");

    const lifecycleWins = reduceWorkLoop({
      evidence: [],
      sourceEvents: [
        event("old-request", "Please send the CAD.", 10, "founder"),
        event("newer-cad", "CAD attached.", 13),
      ],
      lifecycle: "production",
      projectId: COS_LOOP_PROJECT_A,
    }).projection!;
    assert.equal(lifecycleWins.stage, "in_production");
    assert.equal(lifecycleWins.ballHolder, "vendor_shop");

    const newerEmailWins = project([
      event("older-candidate", "CAD attached.", 10, "vendor_shop", {
        provenance: "indexed_gmail+interpretation",
      }),
      event("newer-email", "Production has started.", 13, "vendor_shop", {
        provenance: "indexed_gmail+live_operational_fact",
      }),
    ]);
    assert.equal(newerEmailWins.stage, "in_production");
    assert.equal(newerEmailWins.ballHolder, "vendor_shop");
  });
  it("partial artifacts and mismatched projects cannot close unrelated work", () => {
    const rows = [
      event("stl-request", "Please send the STL.", 10, "founder"),
      event("cad-only", "CAD attached.", 11),
    ];
    assert.equal(project(rows).dependency, "STL");
    assert.equal(
      project([
        event("cad-request", "Please send the CAD.", 10, "founder"),
        event("stl-only", "STL attached.", 11),
      ]).dependency,
      "CAD",
    );
    assert.equal(project(rows).historicalObligations.length, 0);
    assert.equal(project([event("request-a", "Please send the CAD.", 10, "founder"), event("delivery-b", "CAD attached.", 11, "vendor_shop", { cadIds: ["C099999"] })]).stage, "design_requested");
    assert.equal(
      project([rows[0], { ...rows[1], projectId: "different-project" }]),
      undefined,
    );
  });
  it("final merge prefers source chronology over an old founder-review wrapper", () => {
    const input = {
      jobs: [],
      projects: fixtureProjects(),
      nowIso: "2026-09-29T16:00:00Z",
    };
    const old = composeCosOperatingLoop({
      ...input,
      founderCorrections: [event("old-review", "CAD attached.", 10)],
    });
    const newer = composeCosOperatingLoop({
      ...input,
      founderCorrections: [
        event("new-production", "Production has started.", 11),
      ],
    });
    const result = composeTodayDocket({
      ...newer,
      brief: [...old.brief, ...newer.brief],
      watching: [...old.watching, ...newer.watching],
    });
    assert.equal(result.items.length, 0);
    assert.equal(result.watching.length, 1);
    assert.equal(
      result.watching[0].briefingPacket?.projection?.stage,
      "in_production",
    );
    assert.equal(result.watching[0].briefingPacket?.sourceEvents?.length, 2);
  });
  it("repeated reconstruction is deterministic for identical canonical inputs", () => {
    const rows = [
      event("request", "Please send the CAD.", 10, "founder"),
      event("cad", "CAD attached.", 11),
      event("production", "Production has started.", 12),
      event("duplicate-production", "Production has started.", 12),
    ];
    const render = (sourceEvents: SourceCommunicationEvent[]) => {
      const loop = composeCosOperatingLoop({
        jobs: [],
        projects: fixtureProjects(),
        founderCorrections: sourceEvents,
        nowIso: "2026-10-07T16:00:00Z",
        newMutationId: () => "deterministic-replay",
      });
      const result = composeTodayDocket(loop);
      return [...result.items, ...result.watching]
        .map((item) => ({
          id: item.id,
          holder: item.briefingPacket?.ballHolder ?? null,
          stage: item.briefingPacket?.projection?.stage ?? null,
          dependency: item.briefingPacket?.projection?.dependency ?? null,
          actionable: result.items.some((row) => row.id === item.id),
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
    };
    const first = render(rows);
    const second = render(rows);
    const reordered = render([...rows].reverse());
    assert.deepEqual(second, first);
    assert.deepEqual(reordered, first);
  });
  it("produces byte-identical snapshot payloads without injected mutation ids", () => {
    const input = {
      jobs: [fixtureJob({
        jobId: "11111111-1111-4111-8111-111111111111",
        subject: "Review appointment preparation",
        createdMutationId: "22222222-2222-4222-8222-222222222222",
        updatedAt: "2026-10-07T16:00:00Z",
      })],
      projects: fixtureProjects(),
      nowIso: "2026-10-07T16:00:00Z",
    };
    const render = () => {
      const loop = composeCosOperatingLoop(input);
      return projectTodaySnapshot(
        composeTodayDocket(loop),
        loop.attentionValidUntil ?? null,
      );
    };
    assert.deepEqual(render(), render());
  });
  it("counts independent obligations beyond the old top-five cutoff", () => {
    const jobs = Array.from({ length: 8 }, (_, i) =>
      fixtureJob({
        jobId: "independent-" + i,
        subject: "Call vendor about order " + i,
      }),
    );
    const result = composeTodayDocket(
      composeCosOperatingLoop({
        jobs,
        projects: fixtureProjects(),
        nowIso: "2026-09-29T16:00:00Z",
      }),
    );
    assert.equal(result.items.length, 3);
    assert.equal(result.queuedCount, 5);
  });
  it("never presents internal production-acceptance Jobs as founder work", () => {
    const result = composeTodayDocket(
      composeCosOperatingLoop({
        jobs: [fixtureJob({
          jobId: "internal-acceptance",
          sourceRef: "continuum:sterling-production-acceptance:20261003152525",
          subject: "Internal acceptance work",
        })],
        projects: fixtureProjects(),
        nowIso: "2026-10-05T16:00:00Z",
      }),
    );
    assert.equal(result.items.length, 0);
    assert.equal(result.watching.length, 0);
  });
  it("commitment dates, ranges, missing timestamps and replacements", () => {
    assert.equal(
      normalizeCommitment(event("date", "Delivery by 10/20.", 10), "CAD")?.date,
      "2026-10-20",
    );
    assert.equal(
      normalizeCommitment(
        event("unknown", "I should have it tomorrow.", 10, "vendor_shop", {
          timestamp: "",
        }),
        "CAD",
      )?.date,
      null,
    );
    assert.deepEqual(
      normalizeCommitment(
        event("range", "Final CAD expected 5-10 business days.", 10),
        "final CAD",
      )?.window,
      { start: "2026-09-17", end: "2026-09-24" },
    );
    const rows = [
      event("promise1", "I should have it tomorrow.", 10),
      event("promise2", "Delivery by 10/20.", 11),
    ];
    assert.equal(project(rows).commitment?.sourceRef, rows[1].sourceRef);
    assert.equal(
      project([...rows, event("delivery", "CAD attached.", 12)]).commitment,
      null,
    );
  });
});
