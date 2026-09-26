import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { reduceWorkLoop } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { projectThreadAssociationTrust } from "./admit";
import { projectBook } from "./project";
import { presentProjectBook } from "./present";
import { projectBookRecordsFromSourceEvents } from "./records";
import type { ProjectBookSourceRecord } from "./types";

const NOW = "2026-09-23T16:00:00.000Z";
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const VENDOR_HASH = hashEmail("niurka@vlorajewelry.com")!;

function record(overrides: Partial<ProjectBookSourceRecord> & Pick<ProjectBookSourceRecord, "sourceRef" | "timestamp">): ProjectBookSourceRecord {
  return {
    sourceType: "gmail",
    actor: "client",
    direction: "inbound",
    semanticClass: "client_requests",
    subject: null,
    authorOwnedText: "",
    attachmentFilenames: [],
    personLabel: null,
    projectId: PROJECT,
    association: "exact",
    plausibleProjectIds: [PROJECT],
    cadIds: [],
    provenance: "indexed_gmail",
    ...overrides,
  };
}

function book(records: ProjectBookSourceRecord[], projectId = PROJECT) {
  return projectBook({
    projectId,
    projectLabel: "Dagger ring",
    records,
    nowIso: NOW,
  });
}

function holders(records: ProjectBookSourceRecord[], projectId = PROJECT) {
  const reduced = reduceWorkLoop({
    evidence: [],
    sourceEvents: records
      .filter((row) => row.association === "exact" && row.projectId === projectId)
      .map((row) => ({
        sourceType: "gmail" as const,
        sourceRef: row.sourceRef,
        messageId: null,
        threadId: null,
        timestamp: row.timestamp,
        direction: row.direction ?? "unknown",
        actor: row.actor,
        subject: row.subject,
        authorOwnedText: row.authorOwnedText,
        quotedText: "",
        attachmentFilenames: row.attachmentFilenames,
        hasAttachments: row.attachmentFilenames.length > 0,
        cadIds: row.cadIds,
        orderIds: [],
        productionJobIds: [],
        personLabel: row.personLabel,
        projectId: row.projectId,
        workLoopId: `project:${projectId}`,
        semanticClass: row.semanticClass ?? "unknown_communication",
        provenance: "indexed_gmail" as const,
      })),
  });
  return {
    reduced,
    unresolved: book(records, projectId).unresolved.map((row) => row.holder).sort(),
  };
}

describe("Project Book projection", () => {
  it("places a client request before later founder fulfillment", () => {
    const result = book([
      record({
        sourceRef: "fulfill",
        timestamp: "2026-09-19T15:00:00.000Z",
        actor: "founder",
        direction: "outbound",
        semanticClass: "founder_fulfills_commitment",
        authorOwnedText: "Headed to you!!",
      }),
      record({
        sourceRef: "ask",
        timestamp: "2026-09-18T15:00:00.000Z",
        semanticClass: "client_requests",
        authorOwnedText: "Can you revise the band to 2mm?",
      }),
    ]);
    assert.deepEqual(
      result.milestones.map((row) => row.semanticClass),
      ["client_requests", "founder_fulfills_commitment"],
    );
    assert.deepEqual(
      result.evidenceTimeline.map((row) => row.sourceRefs[0]),
      ["ask", "fulfill"],
    );
    assert.ok(result.milestones[0]!.timestamp < result.milestones[1]!.timestamp);
  });

  it("keeps client approval as a milestone with evidence", () => {
    const result = book([
      record({
        sourceRef: "gc1|thread|approve",
        timestamp: "2026-09-18T15:00:00.000Z",
        semanticClass: "client_approves",
        authorOwnedText: "I love the latest direction and want to move forward.",
        subject: "Re: CAD revision",
      }),
    ]);
    assert.equal(result.milestones[0]?.label, "Client approved");
    assert.equal(result.milestones[0]?.summary, "Client approved the design");
    assert.doesNotMatch(result.milestones[0]?.summary ?? "", /move forward/);
    assert.equal(result.milestones[0]?.evidence[0]?.channel, "Gmail");
    assert.equal(result.milestones[0]?.evidence[0]?.classification, "client_approves");
    assert.doesNotMatch(result.milestones[0]?.summary ?? "", /^Re:/);
    const view = JSON.stringify(presentProjectBook(result));
    assert.doesNotMatch(view, /gc1\|/);
  });

  it("treats a vendor promise as waiting-on-shop evidence", () => {
    const rows = [
      record({
        sourceRef: "promise",
        timestamp: "2026-09-17T15:00:00.000Z",
        actor: "vendor_shop",
        semanticClass: "vendor_promises",
        authorOwnedText: "I'll update the size, place the order, and send the order confirmation.",
      }),
    ];
    const result = book(rows);
    assert.equal(result.milestones[0]?.label, "Shop promise");
    assert.equal(result.currentState.headline, "Waiting on shop");
    assert.deepEqual(result.unresolved.map((row) => row.holder), ["vendor_shop"]);
    const compared = holders(rows);
    assert.equal(compared.reduced.vendorOpen, true);
    assert.deepEqual(compared.unresolved, ["vendor_shop"]);
  });

  it("represents CAD and STL attachment metadata without storing media", () => {
    const result = book([
      record({
        sourceRef: "cad",
        timestamp: "2026-09-21T18:13:04.000Z",
        actor: "vendor_shop",
        semanticClass: "vendor_delivers_artifact",
        subject: "RE: HGD x Dylon D.-C025610",
        authorOwnedText: "RE: HGD x Dylon D.-C025610",
        attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.jpg", "NL-H017-Dylon D-C025610-Mod4.stl"],
      }),
    ]);
    assert.deepEqual(result.milestones[0]?.attachmentLabels, ["CAD", "STL"]);
    assert.match(result.milestones[0]?.summary ?? "", /CAD and STL/i);
    assert.deepEqual(result.milestones[0]?.evidence[0]?.attachmentNames, [
      "NL-H017-Dylon D-C025610-Mod4.jpg",
      "NL-H017-Dylon D-C025610-Mod4.stl",
    ]);
  });

  it("does not duplicate quoted email history into the timeline", () => {
    const result = book([
      record({
        sourceRef: "own",
        timestamp: "2026-09-18T15:00:00.000Z",
        semanticClass: "client_requests",
        authorOwnedText:
          "Please revise the CAD to a 2mm band.\n\nOn Mon, Sep 1, 2026 at 1:00 PM Shop wrote:\nCan you send the earlier version from last year?",
      }),
      record({
        sourceRef: "quoted-only",
        timestamp: "2026-09-19T15:00:00.000Z",
        semanticClass: "client_requests",
        authorOwnedText: "On Mon, Sep 1, 2026 at 1:00 PM Shop wrote:\nCan you send the earlier version from last year?",
      }),
    ]);
    const rendered = JSON.stringify(result);
    assert.equal(rendered.includes("earlier version from last year"), false);
    assert.equal(result.milestones.length, 1);
    assert.equal(result.milestones[0]?.summary, "Client requested an update");
    assert.equal(result.evidenceTimeline.length, 1);
  });

  it("does not promote Thanks into a milestone", () => {
    const result = book([
      record({
        sourceRef: "thanks",
        timestamp: "2026-09-18T15:00:00.000Z",
        semanticClass: "client_replies_nonblocking",
        authorOwnedText: "Thanks!",
        subject: "Thanks!",
      }),
    ]);
    assert.equal(result.milestones.length, 0);
    assert.equal(result.evidenceTimeline[0]?.summary, "Client reply");
    assert.equal(result.evidenceTimeline[0]?.excerpt, null);
  });

  it("excludes an unrelated Gmail event", () => {
    const result = book([
      record({
        sourceRef: "other",
        timestamp: "2026-09-18T15:00:00.000Z",
        projectId: OTHER,
        association: "exact",
        plausibleProjectIds: [OTHER],
        semanticClass: "client_requests",
        authorOwnedText: "Please revise the unrelated ring.",
      }),
    ]);
    assert.equal(result.evidenceTimeline.length, 0);
    assert.equal(result.associationReview, null);
    assert.equal(result.currentState.headline, "No history yet");
  });

  it("does not silently accept an ambiguous project association", () => {
    const result = book([
      record({
        sourceRef: "safe",
        timestamp: "2026-09-17T15:00:00.000Z",
        semanticClass: "client_requests",
        authorOwnedText: "Can you revise the band to 2mm?",
        cadIds: ["C026176"],
      }),
      record({
        sourceRef: "maybe",
        timestamp: "2026-09-18T15:00:00.000Z",
        projectId: null,
        association: "ambiguous",
        plausibleProjectIds: [PROJECT, OTHER],
        semanticClass: "client_approves",
        authorOwnedText: "I love the latest direction and want to move forward.",
        subject: "Sarah",
        personLabel: "Sarah",
        cadIds: ["C026176"],
      }),
    ]);
    assert.equal(result.evidenceTimeline.some((row) => row.sourceRefs[0] === "maybe"), false);
    assert.equal(result.associationReview?.status, "needs_review");
    assert.match(result.associationReview?.summary ?? "", /needs review/i);
    assert.doesNotMatch(JSON.stringify(result.milestones), /Definitely belongs/);
  });

  it("leaves subject-only and name-only evidence unassigned", () => {
    const result = book([
      record({
        sourceRef: "subject",
        timestamp: "2026-09-18T15:00:00.000Z",
        projectId: null,
        association: "unassigned",
        plausibleProjectIds: [],
        subject: "RE: HGD x Sarah-C026143",
        personLabel: "Sarah",
        authorOwnedText: "RE: HGD x Sarah-C026143",
        semanticClass: "vendor_acknowledges",
        cadIds: [],
      }),
    ]);
    assert.equal(result.evidenceTimeline.length, 0);
    assert.equal(result.associationReview, null);
  });

  it("matches unresolved holders to the existing reducer", () => {
    const rows = [
      record({
        sourceRef: "delivery",
        timestamp: "2026-09-21T18:00:00.000Z",
        actor: "vendor_shop",
        semanticClass: "vendor_delivers_artifact",
        subject: "RE: HGD x Dylon D.-C025610",
        authorOwnedText: "RE: HGD x Dylon D.-C025610",
        attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
      }),
    ];
    const compared = holders(rows);
    assert.equal(compared.reduced.semanticClass, "founder_review");
    assert.equal(compared.reduced.founderOpen, true);
    assert.deepEqual(compared.unresolved, ["founder"]);
    assert.equal(book(rows).currentState.semanticClass, compared.reduced.semanticClass);
    assert.equal(book(rows).currentState.nextCheckpoint?.basis, "work_loop");
  });

  it("orders history deterministically and drops duplicate source events", () => {
    const rows = [
      record({
        sourceRef: "b",
        timestamp: "2026-09-19T15:00:00.000Z",
        semanticClass: "client_approves",
        authorOwnedText: "I love the latest direction and want to move forward.",
      }),
      record({
        sourceRef: "a",
        timestamp: "2026-09-18T15:00:00.000Z",
        authorOwnedText: "Can you revise the band to 2mm?",
      }),
      record({
        sourceRef: "a",
        timestamp: "2026-09-18T15:00:00.000Z",
        authorOwnedText: "Can you revise the band to 2mm?",
      }),
    ];
    const first = book(rows);
    const second = book([...rows].reverse());
    assert.deepEqual(
      first.evidenceTimeline.map((row) => row.sourceRefs[0]),
      ["a", "b"],
    );
    assert.equal(first.evidenceTimeline.length, 2);
    assert.deepEqual(
      second.evidenceTimeline.map((row) => row.sourceRefs[0]),
      first.evidenceTimeline.map((row) => row.sourceRefs[0]),
    );
  });

  it("accepts a future source type without inventing events", () => {
    const result = book([
      record({
        sourceRef: "sms-1",
        sourceType: "sms",
        timestamp: "2026-09-18T15:00:00.000Z",
        semanticClass: "client_requests",
        authorOwnedText: "Can you revise the band to 2mm?",
        provenance: "sms",
      }),
    ]);
    assert.equal(result.evidenceTimeline[0]?.sourceType, "sms");
    assert.deepEqual(result.sourceCoverage.represented, ["sms"]);
    assert.equal(result.sourceCoverage.future.includes("calendar"), true);
    assert.equal(result.sourceCoverage.represented.includes("calendar"), false);
  });

  it("handles a project with no history", () => {
    const result = book([]);
    const view = presentProjectBook(result);
    assert.equal(view.empty, true);
    assert.equal(view.currentState.headline, "No history yet");
    assert.deepEqual(view.unresolved, []);
    assert.deepEqual(view.representedLabels, []);
    assert.ok(view.futureLabels.includes("SMS"));
    assert.ok(view.futureLabels.includes("Calendar"));
  });

  it("projects a few thousand events without a model", () => {
    const records = Array.from({ length: 2000 }, (_, index) =>
      record({
        sourceRef: `row-${index}`,
        timestamp: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 60_000).toISOString(),
        semanticClass: index % 17 === 0 ? "client_requests" : "client_replies_nonblocking",
        authorOwnedText: index % 17 === 0 ? `Please revise item ${index} today.` : "Thanks!",
      }),
    );
    const started = performance.now();
    const result = book(records);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 500, `projection took ${elapsed.toFixed(1)}ms`);
    assert.equal(result.evidenceTimeline.length, 200);
    assert.ok(result.evidenceOmittedCount > 0);
    assert.ok(result.milestones.length > 0);
  });
});

function gmailBook(
  label: string,
  threadId: string,
  thread: TodayGmailThreadContext,
  people: { personId: string; displayName: string; roles?: string[]; emailHash: string }[] = [],
) {
  const events = projectGmailSourceEvents({
    threadContext: new Map([[threadId, thread]]),
    founderEmailHashes: new Set([FOUNDER_HASH]),
    knownPeople: [
      {
        personId: "vendor",
        displayName: "Niurka",
        roles: ["vendor-contact"],
        emailHash: VENDOR_HASH,
      },
      ...people,
    ],
    projectIdByThread: new Map([[threadId, PROJECT]]),
  });
  return projectBook({
    projectId: PROJECT,
    projectLabel: label,
    records: projectBookRecordsFromSourceEvents(events),
    nowIso: NOW,
  });
}

describe("Project Book representative sequences", () => {
  it("Dylon CAD/STL delivery is founder review", () => {
    const result = gmailBook("Dylon", "dylon", {
      subject: "RE: HGD x Dylon D.-C025610",
      messages: [
        {
          messageId: "del",
          sentAt: "2026-09-21T18:13:04.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          hasAttachments: true,
          attachmentFilenames: [
            "NL-H017-Dylon D-C025610-Mod4.jpg",
            "NL-H017-Dylon D-C025610-Mod4.stl",
          ],
        },
      ],
    });
    assert.equal(result.currentState.headline, "Founder review");
    assert.equal(result.unresolved[0]?.holder, "founder");
    assert.equal(result.milestones[0]?.semanticClass, "vendor_delivers_artifact");
  });

  it("F. Grant order confirmation is founder review", () => {
    const result = gmailBook("F. Grant", "grant", {
      subject: "RE: HGD x F.Grant-C025885-SP13477",
      messages: [
        {
          messageId: "order",
          sentAt: "2026-09-20T15:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          subject: "RE: HGD x F.Grant-C025885-SP13477",
          hasAttachments: true,
        },
      ],
    });
    assert.equal(result.milestones[0]?.semanticClass, "vendor_order_confirmation");
    assert.equal(result.currentState.headline, "Founder review");
  });

  it("Duane CAD delivery is founder review", () => {
    const result = gmailBook("Duane", "duane", {
      subject: "RE: HGD x Duane-C026350",
      messages: [
        {
          messageId: "cad",
          sentAt: "2026-09-22T15:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          hasAttachments: true,
          attachmentFilenames: ["NL-H017-Duane-C026350.jpg"],
        },
      ],
    });
    assert.equal(result.milestones[0]?.semanticClass, "vendor_delivers_artifact");
    assert.equal(result.currentState.headline, "Founder review");
  });

  it("Sarah acknowledgement stays waiting on shop and is not a milestone", () => {
    const result = gmailBook("Sarah", "sarah", {
      subject: "RE: HGD x Sarah-C026143",
      messages: [
        {
          messageId: "ask",
          sentAt: "2026-09-22T16:00:00.000Z",
          direction: "outbound",
          fromEmailHash: FOUNDER_HASH,
          hasAttachments: true,
          subject: "RE: HGD x Sarah-C026143",
        },
        {
          messageId: "thanks",
          sentAt: "2026-09-22T22:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          plaintext: "Thank you so much!",
          hasAttachments: true,
        },
      ],
    });
    assert.equal(result.currentState.headline, "Waiting on shop");
    assert.equal(result.milestones.some((row) => row.semanticClass === "vendor_acknowledges"), false);
    assert.ok(result.evidenceTimeline.some((row) => row.summary === "Shop acknowledgement"));
  });

  it("Nathan approval then founder STL request waits on the shop", () => {
    const clientHash = hashEmail("nathan@client.test")!;
    const result = gmailBook(
      "Nathan",
      "nathan",
      {
        subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
        fromDisplayName: "Nathan",
        messages: [
          {
            messageId: "approve",
            sentAt: "2026-09-22T19:18:25.000Z",
            direction: "inbound",
            fromEmailHash: clientHash,
            plaintext: "I love the latest direction and want to move forward.",
          },
          {
            messageId: "stl",
            sentAt: "2026-09-22T21:02:28.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
            hasAttachments: true,
            subject: "Re: HGD x Nate P. (Dagger Ring)-C026176",
          },
        ],
      },
      [{ personId: "nathan", displayName: "Nathan", emailHash: clientHash }],
    );
    assert.deepEqual(
      result.milestones.map((row) => row.semanticClass),
      ["client_approves", "founder_requests_vendor"],
    );
    assert.equal(result.currentState.headline, "Waiting on shop");
  });

  it("Tim/Jenn workshop start waits on the shop", () => {
    const result = gmailBook("Tim/Jenn", "tim", {
      subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
      messages: [
        {
          messageId: "rn",
          sentAt: "2026-09-17T15:00:00.000Z",
          direction: "inbound",
          fromEmailHash: VENDOR_HASH,
          subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
          hasAttachments: true,
          attachmentFilenames: ["NL-H017-Tim-C025964.jpg"],
        },
      ],
    });
    assert.equal(result.milestones[0]?.semanticClass, "workshop_started");
    assert.equal(result.currentState.headline, "Waiting on shop");
  });

  it("Madi founder CAD send waits on the client", () => {
    const result = gmailBook("Madi", "madi", {
      subject: "RE: HGD x Madi-C026000",
      messages: [
        {
          messageId: "cad",
          sentAt: "2026-09-20T15:00:00.000Z",
          direction: "outbound",
          fromEmailHash: FOUNDER_HASH,
          plaintext: "Here's the latest CAD — let me know what you think.",
          subject: "RE: HGD x Madi-C026000",
        },
      ],
    });
    assert.equal(result.milestones[0]?.semanticClass, "founder_updates_client");
    assert.equal(result.currentState.headline, "Waiting on client");
  });

  it("Abbey founder fulfillment has no open obligation", () => {
    const result = gmailBook("Abbey", "abbey", {
      subject: "Re: A new piece",
      messages: [
        {
          messageId: "ship",
          sentAt: "2026-09-22T15:00:00.000Z",
          direction: "outbound",
          fromEmailHash: FOUNDER_HASH,
          plaintext: "Headed to you!!",
          hasAttachments: true,
        },
      ],
    });
    assert.equal(result.milestones[0]?.semanticClass, "founder_fulfills_commitment");
    assert.equal(result.currentState.headline, "No open obligation");
    assert.deepEqual(result.unresolved, []);
  });
});

const DEBRIS =
  "Lab Grown Diamonds with diamond_supply_notes Lab Grown Diamonds with cad_job_number finger_size 19fd370bc47c5e1f gc1|thread|msg";
const REPEATED = `${DEBRIS} ${DEBRIS}`;

describe("Project Book production rejection fixtures", () => {
  it("drops quoted debris, field keys, hex ids, and duplicate fulfillment", () => {
    const result = book([
      record({
        sourceRef: "dump-a",
        timestamp: "2026-08-06T15:00:00.000Z",
        actor: "founder",
        direction: "outbound",
        semanticClass: "founder_fulfills_commitment",
        authorOwnedText: REPEATED,
        subject: "Re: HGD- J.Pennock-C025519",
        attachmentFilenames: ["image001.jpg", "image002.png"],
      }),
      record({
        sourceRef: "dump-b",
        timestamp: "2026-08-20T15:00:00.000Z",
        actor: "founder",
        direction: "outbound",
        semanticClass: "founder_fulfills_commitment",
        authorOwnedText: `On Thu, Aug 6, 2026 at 1:00 PM Shop wrote:\n${DEBRIS}`,
        attachmentFilenames: ["image001.jpg"],
      }),
    ]);
    const rendered = JSON.stringify(presentProjectBook(result));
    assert.equal(result.milestones.length, 0);
    assert.equal(result.evidenceTimeline.length, 0);
    assert.doesNotMatch(rendered, /diamond_supply_notes|cad_job_number|finger_size|19fd370bc47c5e1f|gc1\||image001\.jpg|On Thu/);
  });

  it("keeps a meaningful CAD name and hides inline image noise", () => {
    const result = book([
      record({
        sourceRef: "cad-file",
        timestamp: "2026-09-21T18:13:04.000Z",
        actor: "vendor_shop",
        semanticClass: "vendor_delivers_artifact",
        subject: "RE: HGD x Dylon D.-C025610",
        authorOwnedText: `${DEBRIS}\nRE: HGD x Dylon D.-C025610`,
        attachmentFilenames: ["image001.jpg", "NL-H017-Dylon D-C025610-Mod4.stl"],
        cadIds: ["C025610"],
      }),
    ]);
    const rendered = JSON.stringify(result);
    assert.equal(result.milestones.length, 1);
    assert.match(result.milestones[0]?.summary ?? "", /CAD and STL received/);
    assert.equal(rendered.includes("image001.jpg"), false);
    assert.match(rendered, /NL-H017-Dylon D-C025610-Mod4\.stl/);
    assert.doesNotMatch(rendered, /diamond_supply_notes|19fd370bc47c5e1f|gc1\|/);
  });

  it("withholds an ambiguous stored thread from trusted history", () => {
    const result = projectBook({
      projectId: PROJECT,
      projectLabel: "C023939",
      nowIso: NOW,
      associationTrusted: false,
      records: [
        record({
          sourceRef: "nick",
          timestamp: "2026-06-10T15:00:00.000Z",
          semanticClass: "client_replies_nonblocking",
          subject: "RE: HGD - Nick-C023939-RN07781",
          authorOwnedText: "Please review this CAD.",
        }),
      ],
    });
    const rendered = JSON.stringify(result);
    assert.equal(result.historyState, "needs_review");
    assert.equal(result.currentState.headline, "Insufficient project history");
    assert.equal(result.evidenceTimeline.length, 0);
    assert.equal(result.milestones.length, 0);
    assert.match(result.associationReview?.summary ?? "", /not confirmed/i);
    assert.doesNotMatch(rendered, /Please review this CAD|Nick-C023939/);
    assert.equal(
      projectThreadAssociationTrust({
        matchJudgment: "ambiguous",
        noteTexts: ["Multiple Nicholas clients exist. Do not guess identity."],
      }),
      "needs_review",
    );
    assert.equal(projectThreadAssociationTrust({ matchJudgment: "exact" }), "trusted");
  });

  it("does not promote subject-only or filename-only evidence, and keeps candidate evidence in review", () => {
    const filename = book([
      record({
        sourceRef: "file-only",
        timestamp: "2026-09-18T15:00:00.000Z",
        projectId: null,
        association: "unassigned",
        plausibleProjectIds: [],
        subject: null,
        authorOwnedText: "",
        attachmentFilenames: ["NL-H017-Dylon D-C025610.jpg"],
        semanticClass: "vendor_delivers_artifact",
      }),
    ]);
    assert.equal(filename.historyState, "none");
    assert.equal(filename.evidenceTimeline.length, 0);
    assert.equal(filename.currentState.headline, "No history yet");

    const subjectOnly = book([
      record({
        sourceRef: "subject-only",
        timestamp: "2026-09-18T15:00:00.000Z",
        projectId: null,
        association: "unassigned",
        plausibleProjectIds: [],
        subject: "RE: HGD x F.Grant-C025885-SP13477",
        authorOwnedText: "RE: HGD x F.Grant-C025885-SP13477",
        semanticClass: "vendor_order_confirmation",
      }),
    ]);
    assert.equal(subjectOnly.historyState, "none");
    assert.equal(subjectOnly.evidenceTimeline.length, 0);

    const candidate = book([
      record({
        sourceRef: "maybe-thread",
        timestamp: "2026-09-18T15:00:00.000Z",
        association: "candidate",
        semanticClass: "vendor_delivers_artifact",
        authorOwnedText: "CAD attached.",
        attachmentFilenames: ["NL-H017-Duane-C026350.jpg"],
      }),
    ]);
    assert.equal(candidate.historyState, "needs_review");
    assert.equal(candidate.evidenceTimeline.length, 0);
    assert.match(candidate.associationReview?.summary ?? "", /not confirmed/i);
    assert.doesNotMatch(JSON.stringify(candidate), /CAD attached/);
  });

  it("still renders an exact trusted thread from the reducer", () => {
    const rows = [
      record({
        sourceRef: "delivery",
        timestamp: "2026-09-21T18:00:00.000Z",
        actor: "vendor_shop",
        semanticClass: "vendor_delivers_artifact",
        subject: "RE: HGD x Dylon D.-C025610",
        authorOwnedText: "RE: HGD x Dylon D.-C025610",
        attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
        cadIds: ["C025610"],
      }),
    ];
    const result = book(rows);
    assert.equal(result.historyState, "trusted");
    assert.equal(result.currentState.headline, "Founder review");
    assert.equal(result.currentState.semanticClass, "founder_review");
    assert.equal(result.unresolved[0]?.holder, "founder");
    assert.equal(result.milestones[0]?.summary, "CAD and STL received.");
  });
});

describe("Project Book boundaries", () => {
  it("does not call a model or write during render", () => {
    const projector = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "project.ts"), "utf8");
    const admit = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "admit.ts"), "utf8");
    const loader = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "load.ts"), "utf8");
    const page = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/projects/[projectId]/page.tsx"),
      "utf8",
    );
    const combined = `${projector}\n${admit}\n${loader}\n${page}`;
    assert.doesNotMatch(combined, /openai|gpt-|generateText|concierge-sol|responses\.create/i);
    assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(|gmail\.googleapis|users\.messages/);
    assert.doesNotMatch(projector, /from "@\/lib\/continuum\/calendar|loadTodaySurface|composeTodayDocket/);
    assert.match(page, /loadProjectBook/);
    assert.doesNotMatch(page, /loadTodaySurface/);
  });
});
