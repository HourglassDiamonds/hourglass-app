import type { SterlingPortfolioAssessment, SterlingTodayProposal, SterlingTodayWorkingSet } from "./types";

export type October19AcceptanceCase = {
  id: string;
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
  identifiers: readonly string[];
  label: string;
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
  { id: "ZANE/C026732", identifiers: ["C026732"], label: "ZANE/C026732", check: (context) => [
    ...presented(context),
    context.recommendation?.category !== "founder_actions" ? "wrong-category" : "",
    context.assessment?.nextStepOwner !== "founder" ? "wrong-owner" : "",
    !context.assessment?.obligations.some((row) => row.status === "open" && row.responsibleParty === "founder" && /pric|follow/i.test(row.description))
      ? "missing-founder-pricing-obligation" : "",
    !context.assessment?.obligations.some((row) => (row.status === "open" || row.status === "ambiguous") &&
      row.responsibleParty === "vendor_shop" && /quot|pric/i.test(row.description)) ? "missing-vendor-quote-obligation" : "",
  ] },
  { id: "JACKIE-PADDY", identifiers: [], label: "JACKIE-PADDY", check: (context) => [
    ...presented(context),
    context.assessment?.nextStepOwner !== "founder" ? "wrong-owner" : "",
    !/label/i.test(text(context)) ? "missing-label-commitment" : "",
    (context.assessment?.ambiguities.length ?? 0) === 0 ? "missing-date-ambiguity" : "",
  ] },
  { id: "JAMES-RETURNING", identifiers: [], label: "JAMES-RETURNING", check: (context) => [
    ...presented(context),
    !context.proposal.relationshipProposals.some((row) => row.workUnitId === context.unit.workUnitId &&
      row.kind === "associate_existing_person" && row.basis === "historical_thread_continuity")
      ? "missing-existing-person-review-proposal" : "",
    context.proposal.proposedCanonicalMutations.some((row) => row.personId != null) ? "unsupported-person-mutation" : "",
  ] },
  { id: "SARAH/C026143", identifiers: ["C026143"], label: "SARAH/C026143", check: (context) => [
    ...presented(context),
    !/mod\s*8/i.test(text(context)) ? "latest-mod-version-missing" : "",
    context.assessment?.nextStepOwner !== "founder" ? "wrong-owner" : "",
  ] },
  { id: "AUDREY/C026401", identifiers: ["C026401"], label: "AUDREY/C026401", check: (context) => [
    ...presented(context),
    context.recommendation?.category !== "waiting_on_client" ? "wrong-category" : "",
    context.assessment?.nextStepOwner !== "client" ? "wrong-owner" : "",
    context.assessment?.obligations.some((row) => row.status === "open" && row.responsibleParty === "founder" && /cad|review|send/i.test(row.description))
      ? "stale-founder-cad-obligation" : "",
  ] },
  { id: "NOISE/NEWSLETTER", identifiers: [], label: "NOISE/NEWSLETTER", check: (context) => [
    context.assessment?.todayDisposition !== "suppressed" ? "noise-not-suppressed" : "",
    context.recommendation ? "noise-recommendation-created" : "",
  ] },
  { id: "NOISE/SOLICITATION", identifiers: [], label: "NOISE/SOLICITATION", check: (context) => [
    context.assessment?.todayDisposition !== "suppressed" ? "closed-solicitation-not-suppressed" : "",
    context.recommendation ? "closed-solicitation-recommendation-created" : "",
  ] },
  { id: "NIVODA/RETURN", identifiers: ["LG819625099", "NIV-2609-13392551-2", "413451"], label: "NIVODA/RETURN", check: (context) => [
    ...presented(context),
    !["founder_actions", "waiting_on_shop"].includes(context.recommendation?.category ?? "") ? "wrong-category" : "",
    !/ship|track|return/i.test(text(context)) ? "shipping-verification-missing" : "",
    !context.unit.typedIdentifiers.some((row) => row.kind === "certificate" && row.value === "LG819625099")
      ? "certificate-not-typed" : "",
    context.unit.typedIdentifiers.some((row) => row.kind === "project" && row.value === "LG819625099")
      ? "certificate-misclassified-as-project" : "",
  ] },
] as const;

export function evaluateOctober19Acceptance(
  workingSet: SterlingTodayWorkingSet,
  proposal: SterlingTodayProposal,
): October19AcceptanceReport {
  const assessments = new Map(proposal.portfolioAssessments.map((row) => [row.workUnitId, row]));
  const recommendations = new Map(proposal.recommendations.map((row) => [row.itemId, row]));
  const cases = DEFINITIONS.map((definition): October19AcceptanceCase => {
    const matches = workingSet.workUnits.filter((unit) =>
      unit.label === definition.label || definition.identifiers.some((identifier) => unit.observedIdentifiers.includes(identifier)));
    if (matches.length !== 1) return { id: definition.id, passed: false,
      actual: matches.length === 0 ? "missing-work-unit" : `ambiguous-work-units:${matches.length}`,
      failures: [matches.length === 0 ? "missing-work-unit" : "ambiguous-work-unit"],
      workUnitIds: matches.map((row) => row.workUnitId) };
    const unit = matches[0]!;
    const assessment = assessments.get(unit.workUnitId) ?? null;
    const recommendation = assessment?.recommendationItemId
      ? recommendations.get(assessment.recommendationItemId) ?? null : null;
    const context = { unit, assessment, recommendation, proposal };
    const failures = definition.check(context).filter(Boolean);
    return { id: definition.id, passed: failures.length === 0,
      actual: `disposition=${assessment?.todayDisposition ?? "missing"};category=${recommendation?.category ?? "none"};owner=${assessment?.nextStepOwner ?? "missing"}`,
      failures, workUnitIds: [unit.workUnitId] };
  });

  const priorProjectIds = new Set(workingSet.previousToday.flatMap((row) => row.projectId ? [row.projectId] : []));
  const currentProjectIds = new Set(proposal.recommendations.flatMap((row) => row.projectId ? [row.projectId] : []));
  const recommendedUnits = new Set(proposal.recommendations.map((row) => row.workUnitId));
  const noiseIds = new Set(["NOISE/NEWSLETTER", "NOISE/SOLICITATION"]);
  return {
    passed: cases.every((row) => row.passed),
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
