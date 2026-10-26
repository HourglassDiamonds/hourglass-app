import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import { diagnoseSterlingTargetChronology } from "./target-chronology";
import { buildSterlingTodayTargetWorkingSet } from "./target";
import {
  prepareSarahSemanticPackage,
  STERLING_TODAY_SARAH_LATEST_REQUIRED_AT,
  STERLING_TODAY_SARAH_PROJECT_ID,
  STERLING_TODAY_SARAH_THREAD_ID,
} from "./sarah-semantic";
import type { SterlingTodayAssembly } from "./server-runner";
import { validateSterlingTodayProposal } from "./validate";
import {
  STERLING_TODAY_PROPOSAL_VERSION,
  type SterlingTodayProposal,
} from "./types";
import { buildSterlingTodayWorkingSet } from "./working-set";

const WORK_UNIT_ID = `project:${STERLING_TODAY_SARAH_PROJECT_ID}`;

function sarahProject(): ProjectDeskSummary {
  return {
    projectId: STERLING_TODAY_SARAH_PROJECT_ID,
    title: "Sarah / C026143",
    projectKind: "custom_new_jewelry",
    people: [],
    specs: [{ fieldName: "cad_job_number", label: "CAD", value: "C026143" }],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: { people: "missing", specs: "available", notes: "none", jobs: "none", files: "none", email: "not-connected" },
    recordCreatedAt: "2026-10-01T12:00:00.000Z",
    projectWork: {} as ProjectDeskSummary["projectWork"],
    lifecycleStage: "cad",
    lifecycleLabel: "CAD",
    gmailThreadId: STERLING_TODAY_SARAH_THREAD_ID,
  };
}

function diagnostic(outcome: "operational_current_text" | "non_operational_current_text", attachments = false) {
  return {
    outcome,
    decodingSucceeded: true,
    currentMessageTextFound: true,
    operationalTextRecognized: outcome === "operational_current_text",
    attachmentMetadataPresent: attachments,
    providerFallbackAffectedExtraction: false,
    extractionUncertain: false,
  } as const;
}

function candidate(messageId: string): ContinuumCandidate {
  return {
    candidateId: "candidate-non-operational",
    sourceSystem: "gmail",
    sourceRef: `gmail:thread:${STERLING_TODAY_SARAH_THREAD_ID}:message:${messageId}`,
    sourceTimestamp: "2026-10-21T17:00:00.000Z",
    candidateType: "note",
    proposedTarget: { kind: "project", projectId: STERLING_TODAY_SARAH_PROJECT_ID },
    payload: { kind: "note", text: "INDEXED CANDIDATE MUST NOT REPLACE LIVE TEXT", contextLayer: null },
    confidence: "low",
    evidenceBasis: { ruleIds: ["fixture"], matchedText: "INDEXED CANDIDATE MUST NOT REPLACE LIVE TEXT" },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-10-21T17:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "fixture",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

describe("Sterling verified non-operational provenance", () => {
  it("keeps verified conversational text live without substituting indexed candidate prose", () => {
    const messageId = "message_non_operational";
    const set = buildSterlingTodayWorkingSet({
      runId: "run-non-operational",
      sourceWatermark: "watermark",
      generatedAt: "2026-10-21T18:00:00.000Z",
      projects: [sarahProject()],
      jobs: [],
      candidates: [candidate(messageId)],
      knownPeople: [],
      threadContext: new Map([[STERLING_TODAY_SARAH_THREAD_ID, {
        messages: [{
          messageId,
          sentAt: "2026-10-21T17:00:00.000Z",
          direction: "inbound",
          verifiedCurrentMessageText: "Sounds good, thank you.",
          operationalText: null,
          liveExtractionDiagnostic: diagnostic("non_operational_current_text", true),
          attachmentFilenames: ["fixture.stl"],
        }],
      }]]),
    });
    const row = set.evidence.find((evidence) => evidence.messageId === messageId)!;
    assert.equal(row.provenance, "indexed_gmail+live_quote_stripped_current_message");
    assert.equal(row.excerpt, "Sounds good, thank you.");
    assert.equal(row.contentClassification, "non_operational_current_text");
    assert.equal(row.attachmentEvidence, "verified_metadata_presence");
    assert.doesNotMatch(row.excerpt ?? "", /INDEXED CANDIDATE/);
  });

  it("keeps failed or ambiguous extraction blocked instead of trusting a live flag", () => {
    const set = buildSterlingTodayWorkingSet({
      runId: "run-uncertain",
      sourceWatermark: "watermark",
      generatedAt: "2026-10-21T18:00:00.000Z",
      projects: [sarahProject()],
      jobs: [],
      candidates: [],
      knownPeople: [],
      threadContext: new Map([[STERLING_TODAY_SARAH_THREAD_ID, { messages: [{
        messageId: "message_uncertain",
        sentAt: "2026-10-21T17:00:00.000Z",
        direction: "inbound",
        verifiedCurrentMessageText: null,
        operationalText: null,
        liveExtractionDiagnostic: {
          outcome: "ambiguous_quote_stripping",
          decodingSucceeded: true,
          currentMessageTextFound: true,
          operationalTextRecognized: false,
          attachmentMetadataPresent: false,
          providerFallbackAffectedExtraction: false,
          extractionUncertain: true,
        },
      }] }]]),
    });
    const row = set.evidence.find((evidence) => evidence.messageId === "message_uncertain")!;
    assert.equal(row.provenance, "indexed_gmail+candidate_excerpt");
    assert.equal(diagnoseSterlingTargetChronology({
      evidence: [row],
      requiredThreadIds: [STERLING_TODAY_SARAH_THREAD_ID],
      referencedEvidenceIds: [row.evidenceId],
      indexedMessageCount: 1,
      liveMessageCount: 1,
      includedMessageCount: 1,
    }).provenanceMismatchCount, 1);
  });

  it("preserves quote-only and attachment-only chronology without granting claim authority", () => {
    const messages = [
      {
        messageId: "message_quote_only",
        sentAt: "2026-10-21T16:00:00.000Z",
        direction: "inbound" as const,
        verifiedCurrentMessageText: null,
        operationalText: null,
        liveExtractionDiagnostic: {
          outcome: "quote_only_current_content" as const,
          decodingSucceeded: true,
          currentMessageTextFound: false,
          operationalTextRecognized: false,
          attachmentMetadataPresent: false,
          providerFallbackAffectedExtraction: false,
          extractionUncertain: false,
        },
      },
      {
        messageId: "message_attachment_only",
        sentAt: "2026-10-21T17:00:00.000Z",
        direction: "outbound" as const,
        verifiedCurrentMessageText: null,
        operationalText: null,
        liveExtractionDiagnostic: {
          outcome: "attachment_only" as const,
          decodingSucceeded: true,
          currentMessageTextFound: false,
          operationalTextRecognized: false,
          attachmentMetadataPresent: true,
          providerFallbackAffectedExtraction: false,
          extractionUncertain: false,
        },
        attachmentFilenames: ["fixture.stl"],
      },
    ];
    const set = buildSterlingTodayWorkingSet({
      runId: "run-context-only",
      sourceWatermark: "watermark",
      generatedAt: "2026-10-21T18:00:00.000Z",
      projects: [sarahProject()], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([[STERLING_TODAY_SARAH_THREAD_ID, { messages }]]),
    });
    const rows = set.evidence.filter((row) => row.sourceType === "gmail");
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.provenance === "indexed_gmail+live_quote_stripped_current_message"));
    assert.ok(rows.every((row) => row.excerpt === null));
    assert.equal(rows[0]!.attachmentEvidence, "none");
    assert.equal(rows[1]!.attachmentEvidence, "verified_metadata_presence");
    assert.equal(diagnoseSterlingTargetChronology({
      evidence: rows,
      requiredThreadIds: [STERLING_TODAY_SARAH_THREAD_ID],
      referencedEvidenceIds: rows.map((row) => row.evidenceId),
      indexedMessageCount: 2,
      liveMessageCount: 2,
      includedMessageCount: 2,
    }).provenanceMismatchCount, 0);
  });

  it("admits a 50-message Sarah chronology with four contextual messages without weakening citations", () => {
    const latest = Date.parse(STERLING_TODAY_SARAH_LATEST_REQUIRED_AT);
    const messages = Array.from({ length: 50 }, (_, index) => {
      const nonOperational = index < 4;
      const isLatest = index === 49;
      return {
        messageId: `message_${String(index + 1).padStart(2, "0")}`,
        sentAt: new Date(latest - (49 - index) * 60_000).toISOString(),
        direction: index % 2 === 0 ? "inbound" as const : "outbound" as const,
        subject: isLatest ? "Mod 9 CAD and STL" : null,
        operationalText: nonOperational ? null : isLatest
          ? "Updated Mod 9 STL attached for review."
          : "CAD revision received.",
        verifiedCurrentMessageText: nonOperational ? "Thank you, received." : "CAD revision received.",
        liveExtractionDiagnostic: diagnostic(
          nonOperational ? "non_operational_current_text" : "operational_current_text",
          nonOperational || isLatest,
        ),
        attachmentFilenames: isLatest ? ["mod9.stl"] : nonOperational ? ["context.pdf"] : [],
      };
    });
    const set = buildSterlingTodayWorkingSet({
      runId: "run-sarah-50",
      sourceWatermark: "watermark",
      generatedAt: "2026-10-21T18:00:00.000Z",
      projects: [sarahProject()], jobs: [], candidates: [], knownPeople: [],
      threadContext: new Map([[STERLING_TODAY_SARAH_THREAD_ID, { messages }]]),
    });
    const target = buildSterlingTodayTargetWorkingSet(set, WORK_UNIT_ID, {
      reviewedRequiredThreadIds: [STERLING_TODAY_SARAH_THREAD_ID],
    });
    const gmailEvidence = target.evidence.filter((row) => row.sourceType === "gmail");
    const chronologyInvariant = diagnoseSterlingTargetChronology({
      evidence: gmailEvidence,
      requiredThreadIds: [STERLING_TODAY_SARAH_THREAD_ID],
      referencedEvidenceIds: target.workUnits[0]!.evidenceRefs,
      indexedMessageCount: 50,
      liveMessageCount: 50,
      includedMessageCount: 50,
    });
    const assembly = {
      target: { caseId: "SARAH/C026143", selectedWorkUnitId: WORK_UNIT_ID, relatedWorkUnitIds: [WORK_UNIT_ID] },
      targetBlockedReason: null,
      targetDiagnostics: {
        selectedWorkUnitId: WORK_UNIT_ID,
        secondaryWorkUnitIds: [],
        requiredThreadCount: 1,
        scheduledThreadCount: 1,
        successfullyLiveRetrievedThreadCount: 1,
        missingOrFailedThreadCount: 0,
        providerFailedThreadCount: 0,
        budgetDeferredThreadCount: 0,
        requiredIndexedMessageCount: 50,
        successfullyLiveRetrievedMessageCount: 50,
        includedEvidenceMessageCount: 50,
        excludedOrAmbiguousAssociationCount: 0,
        stoppedAtStage: null,
        latestVerifiedSourceAt: STERLING_TODAY_SARAH_LATEST_REQUIRED_AT,
        chronologyInvariant,
        complete: true,
      },
      workingSet: set,
      requestWorkingSet: target,
    } as unknown as SterlingTodayAssembly;
    const preflight = prepareSarahSemanticPackage(assembly);
    assert.equal(chronologyInvariant.provenanceMismatchCount, 0);
    assert.equal(gmailEvidence.filter((row) => row.contentClassification === "non_operational_current_text").length, 4);
    assert.equal(preflight.ok, true);
    assert.equal(preflight.diagnostics.requestByteCeilingPassed, true);
    assert.ok((preflight.diagnostics.serializedRequestBytes ?? Number.POSITIVE_INFINITY) <= 64_000);

    const contextual = gmailEvidence.find((row) => row.contentClassification === "non_operational_current_text")!;
    const operational = gmailEvidence.find((row) => row.contentClassification === "operational_current_text")!;
    const proposal = {
      contractVersion: STERLING_TODAY_PROPOSAL_VERSION,
      runId: target.runId,
      evidenceSnapshotId: target.evidenceSnapshotId,
      generatedAt: target.generatedAt,
      portfolioAssessments: [{
        workUnitId: WORK_UNIT_ID,
        projectId: STERLING_TODAY_SARAH_PROJECT_ID,
        identityStatus: "canonical_project",
        todayDisposition: "suppressed",
        recommendationItemId: null,
        currentStage: { canonicalLifecycleStage: "cad", operationalSubstage: null,
          responsibleParty: "vendor_shop", confidence: "medium",
          explanation: "Context alone cannot establish an operational change.", evidenceRefs: [contextual.evidenceId] },
        obligations: [],
        nextStepOwner: "unknown",
        confidence: "low",
        evidenceRefs: [contextual.evidenceId],
        ambiguities: ["Operational status is not established by this acknowledgment."],
        explanation: "Context retained without creating an action.",
        omissionReason: "No supported action.",
      }],
      recommendations: [], relationshipProposals: [], proposedCanonicalMutations: [], portfolioAmbiguities: [],
    } satisfies SterlingTodayProposal;
    const blocked = validateSterlingTodayProposal(target, proposal);
    assert.ok(blocked.errors.includes(`insufficient-operational-evidence:current-stage:${WORK_UNIT_ID}`));
    proposal.portfolioAssessments[0].currentStage.evidenceRefs = [contextual.evidenceId, operational.evidenceId];
    assert.equal(validateSterlingTodayProposal(target, proposal).accepted, true);
  });
});
