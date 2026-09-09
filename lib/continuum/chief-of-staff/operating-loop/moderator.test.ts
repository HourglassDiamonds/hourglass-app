import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeCosOperatingLoop } from "./compose";
import { gmailThreadHrefFor } from "./evidence";
import {
  COS_LOOP_NOW,
  COS_LOOP_PERSON_A,
  COS_LOOP_PROJECT_A,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import { composeConciergeBrief } from "./moderator";
import type { CosProjectContext } from "./types";

const DIR = dirname(fileURLToPath(import.meta.url));
const PERSON_VENDOR = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_ROWE = "55555555-eeee-4eee-8eee-eeeeeeeeeeee";
const PROJECT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
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
    assert.match(before.brief[0]?.recommended ?? "", /Follow up/i);
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
    assert.match(result.brief[0]?.recommended ?? "", /Mara/i);
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
    assert.doesNotMatch(source, /mutateJob|setProjectLifecycle|createProjectJob|mergePerson/);
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

  it("renders Concierge Brief above collapsed fallback attention and keeps Top 5 first", () => {
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
    assert.match(html, /Top 5/);
    assert.match(html, /Concierge Brief/);
    assert.match(html, /Review evidence/);
    assert.match(html, /Open email/);
    assert.match(html, /Earlier attention view/);
    const briefHtml = html.slice(
      html.indexOf("data-cos-brief"),
      html.indexOf("data-cos-fallback-attention"),
    );
    assert.doesNotMatch(
      briefHtml.replace(/href="[^"]*"/g, 'href=""'),
      /aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/,
    );
    const top5At = html.indexOf("Top 5");
    const briefAt = html.indexOf("Concierge Brief");
    const fallbackAt = html.indexOf("Earlier attention view");
    assert.ok(top5At >= 0 && briefAt > top5At);
    assert.ok(fallbackAt > briefAt);
    const css = readFileSync(
      join(DIR, "../../../../app/executive-dashboard/concierge/concierge.css"),
      "utf8",
    );
    assert.match(css, /hg-cos-brief-explanation[\s\S]*-webkit-line-clamp:\s*3/);
  });
});
