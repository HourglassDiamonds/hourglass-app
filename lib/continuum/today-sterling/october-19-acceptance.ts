import type { SterlingPortfolioAssessment, SterlingTodayProposal, SterlingTodayWorkingSet } from "./types";
import { scopeDefinition } from "./scope";

export type October19AcceptanceCase = {
  id: string;
  status: "pass" | "fail" | "unverified";
  passed: boolean;
  actual: string;
  failures: readonly string[];
  workUnitIds: readonly string[];
};

export type October19AcceptanceReport = {
  passed: boolean;
  cases: readonly October19AcceptanceCase[];
  comparison: {
    priorItemCount: number;
    sterlingRecommendationCount: number;
    newlySurfacedWorkUnitIds: readonly string[];
    retiredPriorProjectIds: readonly string[];
    suppressedNoiseWorkUnitIds: readonly string[];
    relationshipProposalCount: number;
    ambiguityCount: number;
  };
};

type Definition = {
  id: string;
  scopeKey: string;
  identifiers: readonly string[];
  check: (context: CaseContext) => string[];
};

type CaseContext = {
  unit: SterlingTodayWorkingSet["workUnits"][number];
  assessment: SterlingPortfolioAssessment | null;
  recommendation: SterlingTodayProposal["recommendations"][number] | null;
  proposal: SterlingTodayProposal;
};

const text = (context: CaseContext): string => [
  context.unit.label,
  context.assessment?.explanation,
  context.assessment?.currentStage.operationalSubstage,
  ...(context.assessment?.ambiguities ?? []),
  ...(context.assessment?.obligations ?? []).map((row) => row.description),
  context.recommendation?.title,
  context.recommendation?.summary,
  context.recommendation?.explanation,
].filter(Boolean).join(" ");

const presented = (context: CaseContext): string[] => !context.assessment
  ? ["missing-assessment"]
  : context.assessment.todayDisposition !== "presented" || !context.recommendation ? ["not-presented"] : [];

const DEFINITIONS: readonly Definition[] = [
  { id: "ZANE/C026732", scopeKey: "zane", identifiers: ["C026732"], check: (context) => [
    ...presented(context),
    context.recommendation?.category !== "founder_actions" ? "wrong-category" : "",
    context.assessment?.nextStepOwner !== "founder" ? "wrong-owner" : "",
    !/oct(?:ober)?\s*22|10[/-]22/i.test(text(context)) || !/meet/i.test(text(context)) ? "october-22-meeting-missing" : "",
    !/pric|5,?700/i.test(text(context)) ? "latest-pricing-missing" : "",
    context.assessment?.obligations.some((row) => row.status === "open" && /cad/i.test(row.description))
      ? "stale-cad-obligation" : "",
  ] },
  { id: "ABBEY/C026137", scopeKey: "abbey", identifiers: ["C026137"], check: (context) => [
    ...presented(context),
    !/stone/i.test(text(context)) ? "stones-received-evidence-missing" : "",
    !context.assessment?.obligations.some((row) => (row.status === "open" || row.status === "ambiguous") &&
      /deposit|paperwork/i.test(row.description)) ? "deposit-paperwork-not-retained" : "",
  ] },
  { id: "NATHAN/C026176", scopeKey: "nathan", identifiers: ["C026176"], check: (context) => [
    !context.assessment ? "missing-assessment" : "",
    !/production|authoriz/i.test(text(context)) ? "production-authorization-missing" : "",
    context.assessment?.obligations.some((row) => row.status === "open" && /authoriz|paperwork/i.test(row.description))
      ? "completed-authorization-still-open" : "",
  ] },
  { id: "JACKIE-PADDY", scopeKey: "jackie", identifiers: [], check: (context) => [
    !/label/i.test(text(context)) ? "missing-label-commitment" : "",
    !context.assessment?.obligations.some((row) => /label/i.test(row.description) && row.status === "fulfilled")
      ? "label-fulfillment-unverified" : "",
    context.assessment?.obligations.some((row) => /label/i.test(row.description) && row.status === "open" && row.responsibleParty === "founder")
      ? "fulfilled-label-still-open" : "",
  ] },
  { id: "JAMES-RETURNING", scopeKey: "jamesReturning", identifiers: [], check: (context) => [
    ...presented(context),
    !/design|commission/i.test(text(context)) ? "new-commission-missing" : "",
    !/supplier|vendor|quote/i.test(text(context)) ? "supplier-request-missing" : "",
    !context.proposal.relationshipProposals.some((row) => row.workUnitId === context.unit.workUnitId &&
      row.kind === "associate_existing_person" && row.basis === "historical_thread_continuity")
      ? "missing-existing-person-review-proposal" : "",
    context.proposal.proposedCanonicalMutations.some((row) => row.personId != null) ? "unsupported-person-mutation" : "",
  ] },
  { id: "SARAH/C026143", scopeKey: "sarah", identifiers: ["C026143"], check: (context) => [
    ...presented(context),
    !/mod\s*9/i.test(text(context)) ? "latest-mod-version-missing" : "",
    context.assessment?.nextStepOwner !== "founder" ? "wrong-owner" : "",
  ] },
  { id: "AUDREY/C026401", scopeKey: "audrey", identifiers: ["C026401"], check: (context) => [
    ...presented(context),
    context.recommendation?.category !== "waiting_on_client" ? "wrong-category" : "",
    context.assessment?.nextStepOwner !== "client" ? "wrong-owner" : "",
    context.assessment?.obligations.some((row) => row.status === "open" && row.responsibleParty === "founder" && /cad|review|send/i.test(row.description))
      ? "stale-founder-cad-obligation" : "",
  ] },
  { id: "NOISE/NEWSLETTER", scopeKey: "noiseNewsletter", identifiers: [], check: (context) => [
    context.assessment?.todayDisposition !== "suppressed" ? "noise-not-suppressed" : "",
    context.recommendation ? "noise-recommendation-created" : "",
  ] },
  { id: "NOISE/SOLICITATION", scopeKey: "noiseSolicitation", identifiers: [], check: (context) => [
    context.assessment?.todayDisposition !== "suppressed" ? "closed-solicitation-not-suppressed" : "",
    context.recommendation ? "closed-solicitation-recommendation-created" : "",
  ] },
  { id: "NIVODA/RETURN", scopeKey: "nivodaReturn", identifiers: ["LG819625099", "NIV-2609-13392551-2", "413451"], check: (context) => [
    ...presented(context),
    !["founder_actions", "waiting_on_shop"].includes(context.recommendation?.category ?? "") ? "wrong-category" : "",
    !/ship|track|return/i.test(text(context)) ? "shipping-verification-missing" : "",
    !context.unit.typedIdentifiers.some((row) => row.kind === "certificate" && row.value === "LG819625099")
      ? "certificate-not-typed" : "",
    context.unit.typedIdentifiers.some((row) => row.kind === "project" && row.value === "LG819625099")
      ? "certificate-misclassified-as-project" : "",
  ] },
] as const;

export function evaluateOctober21Acceptance(
  workingSet: SterlingTodayWorkingSet,
  proposal: SterlingTodayProposal,
): October19AcceptanceReport {
  const assessments = new Map(proposal.portfolioAssessments.map((row) => [row.workUnitId, row]));
  const recommendations = new Map(proposal.recommendations.map((row) => [row.itemId, row]));
  const cases = DEFINITIONS.map((definition): October19AcceptanceCase => {
    const exactThreadIds = scopeDefinition(definition.scopeKey)?.exactThreadIds ?? [];
    const matches = workingSet.workUnits.filter((unit) =>
      definition.identifiers.some((identifier) => unit.observedIdentifiers.includes(identifier)) ||
      exactThreadIds.some((threadId) => unit.threadIds.includes(threadId)));
    if (matches.length !== 1) return { id: definition.id, status: matches.length === 0 ? "unverified" : "fail", passed: false,
      actual: matches.length === 0 ? "missing-work-unit" : `ambiguous-work-units:${matches.length}`,
      failures: [matches.length === 0 ? "missing-work-unit" : "ambiguous-work-unit"],
      workUnitIds: matches.map((row) => row.workUnitId) };
    const unit = matches[0]!;
    const assessment = assessments.get(unit.workUnitId) ?? null;
    const recommendation = assessment?.recommendationItemId
      ? recommendations.get(assessment.recommendationItemId) ?? null : null;
    const context = { unit, assessment, recommendation, proposal };
    const failures = definition.check(context).filter(Boolean);
    return { id: definition.id, status: failures.length === 0 ? "pass" : "fail", passed: failures.length === 0,
      actual: `disposition=${assessment?.todayDisposition ?? "missing"};category=${recommendation?.category ?? "none"};owner=${assessment?.nextStepOwner ?? "missing"}`,
      failures, workUnitIds: [unit.workUnitId] };
  });

  const priorProjectIds = new Set(workingSet.previousToday.flatMap((row) => row.projectId ? [row.projectId] : []));
  const currentProjectIds = new Set(proposal.recommendations.flatMap((row) => row.projectId ? [row.projectId] : []));
  const recommendedUnits = new Set(proposal.recommendations.map((row) => row.workUnitId));
  const noiseIds = new Set(["NOISE/NEWSLETTER", "NOISE/SOLICITATION"]);
  return {
    passed: cases.every((row) => row.status === "pass"),
    cases,
    comparison: {
      priorItemCount: workingSet.previousToday.length,
      sterlingRecommendationCount: proposal.recommendations.length,
      newlySurfacedWorkUnitIds: workingSet.workUnits.filter((row) => recommendedUnits.has(row.workUnitId) &&
        (!row.projectId || !priorProjectIds.has(row.projectId))).map((row) => row.workUnitId),
      retiredPriorProjectIds: [...priorProjectIds].filter((projectId) => !currentProjectIds.has(projectId)),
      suppressedNoiseWorkUnitIds: workingSet.workUnits.filter((row) => noiseIds.has(row.label) &&
        assessments.get(row.workUnitId)?.todayDisposition === "suppressed").map((row) => row.workUnitId),
      relationshipProposalCount: proposal.relationshipProposals.length,
      ambiguityCount: proposal.portfolioAssessments.filter((row) => row.todayDisposition === "ambiguous" || row.ambiguities.length > 0).length,
    },
  };
}

/** @deprecated Retained for the reviewed October 19 foundation API. */
export const evaluateOctober19Acceptance = evaluateOctober21Acceptance;
