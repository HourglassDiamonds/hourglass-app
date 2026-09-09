import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { composeCosOperatingLoop } from "./compose";
import { composeFounderAttentionSurface } from "./founder-attention";
import {
  COS_LOOP_NOW,
  COS_LOOP_PERSON_A,
  COS_LOOP_PROJECT_A,
  COS_LOOP_PROJECT_B,
  fixtureCandidate,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import type { CosProjectContext } from "./types";

const PERSON_CLIENT = COS_LOOP_PERSON_A;
const PERSON_VENDOR = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_UNRESOLVED = "33333333-cccc-4ccc-8ccc-cccccccccccc";
const PERSON_JOSEPH = "44444444-dddd-4ddd-8ddd-dddddddddddd";

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

function specConflict(input: {
  candidateId: string;
  projectId: string;
  fieldName: "metal" | "finger_size" | "cad_job_number" | "diamond_supply_notes";
  proposedValue: string;
  currentValue: string;
  sourceRef?: string;
}): ContinuumCandidate {
  return gmailRow({
    candidateId: input.candidateId,
    sourceRef: input.sourceRef ?? `gc1|thread-${input.candidateId}|msg`,
    candidateType: "structured_spec",
    proposedTarget: {
      kind: "project_spec",
      projectId: input.projectId,
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

function pennockProjects(): Map<string, CosProjectContext> {
  return new Map([
    [
      COS_LOOP_PROJECT_A,
      {
        projectId: COS_LOOP_PROJECT_A,
        title: "J.Pennock",
        personName: "Jocelyn",
        people: [
          { personId: PERSON_VENDOR, displayName: "Jocelyn", role: "client" },
          { personId: PERSON_JOSEPH, displayName: "John Pennock", role: "client" },
        ],
        isCurrent: true,
        lifecycleStage: "production",
        specs: [
          { fieldName: "diamond_supply_notes", value: "Vlora lab-grown on mounting" },
          { fieldName: "metal", value: "Platinum" },
        ],
      },
    ],
  ]);
}

describe("CoS founder-attention attribution and conflict quality", () => {
  it("lets canonical Project plus the matching client win over alphabetical people[0]", () => {
    const surface = composeFounderAttentionSurface({
      candidates: [
        specConflict({
          candidateId: "metal-now",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
          proposedValue: "18k yellow gold",
          currentValue: "Platinum",
        }),
      ],
      jobs: [],
      projects: pennockProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision[0]?.title, "J.Pennock");
    assert.doesNotMatch(surface.needsYourDecision[0]?.title ?? "", /Jocelyn/);
  });

  it("does not use Hourglass or a studio person as the client when a Project exists", () => {
    const projects = fixtureProjects();
    projects.set(COS_LOOP_PROJECT_A, {
      projectId: COS_LOOP_PROJECT_A,
      title: "Dagger & Pearls",
      personName: "Hourglass",
      people: [
        { personId: PERSON_VENDOR, displayName: "Hourglass", role: "vendor-contact" },
        { personId: PERSON_CLIENT, displayName: "Nathan Pearl", role: "client" },
      ],
      isCurrent: true,
    });
    const surface = composeFounderAttentionSurface({
      candidates: [
        gmailRow({
          candidateId: "answer",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "yellow gold marquise pair",
          },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.match(surface.needsYourDecision[0]?.title ?? "", /Nathan Pearl/);
    assert.doesNotMatch(surface.needsYourDecision[0]?.title ?? "", /Hourglass/);
  });

  it("keeps an unresolved Person generic instead of labeling Hourglass as the client", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        fixtureCandidate({
          candidateId: "unscoped-answer",
          sourceRef: "gc1|unknown-thread|msg-1",
          proposedTarget: { kind: "none" },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "proposed_spec",
            value: "locking back",
          },
          evidenceBasis: {
            ruleIds: ["explicit_proposed_spec_back"],
            matchedText: "locking back",
          },
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.needsYourDecision.length, 1);
    assert.equal(view.needsYourDecision[0]?.title, "Unassigned");
    assert.doesNotMatch(view.needsYourDecision[0]?.title ?? "", /Hourglass/);
  });

  it("does not turn historical superseded spec wording into a current conflict", () => {
    const surface = composeFounderAttentionSurface({
      candidates: [
        specConflict({
          candidateId: "supply-a",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "diamond_supply_notes",
          proposedValue: "lab grown dias on mounting",
          currentValue: "Vlora lab-grown on mounting",
        }),
        specConflict({
          candidateId: "supply-b",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "diamond_supply_notes",
          proposedValue: "Lab Grown Diamonds with you providing the center",
          currentValue: "Vlora lab-grown on mounting",
        }),
      ],
      jobs: [],
      projects: pennockProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 0);
    assert.equal(surface.worthKnowing.length, 0);
  });

  it("keeps a current consequential spec conflict", () => {
    const surface = composeFounderAttentionSurface({
      candidates: [
        specConflict({
          candidateId: "metal-now",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
          proposedValue: "platinum",
          currentValue: "18k yellow gold",
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 1);
    assert.match(surface.needsYourDecision[0]?.headline ?? "", /metal/i);
    assert.match(surface.needsYourDecision[0]?.headline ?? "", /platinum/i);
    assert.doesNotMatch(surface.needsYourDecision[0]?.headline ?? "", /specs captured/);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("metal-now"), true);
  });

  it("does not create a false conflict from production Project historical CAD revisions", () => {
    const projects = fixtureProjects();
    projects.set(COS_LOOP_PROJECT_A, {
      ...projects.get(COS_LOOP_PROJECT_A)!,
      lifecycleStage: "production",
      specs: [{ fieldName: "cad_job_number", value: "C010657" }],
    });
    const surface = composeFounderAttentionSurface({
      candidates: [
        specConflict({
          candidateId: "cad-old",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "cad_job_number",
          proposedValue: "RN04163",
          currentValue: "C010657",
        }),
        specConflict({
          candidateId: "metal-part",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
          proposedValue: "yellow gold",
          currentValue: "14K two-tone: YG rails / WG center",
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 0);
  });

  it("suppresses a historical spec roll-up that overlaps a Top 5 action on the same Project", () => {
    const job = fixtureJob({
      jobId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      subject: "Touch base with Yvonne about bee engraving and date engraving",
    });
    const view = composeCosOperatingLoop({
      jobs: [job],
      candidates: [
        specConflict({
          candidateId: "cad-old",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "cad_job_number",
          proposedValue: "RN04163",
          currentValue: "C010657",
        }),
        specConflict({
          candidateId: "metal-part",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
          proposedValue: "white gold",
          currentValue: "14K two-tone: YG rails / WG center",
        }),
      ],
      projects: new Map([
        [
          COS_LOOP_PROJECT_A,
          {
            projectId: COS_LOOP_PROJECT_A,
            title: "Chicken ring (his) / Travis",
            personName: "Pamela",
            people: [
              { personId: PERSON_VENDOR, displayName: "Pamela" },
              { personId: PERSON_CLIENT, displayName: "Travis Morse" },
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
      ]),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    assert.equal(view.top5.length, 1);
    assert.equal(view.needsYourDecision.length, 0);
    assert.equal(view.top5[0]?.projectId, COS_LOOP_PROJECT_A);
  });

  it("keeps Candidate evidence on the object even when the conflict is backgrounded", () => {
    const rows = [
      specConflict({
        candidateId: "supply-kept",
        projectId: COS_LOOP_PROJECT_A,
        fieldName: "diamond_supply_notes",
        proposedValue: "lab grown dias on mounting",
        currentValue: "Vlora lab-grown on mounting",
      }),
      gmailRow({
        candidateId: "answer",
        candidateType: "project_context",
        payload: {
          kind: "project_context",
          topic: "design_refinement",
          value: "keep the sapphire center",
        },
      }),
    ];
    const surface = composeFounderAttentionSurface({
      candidates: rows,
      jobs: [],
      projects: pennockProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 1);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("supply-kept"), true);
    assert.equal(surface.needsYourDecision[0]?.candidateIds.includes("answer"), true);
    assert.doesNotMatch(surface.needsYourDecision[0]?.headline ?? "", /Spec conflict/);
  });

  it("attributes a confirmed Candidate person on a thread to that Person's unique Project", () => {
    const projects = fixtureProjects();
    projects.set(COS_LOOP_PROJECT_B, {
      projectId: COS_LOOP_PROJECT_B,
      title: "Matching Marquise Earrings",
      personName: "Abbey Castillo",
      people: [{ personId: PERSON_UNRESOLVED, displayName: "Abbey Castillo" }],
      isCurrent: true,
    });
    const surface = composeFounderAttentionSurface({
      candidates: [
        fixtureCandidate({
          candidateId: "person-confirmed",
          sourceRef: "gc1|earring-thread|msg-1",
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_UNRESOLVED },
          candidateType: "person_association",
          payload: {
            kind: "person_association",
            displayName: "Abbey Castillo",
            emailHash: "abc",
            mintPerson: false,
            mergePersons: false,
          },
          confidence: "high",
          reviewStatus: "approved",
          evidenceBasis: { ruleIds: ["confirmed_person"], matchedText: null },
        }),
        fixtureCandidate({
          candidateId: "answer",
          sourceRef: "gc1|earring-thread|msg-2",
          sourceSystem: "gmail",
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
      projects,
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision.length, 1);
    assert.equal(surface.needsYourDecision[0]?.projectId, COS_LOOP_PROJECT_B);
    assert.match(surface.needsYourDecision[0]?.title ?? "", /Matching Marquise Earrings/);
    assert.doesNotMatch(surface.needsYourDecision[0]?.title ?? "", /Hourglass/);
  });

  it("does not guess a Person from an unresolved email hash", () => {
    const surface = composeFounderAttentionSurface({
      candidates: [
        fixtureCandidate({
          candidateId: "guess",
          sourceRef: "gc1|loose-thread|msg-1",
          sourceSystem: "gmail",
          proposedTarget: { kind: "person", personId: PERSON_UNRESOLVED },
          candidateType: "person_association",
          payload: {
            kind: "person_association",
            displayName: "Maybe Abbey",
            emailHash: "abc",
            mintPerson: false,
            mergePersons: false,
          },
          confidence: "low",
          reviewStatus: "pending",
          evidenceBasis: { ruleIds: ["unresolved_email_hash"], matchedText: null },
        }),
        fixtureCandidate({
          candidateId: "answer",
          sourceRef: "gc1|loose-thread|msg-2",
          sourceSystem: "gmail",
          proposedTarget: { kind: "none" },
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "proposed_spec",
            value: "locking back",
          },
        }),
      ],
      jobs: [],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
      top5Ids: new Set(),
      recap: [],
      proposedActions: [],
      anomalies: [],
    });
    assert.equal(surface.needsYourDecision[0]?.projectId, null);
    assert.equal(surface.needsYourDecision[0]?.title, "Unassigned");
  });

  it("hides spec counts from the founder row and leaves Evidence as the muted evidence path", () => {
    const view = composeCosOperatingLoop({
      jobs: [],
      candidates: [
        gmailRow({
          candidateId: "answer",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "yellow gold marquise pair",
          },
        }),
        specConflict({
          candidateId: "metal-now",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "metal",
          proposedValue: "platinum",
          currentValue: "18k yellow gold",
        }),
      ],
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: view }));
    assert.doesNotMatch(html, /specs captured/);
    assert.doesNotMatch(html, /supporting notes on file/);
    assert.match(html, />Evidence<\/summary>/);
    assert.match(html, /hg-cos-evidence/);
  });
});
