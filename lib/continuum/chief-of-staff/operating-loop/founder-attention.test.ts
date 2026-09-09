import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { composeCosOperatingLoop } from "./compose";
import {
  classifyCandidateAttention,
  composeFounderAttentionSurface,
  visibleFounderAttentionCount,
} from "./founder-attention";
import { proposeExplicitActions } from "./propose-actions";
import { collectCanonicalActionables, selectTopRanked } from "./collect";
import { rankActionableWork } from "./rank";
import { COS_TOP_5_LIMIT } from "./types";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../..");

function ctx() {
  return {
    jobs: [] as ReturnType<typeof fixtureJob>[],
    projects: fixtureProjects(),
    nowIso: COS_LOOP_NOW,
  };
}

function abbeyProjects() {
  const projects = fixtureProjects();
  projects.set(COS_LOOP_PROJECT_A, {
    projectId: COS_LOOP_PROJECT_A,
    title: "Matching Marquise Earrings",
    personName: "Abbey",
    people: [{ personId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Abbey" }],
    isCurrent: true,
  });
  return projects;
}

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    sourceRef: "gc1|abbey-thread|msg-1",
    proposedTarget: { kind: "project", projectId: COS_LOOP_PROJECT_A },
    ...extra,
  });
}

describe("CoS founder-attention classification", () => {
  it("suppresses boilerplate channel-meta, signatures, and incomplete fragments", () => {
    const boilerplate = fixtureCandidate({
      candidateId: "aaaaaaaa-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Please do not reply directly to this email",
        detail: "Please do not reply directly to this email",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "Please do not reply directly to this email",
      },
    });
    const fragment = fixtureCandidate({
      candidateId: "bbbbbbbb-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: "I'll send",
        detail: "I'll send",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: "I'll send",
      },
    });
    const genericFollow = fixtureCandidate({
      candidateId: "cccccccc-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "open_job",
        jobKind: "required_action",
        subject: "follow up",
        detail: "follow up",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_follow_up"],
        matchedText: "follow up",
      },
    });
    const signature = fixtureCandidate({
      candidateId: "dddddddd-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "note",
      payload: { kind: "note", text: "Best regards", contextLayer: null },
      evidenceBasis: { ruleIds: ["explicit_note"], matchedText: "Best regards" },
    });
    const technician = fixtureCandidate({
      candidateId: "eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "open_job",
        jobKind: "required_action",
        subject: "Technician arrival window — please ensure site access",
        detail: "The technician will arrive between 9 and 11. Please ensure someone is on site.",
        waitingOnActor: "vendor",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_vendor_waiting"],
        matchedText: "technician will arrive",
      },
    });
    const context = ctx();
    assert.equal(classifyCandidateAttention(boilerplate, context).lane, "background");
    assert.equal(classifyCandidateAttention(fragment, context).lane, "background");
    assert.equal(classifyCandidateAttention(genericFollow, context).lane, "background");
    assert.equal(classifyCandidateAttention(signature, context).lane, "background");
    assert.equal(classifyCandidateAttention(technician, context).lane, "background");
    const proposed = proposeExplicitActions({
      jobs: [],
      candidates: [boilerplate, fragment, genericFollow, signature, technician],
      projects: fixtureProjects(),
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(proposed.length, 0);
  });

  it("keeps an actual client decision and a complete founder commitment", () => {
    const client = fixtureCandidate({
      candidateId: "aaaaaaaa-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "open_job",
      proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Can you send me the updated render?",
        detail: "Can you send me the updated render?",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "Can you send me the updated render?",
      },
    });
    const commitment = fixtureCandidate({
      candidateId: "bbbbbbbb-eeee-4eee-8eee-eeeeeeeeeeee",
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
    });
    const context = ctx();
    assert.equal(classifyCandidateAttention(client, context).lane, "decision");
    assert.equal(classifyCandidateAttention(commitment, context).lane, "decision");
  });

  it("keeps a payment that can change Project state", () => {
    const payment = fixtureCandidate({
      candidateId: "aaaaaaaa-eeee-4eee-8eee-eeeeeeeeeeee",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "new_project",
        value: "Custom Engagement Ring",
      },
      evidenceBasis: {
        ruleIds: ["transactional_customer_notice"],
        matchedText: "Payment received Invoice 1215",
      },
    });
    assert.equal(classifyCandidateAttention(payment, ctx()).lane, "decision");
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [payment],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.needsYourDecision.length, 1);
    assert.match(view.needsYourDecision[0]?.headline ?? "", /payment received|New Project/i);
  });

  it("rolls multiple evidence fragments from one project into one founder object", () => {
    const rows = [
      gmailRow({
        candidateId: "answer",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: "yellow gold marquise pair",
        },
        evidenceBasis: {
          ruleIds: ["explicit_design_refinement"],
          matchedText: "yellow gold marquise pair",
        },
      }),
      gmailRow({
        candidateId: "spec-metal",
        candidateType: "structured_spec",
        proposedTarget: {
          kind: "project_spec",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
        },
        payload: {
          kind: "structured_spec",
          fieldName: "metal",
          proposedValue: "14k yellow gold",
          currentValue: null,
          conflict: false,
        },
        evidenceBasis: { ruleIds: ["explicit_metal"], matchedText: "14k yellow gold" },
      }),
      gmailRow({
        candidateId: "spec-size",
        candidateType: "structured_spec",
        proposedTarget: {
          kind: "project_spec",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "finger_size",
        },
        payload: {
          kind: "structured_spec",
          fieldName: "finger_size",
          proposedValue: "6.5",
          currentValue: null,
          conflict: false,
        },
        evidenceBasis: { ruleIds: ["explicit_finger_size"], matchedText: "size 6.5" },
      }),
      gmailRow({
        candidateId: "date",
        candidateType: "date",
        payload: {
          kind: "date",
          raw: "next Tuesday",
          isoDate: "2026-09-15",
          precision: "day",
          role: "mentioned",
          sourceTimestamp: COS_LOOP_NOW,
          resolutionCalendar: "source-timestamp-utc-date",
        },
        evidenceBasis: { ruleIds: ["relative_next_weekday"], matchedText: "next Tuesday" },
      }),
      gmailRow({
        candidateId: "fragment",
        candidateType: "open_job",
        proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
        payload: {
          kind: "open_job",
          jobKind: "required_action",
          subject: "follow up",
          detail: "follow up",
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: { ruleIds: ["explicit_follow_up"], matchedText: "follow up" },
      }),
    ];
    const surface = composeFounderAttentionSurface({
      candidates: rows,
      jobs: [],
      projects: abbeyProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 1);
    assert.match(surface.needsYourDecision[0]?.title ?? "", /Abbey/);
    assert.match(
      surface.needsYourDecision[0]?.headline ?? "",
      /answered the design question/,
    );
    assert.match(surface.needsYourDecision[0]?.detail ?? "", /2 new specs/);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("spec-metal"), true);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("spec-size"), true);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("fragment"), false);
  });

  it("keeps Candidate evidence in the roll-up and never deletes the store", () => {
    const source = readFileSync(join(DIR, "founder-attention.ts"), "utf8");
    assert.doesNotMatch(source, /store\.delete|reviewStatus:\s*"discarded"|mutateJob/);
    assert.match(source, /candidateIds/);
  });

  it("surfaces a consequential anomaly and does not let inference resolve jobs", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subject: "Send CAD",
      state: "resolved",
      resolvedAt: "2026-09-05T12:00:00.000Z",
      updatedAt: "2026-09-05T12:00:00.000Z",
    });
    const view = composeCosOperatingLoop({
      jobs: [job],
      candidates: [
        fixtureCandidate({
          candidateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          sourceTimestamp: "2026-09-07T12:00:00.000Z",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Can you send the CAD again",
            detail: null,
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Can you send the CAD again",
          },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.anomalies[0]?.kind, "contradicts-completion");
    assert.equal(job.state, "resolved");
    const complete = readFileSync(join(DIR, "complete.ts"), "utf8");
    const attention = readFileSync(join(DIR, "founder-attention.ts"), "utf8");
    assert.doesNotMatch(attention, /completeFounderActionable|mutateJob/);
    assert.match(complete, /action: "resolve"/);
  });

  it("does not change Top 5 canonical completion semantics", () => {
    const jobs = Array.from({ length: 6 }, (_, index) =>
      fixtureJob({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Send CAD revision ${index}`,
        kind: "commitment",
        createdAt: `2026-09-0${index + 1}T12:00:00.000Z`,
      }),
    );
    const view = composeCosOperatingLoop({
      jobs,
      candidates: [
        fixtureCandidate({
          candidateId: "noise",
          candidateType: "open_job",
          proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
          payload: {
            kind: "open_job",
            jobKind: "required_action",
            subject: "follow up",
            detail: "follow up",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: { ruleIds: ["explicit_follow_up"], matchedText: "follow up" },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    const ranked = rankActionableWork(
      collectCanonicalActionables({
        jobs,
        projects: fixtureProjects(),
        nowIso: COS_LOOP_NOW,
      }),
      COS_LOOP_NOW,
    );
    const expected = selectTopRanked(ranked, COS_TOP_5_LIMIT).map((row) => row.id);
    assert.deepEqual(
      view.top5.map((row) => row.id),
      expected,
    );
    assert.equal(view.top5.every((row) => row.writer === "open_job.resolve"), true);
    assert.equal(view.top5.every((row) => row.completable), true);
  });

  it("keeps ordinary-state mobile volume sane without hiding critical items", () => {
    const noise = Array.from({ length: 18 }, (_, index) =>
      gmailRow({
        candidateId: `noise-${index}`,
        candidateType: "open_job",
        sourceRef: `gc1|noise-${index}|msg`,
        proposedTarget: { kind: "open_job", projectId: COS_LOOP_PROJECT_A },
        payload: {
          kind: "open_job",
          jobKind: "required_action",
          subject: "follow up",
          detail: "Please do not reply directly to this email",
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_follow_up"],
          matchedText: "follow up",
        },
      }),
    );
    const view = composeCosOperatingLoop({
      jobs: [
        fixtureJob({
          jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          subject: "Send Abbey the CAD",
        }),
      ],
      candidates: [
        ...noise,
        gmailRow({
          candidateId: "answer",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "yellow gold marquise pair",
          },
        }),
        gmailRow({
          candidateId: "spec-a",
          candidateType: "structured_spec",
          proposedTarget: {
            kind: "project_spec",
            projectId: COS_LOOP_PROJECT_A,
            fieldName: "metal",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "metal",
            proposedValue: "14k yellow gold",
            currentValue: null,
            conflict: false,
          },
        }),
        gmailRow({
          candidateId: "spec-b",
          candidateType: "structured_spec",
          proposedTarget: {
            kind: "project_spec",
            projectId: COS_LOOP_PROJECT_A,
            fieldName: "finger_size",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "6.5",
            currentValue: null,
            conflict: false,
          },
        }),
      ],
      projects: abbeyProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const visible = visibleFounderAttentionCount(view);
    assert.ok(visible >= 1 && visible <= 8);
    assert.equal(view.top5.length, 1);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: view }));
    assert.match(html, /Top 5/);
    assert.match(html, /Needs your decision/);
    assert.doesNotMatch(html, /Please do not reply directly to this email/);
    assert.doesNotMatch(html, /Proposed actions/);
    const css = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/concierge.css"),
      "utf8",
    );
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\.hg-cos-attention/);
  });
});
