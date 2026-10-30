import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySterlingFounderAuthority } from "./founder-authority";
import { validateSterlingTodayProposal } from "./validate";
import {
  STERLING_TODAY_PROPOSAL_VERSION,
  STERLING_TODAY_WORKING_SET_VERSION,
  type SterlingEvidence,
  type SterlingFounderDisposition,
  type SterlingTodayProposal,
  type SterlingTodayWorkingSet,
} from "./types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";

function directiveEvidence(input: {
  id: string;
  at: string;
  disposition?: SterlingFounderDisposition;
  stage?: "cad" | "production" | "completed";
  waitingOn?: "founder" | "client" | "vendor_shop" | "business_contact" | "unknown";
  attention?: "action_now" | "monitor" | "no_attention";
  relationshipRole?: "client" | "business_contact";
}): SterlingEvidence {
  return {
    evidenceId: input.id,
    sourceType: "founder_directive",
    sourceRef: `founder-note:${input.id}`,
    timestamp: input.at,
    direction: "outbound",
    subject: null,
    excerpt: "Founder-confirmed current state.",
    attachmentFilenames: [],
    messageId: input.id,
    threadId: null,
    projectIds: [PROJECT_ID],
    personIds: [PERSON_ID],
    provenance: "founder_correction",
    founderDirective: {
      directiveId: input.id,
      lifecycleStage: input.stage,
      waitingOn: input.waitingOn,
      attentionPriority: input.attention,
      relationshipRole: input.relationshipRole,
      disposition: input.disposition,
    },
  };
}

function workingSet(
  directives: readonly SterlingEvidence[],
  options: { withOpenJob?: boolean; lifecycleStage?: "cad" | "production" | "completed" } = {},
): SterlingTodayWorkingSet {
  return {
    contractVersion: STERLING_TODAY_WORKING_SET_VERSION,
    runId: "run-1",
    evidenceSnapshotId: "snapshot-1",
    sourceWatermark: "watermark-1",
    generatedAt: "2026-10-30T12:00:00.000Z",
    mutationMode: "shadow_read_only",
    people: [{ personId: PERSON_ID, displayName: "JP", roles: ["client"], organizationName: null, emailHashes: [] }],
    projects: [{
      projectId: PROJECT_ID,
      title: "JP commission",
      projectKind: "custom_new_jewelry",
      lifecycleStage: options.lifecycleStage ?? "cad",
      recordVersion: "project-v1",
      people: [{ personId: PERSON_ID, relationshipRole: "client" }],
      specs: [],
      openJobIds: options.withOpenJob ? [JOB_ID] : [],
      gmailThreadIds: [],
    }],
    jobs: options.withOpenJob ? [{
      jobId: JOB_ID,
      projectId: PROJECT_ID,
      associatedPersonId: PERSON_ID,
      kind: "required_action",
      subject: "Advance JP project",
      detail: null,
      responsibleParty: "founder",
      state: "open",
      dueAt: null,
      deferredUntil: null,
      sourceRef: directives[0]?.sourceRef ?? null,
      recordVersion: "job-v1",
    }] : [],
    evidence: directives,
    workUnits: [{
      workUnitId: `project:${PROJECT_ID}`,
      kind: "canonical_project",
      identityBasis: "canonical_project",
      projectId: PROJECT_ID,
      label: "JP commission",
      observedIdentifiers: ["C026900"],
      typedIdentifiers: [{ kind: "project", value: "C026900" }],
      threadIds: [],
      sourceRefs: directives.map((row) => row.sourceRef),
      evidenceRefs: directives.map((row) => row.evidenceId),
    }],
    calendarAvailability: { status: "disabled", reason: "test" },
    calendar: [],
    previousToday: [],
  };
}

function proposal(evidenceId: string): SterlingTodayProposal {
  return {
    contractVersion: STERLING_TODAY_PROPOSAL_VERSION,
    runId: "run-1",
    evidenceSnapshotId: "snapshot-1",
    generatedAt: "2026-10-30T12:00:00.000Z",
    portfolioAssessments: [{
      workUnitId: `project:${PROJECT_ID}`,
      projectId: PROJECT_ID,
      identityStatus: "canonical_project",
      todayDisposition: "presented",
      recommendationItemId: "jp-action",
      currentStage: {
        canonicalLifecycleStage: "cad",
        operationalSubstage: null,
        responsibleParty: "founder",
        confidence: "medium",
        explanation: "Older evidence.",
        evidenceRefs: [evidenceId],
      },
      obligations: [{
        obligationId: "jp-obligation",
        description: "Review the project.",
        status: "open",
        responsibleParty: "founder",
        confidence: "medium",
        evidenceRefs: [evidenceId],
      }],
      nextStepOwner: "founder",
      attentionPriority: "action_now",
      confidence: "medium",
      evidenceRefs: [evidenceId],
      ambiguities: ["Older evidence may be stale."],
      explanation: "Older evidence.",
      omissionReason: null,
    }],
    recommendations: [{
      itemId: "jp-action",
      workUnitId: `project:${PROJECT_ID}`,
      category: "founder_actions",
      projectId: PROJECT_ID,
      personId: PERSON_ID,
      relationshipRole: "client",
      title: "Review JP",
      summary: "Review the project.",
      attentionPriority: "action_now",
      confidence: "medium",
      explanation: "Older evidence.",
      evidenceRefs: [evidenceId],
      ambiguities: [],
      obligations: [],
    }],
    relationshipProposals: [],
    proposedCanonicalMutations: [],
    portfolioAmbiguities: [],
  };
}

describe("Sterling founder authority", () => {
  it("suppresses a founder-confirmed closure without deleting obligation history", () => {
    const evidence = directiveEvidence({
      id: "founder-closure",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "completed",
      stage: "completed",
      waitingOn: "unknown",
      attention: "no_attention",
    });
    const set = workingSet([evidence]);
    const reconciled = applySterlingFounderAuthority(set, proposal(evidence.evidenceId));
    assert.equal(reconciled.recommendations.length, 0);
    assert.equal(reconciled.portfolioAssessments[0]?.todayDisposition, "suppressed");
    assert.equal(reconciled.portfolioAssessments[0]?.currentStage.canonicalLifecycleStage, "completed");
    assert.equal(reconciled.portfolioAssessments[0]?.obligations[0]?.status, "superseded");
    assert.match(reconciled.portfolioAssessments[0]?.omissionReason ?? "", /History is retained/);
    assert.equal(validateSterlingTodayProposal(set, reconciled).accepted, true);
  });

  it("keeps CAD lifecycle independent from waiting on the client", () => {
    const evidence = directiveEvidence({
      id: "founder-cad-client",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "active",
      stage: "cad",
      waitingOn: "client",
      attention: "monitor",
    });
    const set = workingSet([evidence]);
    const reconciled = applySterlingFounderAuthority(set, proposal(evidence.evidenceId));
    const assessment = reconciled.portfolioAssessments[0]!;
    assert.equal(assessment.currentStage.canonicalLifecycleStage, "cad");
    assert.equal(assessment.nextStepOwner, "client");
    assert.equal(assessment.attentionPriority, "monitor");
    assert.equal(reconciled.recommendations[0]?.category, "waiting_on_client");
    assert.equal(validateSterlingTodayProposal(set, reconciled).accepted, true);
  });

  it("creates validated founder-review proposals for lifecycle and waiting-on corrections", () => {
    const evidence = directiveEvidence({
      id: "founder-production-shop",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "active",
      stage: "production",
      waitingOn: "vendor_shop",
      attention: "monitor",
    });
    const set = workingSet([evidence], { withOpenJob: true });
    const reconciled = applySterlingFounderAuthority(set, proposal(evidence.evidenceId));
    assert.deepEqual(
      reconciled.proposedCanonicalMutations.map((row) => row.kind).sort(),
      ["set_project_lifecycle", "update_open_job_holder"],
    );
    const validation = validateSterlingTodayProposal(set, reconciled);
    assert.equal(validation.accepted, true);
    assert.deepEqual(validation.mutationValidations.map((row) => row.status), [
      "approved_for_founder_review",
      "approved_for_founder_review",
    ]);
  });

  it("does not guess which canonical job owns a waiting-on correction", () => {
    const evidence = directiveEvidence({
      id: "founder-ambiguous-jobs",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "active",
      stage: "cad",
      waitingOn: "vendor_shop",
      attention: "monitor",
    });
    const set = workingSet([evidence], { withOpenJob: true });
    set.jobs = [...set.jobs, { ...set.jobs[0]!, jobId: "44444444-4444-4444-8444-444444444444" }];
    const reconciled = applySterlingFounderAuthority(set, proposal(evidence.evidenceId));
    assert.equal(reconciled.proposedCanonicalMutations.some(
      (row) => row.kind === "update_open_job_holder",
    ), false);
  });

  it("proposes canonical completion and open-job resolution without applying either", () => {
    const evidence = directiveEvidence({
      id: "founder-complete",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "completed",
      stage: "completed",
      waitingOn: "unknown",
      attention: "no_attention",
    });
    const set = workingSet([evidence], { withOpenJob: true });
    const reconciled = applySterlingFounderAuthority(set, proposal(evidence.evidenceId));
    assert.deepEqual(
      reconciled.proposedCanonicalMutations.map((row) => row.kind).sort(),
      ["resolve_open_job", "set_project_lifecycle"],
    );
    assert.equal(validateSterlingTodayProposal(set, reconciled).mutationValidations.every(
      (row) => row.status === "approved_for_founder_review",
    ), true);
  });

  it("uses the newest founder directive and preserves contact type as a separate axis", () => {
    const older = directiveEvidence({
      id: "founder-old",
      at: "2026-10-29T13:00:00.000Z",
      disposition: "active",
      stage: "cad",
      waitingOn: "founder",
      attention: "action_now",
    });
    const newer = directiveEvidence({
      id: "founder-new",
      at: "2026-10-30T13:00:00.000Z",
      disposition: "operational_non_client",
      stage: "cad",
      waitingOn: "business_contact",
      attention: "monitor",
      relationshipRole: "business_contact",
    });
    const set = workingSet([older, newer]);
    const reconciled = applySterlingFounderAuthority(set, proposal(older.evidenceId));
    assert.equal(reconciled.portfolioAssessments[0]?.nextStepOwner, "business_contact");
    assert.equal(reconciled.recommendations[0]?.relationshipRole, "business_contact");
    assert.equal(reconciled.recommendations[0]?.attentionPriority, "monitor");
    assert.deepEqual(reconciled.recommendations.map((row) => row.workUnitId), [`project:${PROJECT_ID}`]);
    assert.equal(validateSterlingTodayProposal(set, reconciled).accepted, true);
  });
});
