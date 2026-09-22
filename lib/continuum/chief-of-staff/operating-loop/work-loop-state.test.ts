import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import { reduceWorkLoop } from "./work-loop-state";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-21T18:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;
const CAD_A = "C025610";
const CAD_B = "C026143";
const CAD_C = "C026176";
const CAD_D = "C025885";
const CAD_E = "C026137";
const THREAD_A = "19fed961d1371aaf";
const THREAD_B_CLIENT = "1b026143client01";
const THREAD_B_VENDOR = "1b026143vendor01";
const THREAD_C = "1a09120d797337d9";
const THREAD_D_CLIENT = "1a03a3004b69ec27";
const THREAD_D_VENDOR = "1a03a300vendor001";
const THREAD_E = "1a026137printchk1";
const THREAD_F_CLIENT = "1a0madi0client001";

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function beat(
  speaker: "founder" | "client" | "vendor" | "system",
  at: string,
  summary: string,
) {
  return {
    at,
    label: speaker,
    summary,
    speaker,
    sourceHref: null,
    candidateId: `${speaker}-${at}`,
  };
}

function todayOf(
  candidates: ContinuumCandidate[],
  threadContext: Map<string, TodayGmailThreadContext>,
  projects?: Map<string, CosProjectContext>,
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: projects ?? new Map(),
    nowIso: NOW,
    threadContext,
    knownPeople: [
      {
        personId: "niurka-vendor-contact",
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"] as const,
        organizationName: "Vlora",
        emailHash: NIURKA_HASH,
      },
    ],
    vendorDirectory: ["vlora"],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function hay(docket: ReturnType<typeof composeTodayDocket>): string {
  return [
    ...docket.items.map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`),
    ...docket.watching.map((row) => `${row.title} ${row.detail}`),
  ].join("\n");
}

describe("work-loop state reducer", () => {
  it("newer vendor CAD promise beats an older founder request", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("founder", "2026-09-17T15:00:00.000Z", "Please send the updated CAD and STL."),
        beat(
          "vendor",
          "2026-09-18T15:00:00.000Z",
          "I'll send you the updated Cad and STL file as soon as it's available.",
        ),
      ],
      remaining: {
        matchedText: "Review the latest shop turn.",
        headline: "Review the latest shop turn.",
        explanation: "Review the latest shop turn.",
        recommended: "Review the latest shop turn.",
      },
      communication: "vendor",
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
    assert.equal(reduced.briefingKind, "vendor_cad_wait");
  });

  it("older client turn cannot override a later unresolved vendor CAD dependency", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("client", "2026-09-16T14:00:00.000Z", "I like the updated gallery. What do you think we should do next?"),
        beat("founder", "2026-09-16T17:40:00.000Z", "Please soften the double-prong change."),
        beat("vendor", "2026-09-16T18:20:00.000Z", "I'll send you the updated CAD as soon as it's available."),
      ],
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
  });

  it("vendor CAD/pricing work stays vendor_shop while the promise is unresolved", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("founder", "2026-09-18T12:00:00.000Z", "Can you send platinum-bead pricing and the current CAD changes?"),
        beat("vendor", "2026-09-18T16:00:00.000Z", "I'll send you the updated CAD as soon as it's available."),
      ],
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
  });

  it("latest founder production instruction to the shop is vendor_shop, not client", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("client", "2026-09-10T12:00:00.000Z", "What do you think about platinum?"),
        beat(
          "founder",
          "2026-09-18T12:00:00.000Z",
          "Moving forward with all three bands, size 6.25, all platinum, all lab.",
        ),
      ],
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "vendor_shop");
  });

  it("vendor CAD/STL delivery returns the loop to founder", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("founder", "2026-09-17T15:00:00.000Z", "Please send the updated CAD and STL."),
        beat("vendor", "2026-09-21T18:13:00.000Z", "Here is the C025610 Mod 4 CAD + STL."),
      ],
      communication: "vendor",
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
    assert.equal(reduced.authoritative, true);
  });

  it("later founder client chat does not turn undelivered-to-client CAD into a client wait", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("client", "2026-09-21T14:00:00.000Z", "Looking forward to the CAD breakdown."),
        beat("vendor", "2026-09-21T18:35:00.000Z", "Here is the C026176 Mod 1 CAD."),
        beat("founder", "2026-09-21T18:37:00.000Z", "I'll order the chain separately. Let me know what you think."),
      ],
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.notEqual(reduced.ballHolder, "client");
  });

  it("vendor communication without jewelry shop evidence is not vendor_shop", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("system", "2026-09-21T16:00:00.000Z", "Your ad account has an update ready to review."),
      ],
      communication: "platform",
      noFounderAction: true,
    });
    assert.notEqual(reduced.ballHolder, "vendor_shop");
  });

  it("fulfilled vendor STL plus open print/check is founder", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("vendor", "2026-09-15T18:00:00.000Z", "Here is the C026137 Mod 1 STL."),
        beat(
          "founder",
          "2026-09-15T18:30:00.000Z",
          "I'll print the model to check the huggie proportions before moving forward.",
        ),
      ],
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.briefingKind, "founder_print_check");
  });

  it("client wait remains only when the current unresolved dependency is client feedback", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("founder", "2026-09-12T12:00:00.000Z", "I'll circle back next week."),
        beat("founder", "2026-09-19T12:00:00.000Z", "Let me know what you think of the latest direction."),
      ],
      waitingState: "client",
    });
    assert.equal(reduced.ballHolder, "client");
  });

  it("current remaining founder work beats a same-thread production instruction", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat(
          "founder",
          "2026-09-03T15:00:00.000Z",
          "Moving forward with Mod 1; sending the family sapphire.",
        ),
      ],
      remaining: {
        matchedText: "Moving forward with Mod 1; sending the family sapphire.",
        headline: "Send the family sapphire",
        explanation: "Send the family sapphire",
        recommended: "Send the family sapphire",
      },
    });
    assert.equal(reduced.ballHolder, "founder");
  });

  it("a vendor ask for a founder answer is founder, not a shop wait", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("vendor", "2026-09-16T18:20:00.000Z", "Can you confirm the prong count before we proceed?"),
      ],
      remaining: {
        matchedText: "Can you confirm the prong count before we proceed?",
        headline: "Can you confirm the prong count",
        explanation: "Can you confirm the prong count",
        recommended: "Confirm the prong count",
      },
      communication: "vendor",
      noFounderAction: true,
    });
    assert.equal(reduced.ballHolder, "founder");
  });
});

describe("current evidence replaces a previously-valid founder action", () => {
  it("older founder instruction remaining cannot override later CAD/STL delivery", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("founder", "2026-09-10T15:00:00.000Z", "Please make the shank width 2.0mm."),
        beat("vendor", "2026-09-21T18:13:00.000Z", "Here is the C025610 Mod 4 CAD + STL."),
      ],
      remaining: {
        matchedText: "Please make the shank width 2.0mm.",
        headline: "Please make the shank width 2.0mm.",
        explanation: "Please make the shank width 2.0mm.",
        recommended: "Please make the shank width 2.0mm.",
      },
      communication: "vendor",
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.equal(reduced.semanticClass, "founder_review");
  });

  it("print/check is satisfied when models are printed and a new shipping address arrives", () => {
    const reduced = reduceWorkLoop({
      evidence: [
        beat("vendor", "2026-09-15T18:00:00.000Z", "Here is the C026137 Mod 1 STL."),
        beat(
          "founder",
          "2026-09-15T18:30:00.000Z",
          "I'll print the model to check the huggie proportions before moving forward.",
        ),
        beat(
          "founder",
          "2026-09-21T15:00:00.000Z",
          "The models are already printed. Dry/cure next. I expect to mail them next day.",
        ),
        beat("client", "2026-09-21T18:00:00.000Z", "Please use this new shipping address."),
      ],
    });
    assert.equal(reduced.ballHolder, "founder");
    assert.notEqual(reduced.briefingKind, "founder_print_check");
    assert.equal(reduced.semanticClass, "founder_communication");
  });
});


describe("Today work-loop compose fixtures", () => {
  it("CAD A is Watching / vendor_shop after a newer shop CAD/STL promise", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "cad-a-ask",
          sourceRef: `gc1|${THREAD_A}|cad-a-ask`,
          sourceTimestamp: "2026-09-17T15:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Please send the updated CAD and STL.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Please send the updated CAD and STL.",
          },
        }),
        gmailRow({
          candidateId: "cad-a-promise",
          sourceRef: `gc1|${THREAD_A}|cad-a-promise`,
          sourceTimestamp: "2026-09-18T15:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "Updated CAD forthcoming",
            detail: `I'll send you the updated Cad and STL file as soon as it's available. ${CAD_A}`,
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll send you the updated Cad and STL file as soon as it's available.",
          },
        }),
      ],
      new Map([
        [
          THREAD_A,
          {
            subject: `RE: HGD x Jordan-${CAD_A}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "cad-a-ask",
                sentAt: "2026-09-17T15:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "cad-a-promise",
                sentAt: "2026-09-18T15:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const watching = docket.watching.find((row) => new RegExp(CAD_A, "i").test(row.title));
    const up = docket.items.filter((item) => new RegExp(CAD_A, "i").test(`${item.subject} ${item.headline}`));
    assert.equal(up.length, 0);
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(watching.briefing?.stateChip, "WAITING ON SHOP");
    assert.match(watching.title, new RegExp(CAD_A, "i"));
    assert.doesNotMatch(watching.title, /^Vlora$/i);
    assert.doesNotMatch(hay(docket), /Review the latest shop turn|this work|Gmail evidence/i);
  });

  it("CAD B groups client + vendor threads as one Watching vendor_shop card", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "cad-b-client",
          sourceRef: `gc1|${THREAD_B_CLIENT}|cad-b-client`,
          sourceTimestamp: "2026-09-16T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "design reply",
            detail: `I like the updated gallery. Lab Grown diamonds with ${CAD_B}`,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: `Lab Grown diamonds with ${CAD_B}`,
          },
        }),
        gmailRow({
          candidateId: "cad-b-out",
          sourceRef: `gc1|${THREAD_B_VENDOR}|cad-b-out`,
          sourceTimestamp: "2026-09-16T17:40:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Please soften the double-prong change.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Please soften the double-prong change.",
          },
        }),
        gmailRow({
          candidateId: "cad-b-cad",
          sourceRef: `gc1|${THREAD_B_VENDOR}|cad-b-cad`,
          sourceTimestamp: "2026-09-16T18:20:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "Updated CAD forthcoming",
            detail: null,
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll send you the updated CAD as soon as it's available.",
          },
        }),
      ],
      new Map([
        [
          THREAD_B_CLIENT,
          {
            subject: "RE: HGD x Morgan CAD",
            fromDisplayName: "Morgan",
            fromEmail: "riley-b@example.test",
            messages: [
              { messageId: "cad-b-client", sentAt: "2026-09-16T14:00:00.000Z", direction: "inbound" },
            ],
          },
        ],
        [
          THREAD_B_VENDOR,
          {
            subject: `RE: HGD x Morgan-${CAD_B}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "cad-b-out",
                sentAt: "2026-09-16T17:40:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "cad-b-cad",
                sentAt: "2026-09-16T18:20:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const watching = docket.watching.filter((row) => /Morgan|C026143/i.test(row.title));
    const up = docket.items.filter((item) => /Morgan|C026143/i.test(`${item.subject} ${item.headline}`));
    assert.equal(up.length, 0);
    assert.equal(watching.length, 1);
    assert.equal(watching[0]?.briefingPacket?.ballHolder, "vendor_shop");
    assert.doesNotMatch(hay(docket), /Lab Grown diamonds with\.|Sarah has the next turn|WAITING ON CLIENT/i);
  });

  it("CAD C stays Watching vendor_shop while vendor CAD work is outstanding", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "cad-c-ask",
          sourceRef: `gc1|${THREAD_C}|cad-c-ask`,
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Can you send platinum-bead pricing and the current changes?",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Can you send platinum-bead pricing and the current changes?",
          },
        }),
        gmailRow({
          candidateId: "cad-c-promise",
          sourceRef: `gc1|${THREAD_C}|cad-c-promise`,
          sourceTimestamp: "2026-09-18T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "Updated CAD forthcoming",
            detail: null,
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll send you the updated CAD as soon as it's available.",
          },
        }),
      ],
      new Map([
        [
          THREAD_C,
          {
            subject: `RE: HGD x Casey-${CAD_C}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "cad-c-ask",
                sentAt: "2026-09-18T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "cad-c-promise",
                sentAt: "2026-09-18T16:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const watching = docket.watching.find((row) => new RegExp(CAD_C, "i").test(row.title));
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.equal(docket.items.filter((item) => new RegExp(CAD_C, "i").test(item.subject)).length, 0);
  });

  it("CAD D uses latest founder→vendor instruction, not old client state or platinum fragments", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "cad-d-client",
          sourceRef: `gc1|${THREAD_D_CLIENT}|cad-d-client`,
          sourceTimestamp: "2026-09-10T12:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "platinum",
            detail: "platinum",
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: { ruleIds: ["explicit_client_request"], matchedText: "platinum" },
        }),
        gmailRow({
          candidateId: "cad-d-out",
          sourceRef: `gc1|${THREAD_D_VENDOR}|cad-d-out`,
          sourceTimestamp: "2026-09-18T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
        }),
      ],
      new Map([
        [
          THREAD_D_CLIENT,
          {
            subject: `RE: HGD x Drew-${CAD_D}`,
            fromDisplayName: "Drew",
            fromEmail: "riley-d@example.test",
            messages: [
              { messageId: "cad-d-client", sentAt: "2026-09-10T12:00:00.000Z", direction: "inbound" },
            ],
          },
        ],
        [
          THREAD_D_VENDOR,
          {
            subject: `RE: HGD x Drew-${CAD_D}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "cad-d-out",
                sentAt: "2026-09-18T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const watching = docket.watching.find((row) => new RegExp(CAD_D, "i").test(row.title));
    const up = docket.items.filter((item) => new RegExp(CAD_D, "i").test(`${item.subject} ${item.headline}`));
    assert.equal(up.length, 0);
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "vendor_shop");
    assert.doesNotMatch(hay(docket), /You already wrote\.\s*platinum/i);
  });

  it("CAD E is Up Next founder after STL delivery and an open print/check", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "cad-e-stl",
          sourceRef: `gc1|${THREAD_E}|cad-e-stl`,
          sourceTimestamp: "2026-09-15T18:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 STL attached",
            detail: `Here is the ${CAD_E} Mod 1 STL.`,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: `Here is the ${CAD_E} Mod 1 STL.`,
          },
        }),
        gmailRow({
          candidateId: "cad-e-print",
          sourceRef: `gc1|${THREAD_E}|cad-e-print`,
          sourceTimestamp: "2026-09-15T18:30:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "I'll print the model to check the huggie proportions before moving forward.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll print the model to check the huggie proportions before moving forward.",
          },
        }),
      ],
      new Map([
        [
          THREAD_E,
          {
            subject: `RE: HGD x Eden-${CAD_E}`,
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "cad-e-stl",
                sentAt: "2026-09-15T18:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: "cad-e-print",
                sentAt: "2026-09-15T18:30:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const up = docket.items.find((item) => new RegExp(CAD_E, "i").test(`${item.subject} ${item.headline}`));
    assert.ok(up);
    assert.equal(up.briefingPacket?.ballHolder, "founder");
    assert.match(up.briefing?.stateChip ?? "", /YOUR MOVE/);
    assert.doesNotMatch(
      docket.watching.map((row) => row.title).join(" "),
      new RegExp(CAD_E, "i"),
    );
  });

  it("client-feedback wait stays on client and does not quote an older circle-back fragment", () => {
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "madi-old",
          sourceRef: `gc1|${THREAD_F_CLIENT}|madi-old`,
          sourceTimestamp: "2026-09-12T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "follow_up",
            value: "I'll circle back next week.",
          },
          evidenceBasis: { ruleIds: ["explicit_follow_up"], matchedText: "I'll circle back next week." },
        }),
        gmailRow({
          candidateId: "madi-ask",
          sourceRef: `gc1|${THREAD_F_CLIENT}|madi-ask`,
          sourceTimestamp: "2026-09-19T12:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Let me know what you think of the latest direction.",
            detail: "Let me know what you think of the latest direction.",
            waitingOnActor: "client",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Let me know what you think of the latest direction.",
          },
        }),
      ],
      new Map([
        [
          THREAD_F_CLIENT,
          {
            subject: "RE: HGD x Finley-C031199",
            fromDisplayName: "Finley",
            fromEmail: "riley-f@example.test",
            messages: [
              {
                messageId: "madi-old",
                sentAt: "2026-09-12T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
              {
                messageId: "madi-ask",
                sentAt: "2026-09-19T12:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const watching = docket.watching.find((row) => /Finley|C031199/i.test(row.title));
    assert.ok(watching);
    assert.equal(watching.briefingPacket?.ballHolder, "client");
    assert.doesNotMatch(`${watching.detail} ${watching.briefing?.stand ?? ""}`, /circle back/i);
  });
});
