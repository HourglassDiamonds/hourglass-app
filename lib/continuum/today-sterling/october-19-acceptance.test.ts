import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateOctober19Acceptance } from "./october-19-acceptance";
import {
  STERLING_TODAY_PROPOSAL_VERSION,
  STERLING_TODAY_WORKING_SET_VERSION,
  type SterlingPortfolioAssessment,
  type SterlingTodayProposal,
  type SterlingTodayWorkingSet,
} from "./types";

const cases = [
  ["zane", "ZANE/C026732", ["C026732"]],
  ["jackie", "JACKIE-PADDY", []],
  ["james", "JAMES-RETURNING", []],
  ["sarah", "SARAH/C026143", ["C026143"]],
  ["audrey", "AUDREY/C026401", ["C026401"]],
  ["newsletter", "NOISE/NEWSLETTER", []],
  ["solicitation", "NOISE/SOLICITATION", []],
  ["nivoda", "NIVODA/RETURN", ["LG819625099", "NIV-2609-13392551-2", "413451"]],
] as const;

function fixture(): { workingSet: SterlingTodayWorkingSet; proposal: SterlingTodayProposal } {
  const workUnits = cases.map(([id, label, identifiers]) => ({
    workUnitId: `provisional:${id}`,
    kind: "provisional_evidence" as const,
    identityBasis: "scoped_evidence_group" as const,
    projectId: null,
    label,
    observedIdentifiers: [...identifiers],
    typedIdentifiers: id === "nivoda" ? [
      { kind: "certificate" as const, value: "LG819625099" },
      { kind: "order" as const, value: "NIV-2609-13392551-2" },
      { kind: "request" as const, value: "413451" },
    ] : identifiers.map((value) => ({ kind: "project" as const, value })),
    threadIds: [`thread:${id}`],
    sourceRefs: [`source:${id}`],
    evidenceRefs: [`evidence:${id}`],
  }));
  const workingSet: SterlingTodayWorkingSet = {
    contractVersion: STERLING_TODAY_WORKING_SET_VERSION,
    runId: "october-19", evidenceSnapshotId: "snapshot", sourceWatermark: "watermark",
    generatedAt: "2026-10-19T12:00:00.000Z", mutationMode: "shadow_read_only",
    people: [{ personId: "3c845863-81c3-4391-9346-1dd18091c0af", displayName: "Existing person",
      roles: ["client"], organizationName: null, emailHashes: ["a".repeat(64)] }],
    projects: [], jobs: [], workUnits,
    evidence: cases.map(([id]) => ({ evidenceId: `evidence:${id}`, sourceType: "gmail" as const,
      sourceRef: `source:${id}`, timestamp: "2026-10-18T12:00:00.000Z", direction: "inbound" as const,
      subject: null, excerpt: null, attachmentFilenames: [], messageId: `message:${id}`, threadId: `thread:${id}`,
      projectIds: [], personIds: [], provenance: "live_quote_stripped_current_message" })),
    calendarAvailability: { status: "unavailable", reason: "not-required" }, calendar: [],
    previousToday: [{ itemId: "old", category: "queued", projectId: null, summary: "Deterministic item" }],
  };
  const assessment = (id: string, owner: SterlingPortfolioAssessment["nextStepOwner"],
    disposition: SterlingPortfolioAssessment["todayDisposition"] = "presented",
    obligations: SterlingPortfolioAssessment["obligations"] = [], ambiguities: string[] = [], explanation = "Evidence reviewed."): SterlingPortfolioAssessment => ({
      workUnitId: `provisional:${id}`, projectId: null, identityStatus: "provisional_evidence", todayDisposition: disposition,
      recommendationItemId: disposition === "presented" ? `recommendation:${id}` : null,
      currentStage: { canonicalLifecycleStage: null, operationalSubstage: null, responsibleParty: owner,
        confidence: "high", explanation, evidenceRefs: [`evidence:${id}`] },
      obligations, nextStepOwner: owner, confidence: "high", evidenceRefs: [`evidence:${id}`], ambiguities,
      explanation, omissionReason: disposition === "presented" ? null : "Not actionable operational evidence.",
    });
  const obligation = (id: string, description: string, responsibleParty: "founder" | "vendor_shop" | "client",
    status: "open" | "fulfilled" | "superseded" | "ambiguous" = "open") => ({ obligationId: `${id}:${description}`,
      description, status, responsibleParty, confidence: "high" as const, evidenceRefs: [`evidence:${id}`] });
  const portfolioAssessments = [
    assessment("zane", "founder", "presented", [obligation("zane", "Check natural-diamond pricing", "founder"),
      obligation("zane", "Vendor quote remains pending", "vendor_shop")]),
    assessment("jackie", "founder", "presented", [obligation("jackie", "Send the promised return label", "founder")],
      ["The relative Monday date is unresolved from the available context."]),
    assessment("james", "founder", "presented", [obligation("james", "Review returning-client design inquiry", "founder")]),
    assessment("sarah", "founder", "presented", [obligation("sarah", "Review updated Mod 8 CAD", "founder")]),
    assessment("audrey", "client", "presented", [obligation("audrey", "Respond to delivered CAD", "client")]),
    assessment("newsletter", "unknown", "suppressed"),
    assessment("solicitation", "unknown", "suppressed"),
    assessment("nivoda", "vendor_shop", "presented", [obligation("nivoda", "Confirm return shipment or tracking", "vendor_shop")]),
  ];
  const recommendations = portfolioAssessments.flatMap((row) => row.recommendationItemId ? [{
    itemId: row.recommendationItemId, workUnitId: row.workUnitId,
    category: row.workUnitId.endsWith("audrey") ? "waiting_on_client" as const
      : row.workUnitId.endsWith("nivoda") ? "waiting_on_shop" as const : "founder_actions" as const,
    projectId: null, personId: null, relationshipRole: "unknown" as const,
    title: row.explanation, summary: row.obligations.map((item) => item.description).join("; "),
    confidence: "high" as const, explanation: row.explanation, evidenceRefs: row.evidenceRefs,
    ambiguities: row.ambiguities, obligations: row.obligations,
  }] : []);
  const proposal: SterlingTodayProposal = {
    contractVersion: STERLING_TODAY_PROPOSAL_VERSION, runId: workingSet.runId,
    evidenceSnapshotId: workingSet.evidenceSnapshotId, generatedAt: workingSet.generatedAt,
    portfolioAssessments, recommendations,
    relationshipProposals: [{ proposalKey: "james-person", kind: "associate_existing_person",
      workUnitId: "provisional:james", personId: "3c845863-81c3-4391-9346-1dd18091c0af", projectId: null,
      threadIds: ["thread:james"], basis: "historical_thread_continuity", confidence: "high",
      reason: "Verified sender continues the historical thread.", evidenceRefs: ["evidence:james"], requiresFounderApproval: true }],
    proposedCanonicalMutations: [], portfolioAmbiguities: [],
  };
  return { workingSet, proposal };
}

describe("October 19 Sterling acceptance diagnostics", () => {
  it("distinguishes actionable work, identity review, ambiguity, and noise suppression", () => {
    const { workingSet, proposal } = fixture();
    const report = evaluateOctober19Acceptance(workingSet, proposal);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 8);
    assert.equal(report.comparison.suppressedNoiseWorkUnitIds.length, 2);
    assert.equal(report.comparison.relationshipProposalCount, 1);
  });

  it("does not count schema-valid stale obligations or surfaced noise as semantic passes", () => {
    const { workingSet, proposal } = fixture();
    const audrey = proposal.portfolioAssessments.find((row) => row.workUnitId === "provisional:audrey")!;
    audrey.obligations = [...audrey.obligations, { obligationId: "stale", description: "Founder review CAD",
      status: "open", responsibleParty: "founder", confidence: "high", evidenceRefs: ["evidence:audrey"] }];
    const newsletter = proposal.portfolioAssessments.find((row) => row.workUnitId === "provisional:newsletter")!;
    newsletter.todayDisposition = "presented";
    newsletter.recommendationItemId = "recommendation:newsletter";
    newsletter.omissionReason = null;
    proposal.recommendations = [...proposal.recommendations, { itemId: "recommendation:newsletter", workUnitId: newsletter.workUnitId,
      category: "founder_actions", projectId: null, personId: null, relationshipRole: "unknown", title: "Newsletter",
      summary: "Forward this email", confidence: "low", explanation: "Noise", evidenceRefs: ["evidence:newsletter"],
      ambiguities: [], obligations: [] }];
    const report = evaluateOctober19Acceptance(workingSet, proposal);
    assert.equal(report.passed, false);
    assert.ok(report.cases.find((row) => row.id === "AUDREY/C026401")?.failures.includes("stale-founder-cad-obligation"));
    assert.ok(report.cases.find((row) => row.id === "NOISE/NEWSLETTER")?.failures.includes("noise-not-suppressed"));
  });
});
