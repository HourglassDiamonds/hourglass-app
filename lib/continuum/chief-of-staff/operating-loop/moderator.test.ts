import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import { composeCosOperatingLoop } from "./compose";
import { selectFounderControls } from "./founder-actions";
import { gmailThreadHrefFor } from "./evidence";
import {
  COS_LOOP_NOW,
  COS_LOOP_PERSON_A,
  COS_LOOP_PROJECT_A,
  COS_LOOP_PROJECT_B,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import { composeConciergeBrief } from "./moderator";
import type { CosProjectContext } from "./types";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { confirmGmailPersonAssociation } from "@/lib/continuum/client-memory/founder-project/identity-gate";

const DIR = dirname(fileURLToPath(import.meta.url));
const PERSON_VENDOR = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_ROWE = "55555555-eeee-4eee-8eee-eeeeeeeeeeee";
const PERSON_ABBEY = "33333333-cccc-4ccc-8ccc-cccccccccccc";
const PERSON_JOSEPH = "44444444-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_VOSS = "66666666-ffff-4fff-8fff-ffffffffffff";
const PROJECT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_VOSS = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const GMAIL_THREAD = "18c9f0a1b2c3d4e5";
const GMAIL_THREAD_B = "18d0a2b3c4d5e6f7";

function productionProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_A,
      {
        projectId: COS_LOOP_PROJECT_A,
        title: "Hale band",
        personName: "Client Hale",
        people: [
          { personId: COS_LOOP_PERSON_A, displayName: "Client Hale", role: "client" },
          { personId: PERSON_VENDOR, displayName: "Mara", role: "vendor-contact" },
        ],
        isCurrent: true,
        lifecycleStage: "production",
        specs: [
          { fieldName: "finger_size", value: "12.5" },
          { fieldName: "metal", value: "Platinum" },
        ],
      },
    ],
  ]);
}

function specRow(input: {
  candidateId: string;
  fieldName: "metal" | "finger_size" | "cad_job_number" | "diamond_supply_notes";
  proposedValue: string;
  currentValue: string;
}): ContinuumCandidate {
  return row({
    candidateId: input.candidateId,
    sourceRef: `gc1|thread-${input.candidateId}|msg`,
    candidateType: "structured_spec",
    proposedTarget: {
      kind: "project_spec",
      projectId: COS_LOOP_PROJECT_A,
      fieldName: input.fieldName,
    },
    payload: {
      kind: "structured_spec",
      fieldName: input.fieldName,
      proposedValue: input.proposedValue,
      currentValue: input.currentValue,
      conflict: true,
    },
    candidateState: "conflict",
    evidenceBasis: {
      ruleIds: ["spec_conflict_review_required"],
      matchedText: input.proposedValue,
    },
  });
}

function chickenProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_A,
      {
        projectId: COS_LOOP_PROJECT_A,
        title: "Chicken ring (his) / Travis",
        personName: "Travis Morse",
        people: [
          { personId: PERSON_VENDOR, displayName: "Pamela" },
          { personId: COS_LOOP_PERSON_A, displayName: "Travis Morse", role: "client" },
        ],
        isCurrent: true,
        lifecycleStage: "production",
        specs: [
          { fieldName: "cad_job_number", value: "C010657" },
          { fieldName: "metal", value: "14K two-tone: YG rails / WG center" },
          { fieldName: "finger_size", value: "12.5" },
        ],
      },
    ],
  ]);
}

function pennockProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_A,
      {
        projectId: COS_LOOP_PROJECT_A,
        title: "J.Pennock",
        personName: "John Pennock",
        people: [
          { personId: PERSON_VENDOR, displayName: "Jocelyn", role: "client" },
          { personId: PERSON_JOSEPH, displayName: "John Pennock", role: "client" },
        ],
        isCurrent: true,
        lifecycleStage: "production",
        specs: [
          { fieldName: "cad_job_number", value: "C010657" },
          { fieldName: "diamond_supply_notes", value: "Vlora lab-grown on mounting" },
        ],
      },
    ],
  ]);
}

function vossProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      PROJECT_VOSS,
      {
        projectId: PROJECT_VOSS,
        title: "Client Voss — Engagement Ring",
        personName: "Client Voss",
        people: [{ personId: PERSON_VOSS, displayName: "Client Voss", role: "client" }],
        isCurrent: true,
        lifecycleStage: "production",
      },
    ],
  ]);
}

function abbeyProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_B,
      {
        projectId: COS_LOOP_PROJECT_B,
        title: "Matching Marquise Earrings",
        personName: "Abbey Castillo",
        people: [{ personId: PERSON_ABBEY, displayName: "Abbey Castillo", role: "client" }],
        isCurrent: true,
      },
    ],
  ]);
}

function row(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    sourceRef: extra.sourceRef ?? `gc1|${GMAIL_THREAD}|${extra.candidateId}`,
    proposedTarget: extra.proposedTarget ?? { kind: "project", projectId: COS_LOOP_PROJECT_A },
    ...extra,
  });
}

function briefOf(input: Parameters<typeof composeConciergeBrief>[0]) {
  return composeConciergeBrief(input);
}

function loopOf(input: Parameters<typeof composeCosOperatingLoop>[0]) {
  return composeCosOperatingLoop(input);
}

describe("Concierge Executive Moderator V1", () => {
  it("collapses one situation into one brief item", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "send-1",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Moving forward with Mod 1; sending the family sapphire.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Moving forward with Mod 1; sending the family sapphire.",
          },
        }),
        row({
          candidateId: "send-2",
          sourceTimestamp: "2026-09-03T16:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Please proceed with engraving once the stone is received.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Please proceed with engraving once the stone is received.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /shop status/i);
    assert.doesNotMatch(result.brief[0]?.explanation ?? "", /2 follow-ups|candidates/i);
  });

  it("changes the recommendation when later chronology includes vendor acknowledgement", () => {
    const sent = row({
      candidateId: "sent-stone",
      sourceTimestamp: "2026-09-03T15:00:00.000Z",
      candidateType: "follow_up",
      payload: {
        kind: "follow_up",
        text: "Sending the family sapphire to the shop.",
        dueAt: null,
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: "Sending the family sapphire to the shop.",
      },
    });
    const before = briefOf({
      candidates: [sent],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(before.brief.length, 1);
    assert.match(before.brief[0]?.recommended ?? "", /Confirm status with the shop/i);
    const after = briefOf({
      candidates: [
        sent,
        row({
          candidateId: "vendor-ack",
          sourceTimestamp: "2026-09-08T12:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Received the family sapphire, we'll start.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "Received the family sapphire, we'll start.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(after.brief.length, 0);
    assert.equal(after.watching.length, 1);
    assert.match(after.watching[0]?.detail ?? "", /already in production|Awaiting the shop/i);
  });

  it("lets the latest meaningful turn win over an earlier founder answer", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "founder-q",
          sourceTimestamp: "2026-09-04T12:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Which metal do you want for the band?",
            dueAt: null,
            sourceTimestamp: "2026-09-04T12:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Which metal do you want for the band?",
          },
        }),
        row({
          candidateId: "client-first",
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "yellow gold",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "yellow gold is better",
          },
        }),
        row({
          candidateId: "founder-answer",
          sourceTimestamp: "2026-09-05T18:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "I'll send the CAD tomorrow.",
            dueAt: null,
            sourceTimestamp: "2026-09-05T18:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll send the CAD tomorrow.",
          },
        }),
        row({
          candidateId: "client-again",
          sourceTimestamp: "2026-09-06T18:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "can we go platinum instead",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "can we go platinum instead",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /Your turn/i);
    assert.doesNotMatch(result.brief[0]?.explanation ?? "", /already answered/i);
  });

  it("does not treat historical evidence as current", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "old-approval",
          sourceTimestamp: "2025-11-02T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_approval",
            value: "CAD looks great",
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_approval"],
            matchedText: "CAD looks great",
          },
        }),
        row({
          candidateId: "sent-now",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /shop status/i);
    assert.doesNotMatch(result.brief[0]?.explanation ?? "", /CAD looks great|just approved/i);
    assert.equal(
      result.brief[0]?.evidence.some((beat) => /CAD looks great/i.test(beat.summary)),
      false,
    );
  });

  it("suppresses a Top 5 shop follow-up instead of repeating it in the Brief", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subject: "Follow up with the shop about the stone",
      waitingOnActor: "vendor",
    });
    const view = loopOf({
      jobs: [job],
      candidates: [
        row({
          candidateId: "sent-stone",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.brief.length, 0);
  });

  it("keeps a genuine founder commitment that is not already an Open Job", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "cad-promise",
          sourceTimestamp: "2026-09-06T18:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "I'll send the CAD tomorrow.",
            detail: "I'll send the CAD tomorrow.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll send the CAD tomorrow.",
          },
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.explanation ?? "", /not already on Top 5/i);
    assert.match(result.brief[0]?.recommended ?? "", /Add it to Top 5|Do it/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "add_to_top5"),
      true,
    );
  });

  it("surfaces a real client response as Your turn", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "ask",
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Which metal do you want for the band?",
            dueAt: null,
            sourceTimestamp: "2026-09-05T12:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_follow_up"],
            matchedText: "Which metal do you want for the band?",
          },
        }),
        row({
          candidateId: "answer",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "yellow gold marquise",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "yellow gold marquise",
          },
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /Your turn/i);
  });

  it("treats payment plus vendor production as already handled unless a deadline is useful", () => {
    const paid = row({
      candidateId: "paid",
      sourceTimestamp: "2026-09-04T12:00:00.000Z",
      evidenceBasis: {
        ruleIds: ["transactional_customer_notice"],
        matchedText: "Payment received for invoice 4412",
      },
      payload: {
        kind: "project_context",
        topic: "payment",
        value: "Payment received for invoice 4412",
      },
    });
    const vendor = row({
      candidateId: "vendor-prod",
      sourceTimestamp: "2026-09-05T12:00:00.000Z",
      candidateType: "note",
      payload: {
        kind: "note",
        text: "Received the center, we'll start production.",
        contextLayer: null,
      },
      evidenceBasis: {
        ruleIds: ["explicit_vendor_commitment"],
        matchedText: "Received the center, we'll start production.",
      },
    });
    const quiet = briefOf({
      candidates: [paid, vendor],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(quiet.brief.length, 0);
    assert.equal(quiet.watching.length, 1);
    assert.match(quiet.watching[0]?.detail ?? "", /already in production/i);
    assert.equal(
      quiet.brief.some((item) => item.actions.some((action) => action.kind === "create_project")),
      false,
    );

    const withDeadline = briefOf({
      candidates: [
        paid,
        vendor,
        row({
          candidateId: "travel",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          candidateType: "date",
          payload: {
            kind: "date",
            raw: "travel October 9",
            isoDate: "2026-10-09",
            precision: "day",
            role: "deadline",
            sourceTimestamp: "2026-09-06T12:00:00.000Z",
            resolutionCalendar: "source-timestamp-utc-date",
          },
          evidenceBasis: {
            ruleIds: ["explicit_deadline"],
            matchedText: "need it before the trip on October 9",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(withDeadline.brief.length, 1);
    assert.equal(withDeadline.brief[0]?.rankClass, "deadline_risk");
    assert.match(withDeadline.brief[0]?.recommended ?? "", /ETA/i);
  });

  it("keeps a vendor production blocker when acknowledgement is missing", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "sent",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Moving forward with Mod 1; sending the family sapphire.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Moving forward with Mod 1; sending the family sapphire.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.equal(result.brief[0]?.rankClass, "production_blocker");
    assert.match(result.brief[0]?.recommended ?? "", /Confirm status with the shop/i);
  });

  it("adjudicates superseded specs down to one material discrepancy", () => {
    const superseded = Array.from({ length: 24 }, (_, index) =>
      row({
        candidateId: `old-spec-${index}`,
        sourceTimestamp: "2026-08-01T12:00:00.000Z",
        candidateType: "structured_spec",
        candidateState: "superseded",
        proposedTarget: {
          kind: "project_spec",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
        },
        payload: {
          kind: "structured_spec",
          fieldName: "metal",
          proposedValue: index % 2 === 0 ? "18k yellow gold" : "Platinum",
          currentValue: "Platinum",
          conflict: true,
        },
        evidenceBasis: {
          ruleIds: ["spec_conflict_review_required"],
          matchedText: "metal note",
        },
      }),
    );
    const result = briefOf({
      candidates: [
        ...superseded,
        row({
          candidateId: "size-now",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          candidateType: "structured_spec",
          candidateState: "conflict",
          proposedTarget: {
            kind: "project_spec",
            projectId: COS_LOOP_PROJECT_A,
            fieldName: "finger_size",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "11",
            currentValue: "12.5",
            conflict: true,
          },
          evidenceBasis: {
            ruleIds: ["spec_conflict_review_required"],
            matchedText: "finger size 11",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.explanation ?? "", /Finger size differs: approved 12\.5 vs latest evidence 11/i);
    assert.doesNotMatch(result.brief[0]?.explanation ?? "", /24 spec|25 spec|specs captured/i);
  });

  it("suppresses a fully handled thread into Already handled / Watching", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "client-q",
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "can we add milgrain",
          },
          evidenceBasis: {
            ruleIds: ["explicit_design_refinement"],
            matchedText: "can we add milgrain",
          },
        }),
        row({
          candidateId: "founder-done",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "I'll send the CAD tomorrow.",
            dueAt: null,
            sourceTimestamp: "2026-09-06T12:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "I'll send the CAD tomorrow.",
          },
        }),
      ],
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "I'll send the CAD tomorrow.",
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 0);
    assert.equal(result.watching.length, 1);
    assert.match(result.watching[0]?.detail ?? "", /already answered/i);
  });

  it("ignores system boilerplate", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "tech",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "The technician will arrive on site after 18. Unsubscribe.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["unread"],
            matchedText: "The technician will arrive on site after 18.",
          },
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 0);
    assert.equal(result.watching.length, 0);
  });

  it("explains reactivation of old exploratory work", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "old-explore",
          sourceTimestamp: "2026-06-02T12:00:00.000Z",
          sourceRef: `gc1|${GMAIL_THREAD_B}|old`,
          proposedTarget: { kind: "none" },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "new_project",
            value: "necklace sketch",
          },
          evidenceBasis: {
            ruleIds: ["explicit_new_project_request"],
            matchedText: "thinking about a necklace",
          },
        }),
        row({
          candidateId: "now-ask",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          sourceRef: `gc1|${GMAIL_THREAD_B}|now`,
          proposedTarget: { kind: "none" },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "new_project",
            value: "price timing and next steps",
          },
          evidenceBasis: {
            ruleIds: ["explicit_new_project_request"],
            matchedText: "Can you send price, timing and next steps",
          },
        }),
        row({
          candidateId: "name",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          sourceRef: `gc1|${GMAIL_THREAD_B}|name`,
          proposedTarget: { kind: "person", personId: PERSON_ROWE },
          reviewStatus: "approved",
          candidateType: "person_association",
          payload: {
            kind: "person_association",
            displayName: "Client Rowe",
            emailHash: null,
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: {
            ruleIds: ["identity"],
            matchedText: "Client Rowe",
          },
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /active again|handoff/i);
    assert.match(result.brief[0]?.explanation ?? "", /no canonical Project/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "create_project"),
      true,
    );
  });

  it("retains evidence provenance without exposing Candidate rows as the founder path", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "sent",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.ok((result.brief[0]?.evidence.length ?? 0) >= 1);
    assert.ok(result.brief[0]?.evidence[0]?.candidateId);
    assert.match(result.brief[0]?.evidence[0]?.label ?? "", /Justin/i);
    assert.equal(result.brief[0]?.projectStateLabel, "Production");
    assert.equal(result.brief[0]?.openJobLabel, null);
  });

  it("generates Gmail thread links only for safe hex thread ids", () => {
    const safe = row({
      candidateId: "safe",
      sourceRef: `gc1|${GMAIL_THREAD}|msg-safe`,
    });
    const unsafe = row({
      candidateId: "unsafe",
      sourceRef: "gc1|abbey-thread|msg-1",
    });
    assert.equal(
      gmailThreadHrefFor(safe),
      `https://mail.google.com/mail/u/0/#all/${GMAIL_THREAD}`,
    );
    assert.equal(gmailThreadHrefFor(unsafe), null);
    const result = briefOf({
      candidates: [
        row({
          candidateId: "sent",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "open_email" && action.href?.includes("mail.google.com")),
      true,
    );
  });

  it("cannot mutate canonical state", () => {
    const source = readFileSync(join(DIR, "moderator.ts"), "utf8");
    assert.doesNotMatch(source, /mutateJob|setProjectLifecycle|createProjectJob|mergePerson|mintPerson/);
    assert.doesNotMatch(source, /applyReview|gmail\.googleapis|sendMail|users\.messages\.send/);
    assert.match(source, /Presentation only/);
  });

  it("allows fewer than five brief items and does not pad", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "sent",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.equal(result.brief[0]?.rank, 1);
  });

  it("ranks equal-class items deterministically by id when timestamps match", () => {
    const projects = new Map(fixtureProjects());
    projects.set(PROJECT_C, {
      projectId: PROJECT_C,
      title: "Voss ring",
      personName: "Client Voss",
      people: [{ personId: PERSON_ROWE, displayName: "Client Voss", role: "client" }],
      isCurrent: true,
    });
    const make = (candidateId: string, projectId: string, thread: string): ContinuumCandidate =>
      row({
        candidateId,
        sourceRef: `gc1|${thread}|${candidateId}`,
        sourceTimestamp: "2026-09-06T12:00:00.000Z",
        proposedTarget: { kind: "project", projectId },
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: "yellow gold",
        },
        evidenceBasis: {
          ruleIds: ["explicit_design_refinement"],
          matchedText: "yellow gold",
        },
      });
    const ask = (candidateId: string, projectId: string, thread: string): ContinuumCandidate =>
      row({
        candidateId,
        sourceRef: `gc1|${thread}|${candidateId}`,
        sourceTimestamp: "2026-09-05T12:00:00.000Z",
        proposedTarget: { kind: "project", projectId },
        candidateType: "follow_up",
        payload: {
          kind: "follow_up",
          text: "Which metal do you want for the band?",
          dueAt: null,
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
        },
        evidenceBasis: {
          ruleIds: ["explicit_follow_up"],
          matchedText: "Which metal do you want for the band?",
        },
      });
    const first = briefOf({
      candidates: [
        ask("zz-ask", PROJECT_C, "18eeeeeeeeeeeeee"),
        make("zz-answer", PROJECT_C, "18eeeeeeeeeeeeee"),
        ask("aa-ask", COS_LOOP_PROJECT_A, GMAIL_THREAD),
        make("aa-answer", COS_LOOP_PROJECT_A, GMAIL_THREAD),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const second = briefOf({
      candidates: [
        ask("aa-ask", COS_LOOP_PROJECT_A, GMAIL_THREAD),
        make("aa-answer", COS_LOOP_PROJECT_A, GMAIL_THREAD),
        ask("zz-ask", PROJECT_C, "18eeeeeeeeeeeeee"),
        make("zz-answer", PROJECT_C, "18eeeeeeeeeeeeee"),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(first.brief.length, 2);
    assert.deepEqual(
      first.brief.map((item) => item.id),
      second.brief.map((item) => item.id),
    );
    assert.ok(first.brief[0]!.id < first.brief[1]!.id);
  });

  it("recommends a shop-status check for quiet production without creating reminder state", () => {
    const result = briefOf({
      candidates: [
        row({
          candidateId: "sent-old",
          sourceTimestamp: "2026-08-01T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-08-01T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
        row({
          candidateId: "ack-old",
          sourceTimestamp: "2026-08-02T12:00:00.000Z",
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Received the center, we'll start production.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "Received the center, we'll start production.",
          },
        }),
      ],
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.match(result.brief[0]?.headline ?? "", /shop status/i);
    assert.match(result.brief[0]?.explanation ?? "", /will not create a reminder/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "add_to_top5"),
      true,
    );
  });

  it("does not duplicate a Top 5 engraving action in the Brief", () => {
    const view = loopOf({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Touch base with Yvonne about bee engraving and date engraving",
        }),
      ],
      candidates: [
        specRow({
          candidateId: "cad-old",
          fieldName: "cad_job_number",
          proposedValue: "RN04163",
          currentValue: "C010657",
        }),
        specRow({
          candidateId: "metal-part",
          fieldName: "metal",
          proposedValue: "white gold",
          currentValue: "14K two-tone: YG rails / WG center",
        }),
      ],
      projects: chickenProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.brief.length, 0);
    assert.doesNotMatch(JSON.stringify(view.brief), /specs captured|Spec conflict/i);
  });

  it("keeps a genuine finger-size conflict distinct from a Top 5 engraving action", () => {
    const view = loopOf({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Touch base with Yvonne about bee engraving and date engraving",
        }),
      ],
      candidates: [
        specRow({
          candidateId: "size-now",
          fieldName: "finger_size",
          proposedValue: "11",
          currentValue: "12.5",
        }),
      ],
      projects: chickenProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.brief.length, 1);
    assert.match(view.brief[0]?.headline ?? "", /finger size/i);
    assert.doesNotMatch(view.brief[0]?.headline ?? "", /engraving/i);
    assert.match(view.brief[0]?.recommended ?? "", /finger size/i);
  });

  it("does not turn production CAD and historical spec chatter into a 26-spec decision", () => {
    const result = briefOf({
      candidates: [
        specRow({
          candidateId: "cad-old",
          fieldName: "cad_job_number",
          proposedValue: "RN04163",
          currentValue: "C010657",
        }),
        specRow({
          candidateId: "supply-old",
          fieldName: "diamond_supply_notes",
          proposedValue: "lab grown dias on mounting",
          currentValue: "Vlora lab-grown on mounting",
        }),
      ],
      jobs: [],
      projects: pennockProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /26 specs|specs captured|Spec conflict/i);
  });

  it("does not recommend Create Project once a unique Production Project already exists", () => {
    const thread = "18vossvossvoss01";
    const result = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "voss-person",
          sourceRef: `gc1|${thread}|person`,
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_VOSS },
          candidateType: "person_association",
          reviewStatus: "approved",
          payload: {
            kind: "person_association",
            displayName: "Client Voss",
            emailHash: "voss",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["confirmed_person"], matchedText: "Client Voss" },
        }),
        fixtureCandidate({
          candidateId: "voss-paid",
          sourceRef: `gc1|${thread}|paid`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-04T12:00:00.000Z",
          proposedTarget: { kind: "none" },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "payment",
            value: "Payment received for invoice 8821",
          },
          evidenceBasis: {
            ruleIds: ["transactional_customer_notice"],
            matchedText: "Payment received for invoice 8821",
          },
        }),
        fixtureCandidate({
          candidateId: "voss-vendor",
          sourceRef: `gc1|${thread}|vendor`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
          proposedTarget: { kind: "none" },
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Received the center, we'll start production.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "Received the center, we'll start production.",
          },
        }),
      ],
      jobs: [],
      projects: vossProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 0);
    assert.equal(result.watching.length, 1);
    assert.match(result.watching[0]?.detail ?? "", /already in production/i);
    assert.equal(
      result.brief.some((item) => item.actions.some((action) => action.kind === "create_project")),
      false,
    );
    assert.match(result.watching[0]?.title ?? "", /Client Voss/i);
  });

  it("attributes a client design answer to that Person's unique Project", () => {
    const result = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "abbey-person",
          sourceRef: "gc1|earring-thread|msg-1",
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_ABBEY },
          candidateType: "person_association",
          reviewStatus: "approved",
          payload: {
            kind: "person_association",
            displayName: "Abbey Castillo",
            emailHash: "abc",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["confirmed_person"], matchedText: "Abbey Castillo" },
        }),
        fixtureCandidate({
          candidateId: "abbey-answer",
          sourceRef: "gc1|earring-thread|msg-2",
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "proposed_spec",
            value: "1 carat each",
          },
          evidenceBasis: {
            ruleIds: ["explicit_proposed_spec_carat"],
            matchedText: "1 carat each",
          },
        }),
      ],
      jobs: [],
      projects: abbeyProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.equal(result.brief[0]?.projectTitle, "Matching Marquise Earrings");
    assert.match(result.brief[0]?.personLabel ?? "", /Abbey Castillo/i);
    assert.doesNotMatch(result.brief[0]?.personLabel ?? "", /Hourglass/i);
    assert.doesNotMatch(result.brief[0]?.projectTitle ?? "", /Hourglass/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "create_project"),
      false,
    );
  });

  const VENDOR_THREAD = "1a00abcdeffedcba";
  const PROJECT_SIBLING = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  function vendorProjects(extra: Partial<CosProjectContext> = {}): Map<string, CosProjectContext> {
    const base = productionProjects();
    const row = base.get(COS_LOOP_PROJECT_A)!;
    base.set(COS_LOOP_PROJECT_A, {
      ...row,
      gmailThreadId: VENDOR_THREAD,
      ...extra,
    });
    return base;
  }

  function vendorEvidence(input: {
    candidateId: string;
    sourceTimestamp: string;
    text: string;
    ruleIds?: readonly string[];
    person?: boolean;
  }): ContinuumCandidate[] {
    const rows: ContinuumCandidate[] = [];
    if (input.person) {
      rows.push(
        fixtureCandidate({
          candidateId: `${input.candidateId}-person`,
          sourceRef: `gc1|${VENDOR_THREAD}|person`,
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_VENDOR },
          candidateType: "person_association",
          reviewStatus: "pending",
          confidence: "low",
          payload: {
            kind: "person_association",
            displayName: "Mara",
            emailHash: "vendor",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["email_hash_supporting_not_identity"], matchedText: "Mara" },
        }),
      );
    }
    rows.push(
      fixtureCandidate({
        candidateId: input.candidateId,
        sourceRef: `gc1|${VENDOR_THREAD}|${input.candidateId}`,
        sourceSystem: "gmail",
        sourceTimestamp: input.sourceTimestamp,
        proposedTarget: { kind: "project", projectId: null },
        candidateType: "follow_up",
        payload: {
          kind: "follow_up",
          text: input.text,
          dueAt: null,
          sourceTimestamp: input.sourceTimestamp,
        },
        evidenceBasis: {
          ruleIds: input.ruleIds ?? ["explicit_founder_commitment"],
          matchedText: input.text,
        },
      }),
    );
    return rows;
  }

  it("attributes a vendor thread already associated to one Production Project", () => {
    const result = briefOf({
      candidates: vendorEvidence({
        candidateId: "sent-shop",
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
        text: "Sending the family sapphire to the shop.",
        person: true,
      }),
      jobs: [],
      projects: vendorProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.equal(result.brief[0]?.projectId, COS_LOOP_PROJECT_A);
    assert.match(result.brief[0]?.personLabel ?? "", /Client Hale/i);
    assert.match(result.brief[0]?.projectTitle ?? "", /Hale band/i);
    assert.doesNotMatch(result.brief[0]?.personLabel ?? "", /Unassigned|Mara|Hourglass/i);
    assert.match(result.brief[0]?.headline ?? "", /shop status/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "confirm_person"),
      false,
    );
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "create_project"),
      false,
    );
  });

  it("inherits a vendor CAD thread onto the unique Production Project with a stored Gmail thread", () => {
    const siblingThread = "1a0aaabbbcccddd1";
    const projects = vendorProjects({
      gmailThreadId: siblingThread,
      specs: [
        { fieldName: "finger_size", value: "12.5" },
        { fieldName: "metal", value: "Platinum" },
      ],
    });
    projects.set(PROJECT_C, {
      projectId: PROJECT_C,
      title: "Stored CAD family",
      personName: "Other Client",
      people: [{ personId: PERSON_ROWE, displayName: "Other Client", role: "client" }],
      isCurrent: true,
      lifecycleStage: "cad",
      specs: [{ fieldName: "cad_job_number", value: "CR5001024" }],
    });
    const result = briefOf({
      candidates: [
        ...vendorEvidence({
          candidateId: "shop-cad",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          text: "Shop status for the platinum band.",
          person: true,
        }),
        fixtureCandidate({
          candidateId: "shop-cad-id",
          sourceRef: `gc1|${VENDOR_THREAD}|cad`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-03T16:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "structured_spec",
          payload: {
            kind: "structured_spec",
            fieldName: "cad_job_number",
            proposedValue: "CR5000971",
            currentValue: null,
            conflict: false,
          },
          evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5000971" },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief[0]?.projectId, COS_LOOP_PROJECT_A);
    assert.match(result.brief[0]?.personLabel ?? "", /Client Hale/i);
    assert.match(result.brief[0]?.projectTitle ?? "", /Hale band/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "confirm_person"),
      false,
    );
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "create_project"),
      false,
    );
  });

  it("puts handled vendor CAD on Watching instead of Unassigned", () => {
    const projects = vendorProjects({
      gmailThreadId: "1a0aaabbbcccddd1",
      specs: [{ fieldName: "metal", value: "Platinum" }],
    });
    projects.set(PROJECT_C, {
      projectId: PROJECT_C,
      title: "Stored CAD family",
      personName: "Other Client",
      people: [{ personId: PERSON_ROWE, displayName: "Other Client", role: "client" }],
      isCurrent: true,
      lifecycleStage: "cad",
      specs: [{ fieldName: "cad_job_number", value: "CR5001024" }],
    });
    const result = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "handled-cad",
          sourceRef: `gc1|${VENDOR_THREAD}|cad`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-03T16:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "structured_spec",
          payload: {
            kind: "structured_spec",
            fieldName: "cad_job_number",
            proposedValue: "CR5000971",
            currentValue: null,
            conflict: false,
          },
          evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5000971" },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 0);
    assert.equal(result.watching[0]?.projectId, COS_LOOP_PROJECT_A);
    assert.match(result.watching[0]?.title ?? "", /Hale band/i);
    assert.equal(
      result.brief.some((row) => row.personLabel == null && row.headline === "Your turn"),
      false,
    );
  });

  it("fails closed when unmatched vendor CAD could belong to more than one Production Project", () => {
    const projects = vendorProjects({
      gmailThreadId: "1a0aaabbbcccddd1",
      specs: [{ fieldName: "metal", value: "Platinum" }],
    });
    projects.set(PROJECT_SIBLING, {
      projectId: PROJECT_SIBLING,
      title: "Other band",
      personName: "Other Client",
      people: [{ personId: PERSON_ROWE, displayName: "Other Client", role: "client" }],
      isCurrent: true,
      lifecycleStage: "production",
      gmailThreadId: "1a0aaabbbcccddd2",
      specs: [{ fieldName: "metal", value: "Platinum" }],
    });
    const result = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "ambiguous-cad",
          sourceRef: `gc1|${VENDOR_THREAD}|cad`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-03T16:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "structured_spec",
          payload: {
            kind: "structured_spec",
            fieldName: "cad_job_number",
            proposedValue: "CR5000971",
            currentValue: null,
            conflict: false,
          },
          evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5000971" },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const surfaced = result.brief[0];
    if (surfaced) {
      assert.equal(surfaced.projectId, null);
      assert.equal(surfaced.personLabel, null);
    }
    assert.equal(
      result.brief.some((row) => row.projectId === COS_LOOP_PROJECT_A || row.projectId === PROJECT_SIBLING),
      false,
    );
  });

  it("does not inherit unmatched vendor CAD onto a CAD-stage Project", () => {
    const result = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "cad-stage-id",
          sourceRef: `gc1|${VENDOR_THREAD}|cad`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-03T16:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "structured_spec",
          payload: {
            kind: "structured_spec",
            fieldName: "cad_job_number",
            proposedValue: "CR5000971",
            currentValue: null,
            conflict: false,
          },
          evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5000971" },
        }),
      ],
      jobs: [],
      projects: new Map([
        [
          COS_LOOP_PROJECT_B,
          {
            projectId: COS_LOOP_PROJECT_B,
            title: "Matching Marquise Earrings",
            personName: "Abbey Castillo",
            people: [{ personId: PERSON_ABBEY, displayName: "Abbey Castillo", role: "client" }],
            isCurrent: true,
            lifecycleStage: "cad",
            gmailThreadId: "1a0aaabbbcccddd1",
          },
        ],
      ]),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const surfaced = result.brief[0];
    if (surfaced) {
      assert.equal(surfaced.projectId, null);
      assert.notEqual(surfaced.projectId, COS_LOOP_PROJECT_B);
    }
    assert.equal(
      result.brief.some((row) => row.projectId === COS_LOOP_PROJECT_B),
      false,
    );
  });

  it("attributes a vendor thread uniquely identified by stored CAD evidence", () => {
    const result = briefOf({
      candidates: vendorEvidence({
        candidateId: "cad-shop",
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
        text: "Sending the family sapphire for CR5000971.",
        person: true,
      }),
      jobs: [],
      projects: vendorProjects({
        gmailThreadId: null,
        specs: [
          { fieldName: "cad_job_number", value: "CR5000971" },
          { fieldName: "metal", value: "Platinum" },
        ],
      }),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief[0]?.projectId, COS_LOOP_PROJECT_A);
    assert.match(result.brief[0]?.personLabel ?? "", /Client Hale/i);
    assert.equal(
      result.brief[0]?.actions.some((action) => action.kind === "confirm_person"),
      false,
    );
  });

  it("keeps a vendor thread Unassigned when no supported Project relationship exists", () => {
    const result = briefOf({
      candidates: vendorEvidence({
        candidateId: "loose-shop",
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
        text: "Sending the family sapphire to the shop.",
        person: true,
      }),
      jobs: [],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const item = [...result.brief, ...result.watching].find((row) =>
      JSON.stringify(row).includes("loose-shop"),
    );
    const surfaced = result.brief[0];
    if (surfaced) {
      assert.equal(surfaced.projectId, null);
      assert.equal(surfaced.personLabel, null);
      assert.equal(
        surfaced.actions.some((action) => action.kind === "confirm_person"),
        true,
      );
    }
    assert.equal(item?.projectId ?? surfaced?.projectId ?? null, null);
  });

  it("fails closed when one vendor thread matches multiple Production Projects", () => {
    const projects = vendorProjects();
    projects.set(PROJECT_SIBLING, {
      projectId: PROJECT_SIBLING,
      title: "Other band",
      personName: "Other Client",
      people: [{ personId: PERSON_ROWE, displayName: "Other Client", role: "client" }],
      isCurrent: true,
      lifecycleStage: "production",
      gmailThreadId: VENDOR_THREAD,
    });
    const result = briefOf({
      candidates: vendorEvidence({
        candidateId: "ambiguous-shop",
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
        text: "Sending the family sapphire to the shop.",
        person: true,
      }),
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const surfaced = result.brief[0];
    if (surfaced) {
      assert.equal(surfaced.projectId, null);
      assert.equal(surfaced.personLabel, null);
    }
    assert.equal(
      result.brief.some((row) => row.projectId === COS_LOOP_PROJECT_A || row.projectId === PROJECT_SIBLING),
      false,
    );
  });

  it("does not recommend Create Project when vendor payment is already on a Production Project", () => {
    const result = briefOf({
      candidates: [
        ...vendorEvidence({
          candidateId: "paid",
          sourceTimestamp: "2026-09-04T12:00:00.000Z",
          text: "Payment received for invoice 8821",
          ruleIds: ["transactional_customer_notice"],
          person: true,
        }),
        fixtureCandidate({
          candidateId: "vendor-ack",
          sourceRef: `gc1|${VENDOR_THREAD}|ack`,
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-05T12:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "note",
          payload: {
            kind: "note",
            text: "Received the center, we'll start production.",
            contextLayer: null,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "Received the center, we'll start production.",
          },
        }),
      ],
      jobs: [],
      projects: vendorProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(
      result.brief.some((item) => item.actions.some((action) => action.kind === "create_project")),
      false,
    );
    assert.equal(result.watching[0]?.projectId ?? result.brief[0]?.projectId, COS_LOOP_PROJECT_A);
    assert.doesNotMatch(JSON.stringify(result), /Create project/i);
  });

  it("never mints or merges a Person from supported vendor Project context", () => {
    const attribution = readFileSync(join(DIR, "attribution.ts"), "utf8");
    assert.doesNotMatch(attribution, /mintPerson\s*:\s*true|mergePersons\s*:\s*true|mergePerson\(/);
    assert.match(attribution, /Does not mint Persons/);
    const result = briefOf({
      candidates: vendorEvidence({
        candidateId: "sent-shop",
        sourceTimestamp: "2026-09-03T15:00:00.000Z",
        text: "Sending the family sapphire to the shop.",
        person: true,
      }),
      jobs: [],
      projects: vendorProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief[0]?.personLabel, "Client Hale");
    assert.doesNotMatch(result.brief[0]?.personLabel ?? "", /Mara/);
  });

  it("does not regress J.Pennock, Abbey, Chicken Ring, or Top 5 suppression", () => {
    const pennock = briefOf({
      candidates: [
        specRow({
          candidateId: "cad-old",
          fieldName: "cad_job_number",
          proposedValue: "RN04163",
          currentValue: "C010657",
        }),
      ],
      jobs: [],
      projects: pennockProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(pennock.brief.length, 0);
    const chicken = loopOf({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Touch base with Yvonne about bee engraving and date engraving",
        }),
      ],
      candidates: [],
      projects: chickenProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(chicken.top5.length, 1);
    assert.equal(chicken.top5[0]?.projectId, COS_LOOP_PROJECT_A);
    const abbey = briefOf({
      candidates: [
        fixtureCandidate({
          candidateId: "abbey-person",
          sourceRef: "gc1|earring-thread|msg-1",
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_ABBEY },
          candidateType: "person_association",
          reviewStatus: "approved",
          payload: {
            kind: "person_association",
            displayName: "Abbey Castillo",
            emailHash: "abc",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: { ruleIds: ["confirmed_person"], matchedText: "Abbey Castillo" },
        }),
        fixtureCandidate({
          candidateId: "abbey-answer",
          sourceRef: "gc1|earring-thread|msg-2",
          sourceSystem: "gmail",
          sourceTimestamp: "2026-09-06T12:00:00.000Z",
          proposedTarget: { kind: "project", projectId: null },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "proposed_spec",
            value: "1 carat each",
          },
          evidenceBasis: {
            ruleIds: ["explicit_proposed_spec_carat"],
            matchedText: "1 carat each",
          },
        }),
      ],
      jobs: [],
      projects: abbeyProjects(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(abbey.brief[0]?.projectTitle, "Matching Marquise Earrings");
    assert.match(abbey.brief[0]?.personLabel ?? "", /Abbey Castillo/i);
  });

  it("renders Brief and Open Job items in one Up next docket without product labels", () => {
    const view = loopOf({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Call the setter",
        }),
      ],
      candidates: [
        row({
          candidateId: "sent",
          sourceTimestamp: "2026-09-03T15:00:00.000Z",
          candidateType: "follow_up",
          payload: {
            kind: "follow_up",
            text: "Sending the family sapphire to the shop.",
            dueAt: null,
            sourceTimestamp: "2026-09-03T15:00:00.000Z",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Sending the family sapphire to the shop.",
          },
        }),
      ],
      projects: productionProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: view }));
    assert.match(html, /Up next/i);
    assert.doesNotMatch(html, /Concierge Brief|Recommended:|>Top 5</);
    assert.doesNotMatch(html, /Earlier attention view/);
    assert.match(html, /Evidence/);
    assert.match(html, /Open email/);
    const briefChunks = html.split("data-cos-brief-item").slice(1);
    for (const chunk of briefChunks) {
      const row = chunk.split("data-cos-docket-item")[0] ?? chunk;
      assert.doesNotMatch(
        row
          .replace(/href="[^"]*"/g, 'href=""')
          .replace(/<input[^>]*type="hidden"[^>]*\/?>/g, ""),
        /aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
      );
    }
    const css = readFileSync(
      join(DIR, "../../../../app/executive-dashboard/concierge/concierge.css"),
      "utf8",
    );
    assert.match(css, /hg-cos-brief-explanation[\s\S]*-webkit-line-clamp:\s*3/);
  });

  it("recomputes unassigned replies after canonical person association review", async () => {
    const thread = "thread-unassigned-reply";
    const reply = fixtureCandidate({
      candidateId: "unassigned-reply",
      sourceRef: `gc1|${thread}|msg-reply`,
      sourceSystem: "gmail",
      sourceTimestamp: "2026-09-07T18:00:00.000Z",
      proposedTarget: { kind: "none" },
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_refinement",
        value: "Let's go with that design",
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_approval"],
        matchedText: "Let's go with that design",
      },
    });
    const association = fixtureCandidate({
      candidateId: "unassigned-person",
      sourceRef: `gc1|${thread}|msg-person`,
      sourceSystem: "gmail",
      sourceTimestamp: "2026-09-07T17:00:00.000Z",
      proposedTarget: { kind: "person", personId: null },
      candidateType: "person_association",
      confidence: "medium",
      payload: {
        kind: "person_association",
        displayName: "Lee",
        emailHash: "lee",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: { ruleIds: ["gmail_from_email"], matchedText: "Lee" },
    });
    const before = briefOf({
      candidates: [reply, association],
      jobs: [],
      projects: new Map(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(before.brief[0]?.personLabel, null);
    const confirm = before.brief[0]?.actions.find((action) => action.kind === "confirm_person");
    assert.equal(confirm?.kind, "confirm_person");
    assert.match(confirm?.href ?? "", /personAssociation=unassigned-person/);

    const store = new InMemoryCandidateStore();
    await store.replace(reply);
    await store.replace(association);
    const confirmed = await confirmGmailPersonAssociation({
      store,
      personExists: async (personId) => personId === COS_LOOP_PERSON_A,
      body: {
        candidateId: "unassigned-person",
        personId: COS_LOOP_PERSON_A,
        actor: "justin",
      },
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(confirmed.ok, true);
    const saved = await store.get("unassigned-person");
    assert.equal(saved?.reviewStatus, "approved");

    const after = briefOf({
      candidates: await store.list(),
      jobs: [],
      projects: new Map(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(after.brief[0]?.personLabel, "Lee");
    assert.equal(
      after.brief[0]?.actions.some((action) => action.kind === "confirm_person"),
      false,
    );
    assert.match(after.brief[0]?.recommended ?? "", /recap/i);
  });

  it("opens the client Gmail thread instead of a generated operating brief restating the same spec", () => {
    const clientThread = GMAIL_THREAD;
    const briefThread = "19abcdef01234567";
    const clientHref = `https://mail.google.com/mail/u/0/#all/${clientThread}/aaa111bbb2`;
    const briefHref = `https://mail.google.com/mail/u/0/#all/${briefThread}/ccc222ddd3`;
    const projects = productionProjects();
    const current = projects.get(COS_LOOP_PROJECT_A)!;
    projects.set(COS_LOOP_PROJECT_A, { ...current, gmailThreadId: clientThread });
    const result = briefOf({
      candidates: [
        row({
          candidateId: "cand-client",
          sourceTimestamp: "2026-09-08T15:00:00.000Z",
          sourceRef: `gc1|${clientThread}|aaa111bbb2`,
          candidateType: "structured_spec",
          candidateState: "conflict",
          proposedTarget: {
            kind: "project_spec",
            projectId: COS_LOOP_PROJECT_A,
            fieldName: "finger_size",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "11",
            currentValue: "12.5",
            conflict: true,
          },
          evidenceBasis: {
            ruleIds: ["spec_conflict_review_required", "explicit_client_request"],
            matchedText: "finger size 11",
          },
        }),
        row({
          candidateId: "cand-brief",
          sourceTimestamp: "2026-09-09T12:00:00.000Z",
          sourceRef: `gc1|${briefThread}|ccc222ddd3`,
          candidateType: "structured_spec",
          candidateState: "conflict",
          proposedTarget: {
            kind: "project_spec",
            projectId: COS_LOOP_PROJECT_A,
            fieldName: "finger_size",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "11",
            currentValue: "12.5",
            conflict: true,
          },
          evidenceBasis: {
            ruleIds: [
              "spec_conflict_review_required",
              GENERATED_FOUNDER_OPERATING_BRIEF_RULE,
            ],
            matchedText: "finger size 11",
          },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(result.brief.length, 1);
    assert.equal(result.brief[0]?.canonicalGmailThreadId, clientThread);
    const openEmail = result.brief[0]?.actions.find((action) => action.kind === "open_email");
    assert.equal(openEmail?.href, clientHref);
    assert.notEqual(openEmail?.href, briefHref);
    const generatedBeat = result.brief[0]?.evidence.find((beat) => beat.candidateId === "cand-brief");
    assert.equal(generatedBeat?.generatedSource, true);
    const controls = selectFounderControls({
      origin: "brief",
      subject: "Client Hale / Hale band",
      headline: result.brief[0]?.recommended ?? "",
      context: result.brief[0]?.explanation ?? null,
      job: null,
      brief: result.brief[0]!,
      decision: null,
      anomaly: null,
    });
    assert.equal(controls.openEmail?.href, clientHref);
    assert.equal(controls.emailSources.some((row) => row.href === briefHref), false);
  });
});
