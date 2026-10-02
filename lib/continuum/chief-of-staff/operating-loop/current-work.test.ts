import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reduceWorkLoop } from "./work-loop-state";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { classifySourceCommunication } from "@/lib/continuum/source-events/classify";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";
import { COS_LOOP_PROJECT_A, fixtureProjects, fixtureJob } from "./fixtures";
import {
  proposeFounderOperation,
  correctionNote,
  correctionEventsFromNotes,
} from "@/lib/continuum/concierge-sol/founder-command";
import { normalizeCommitment } from "./current-work";

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
  it("A Duane order confirmed until explicit production; stale CAD review closes", () => {
    const events = [
      event("request", "Please send the CAD.", 10, "founder"),
      event("cad", "CAD attached.", 11),
      event("approve", "Approved.", 12, "client"),
      event("order", "Order confirmation SP13530 attached.", 13),
    ];
    both(events, "order_confirmed");
    const p = both(
      [...events, event("production", "Production has started.", 14)],
      "in_production",
      "vendor production",
    );
    assert.ok(p.historicalObligations.some((o) => /CAD/.test(o.deliverable)));
    assert.equal(p.activeObligations.length, 1);
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
      "I'll send those. Attached.",
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
