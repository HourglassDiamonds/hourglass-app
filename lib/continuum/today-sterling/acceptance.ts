import type { SterlingPortfolioAssessment, SterlingTodayProposal, SterlingTodayWorkingSet } from "./types";

export type SterlingAcceptanceOutcome = "pass" | "input_missing" | "identity_ambiguous" | "legitimate_ambiguity" |
  "missing_output" | "omitted_from_today" | "wrong_category" | "wrong_responsible_party" |
  "project_stage_mismatch" | "obligation_mismatch" | "insufficient_evidence";
export type SterlingAcceptanceCase = {
  id: string; passed: boolean; outcome: SterlingAcceptanceOutcome; actual: string; expected: string;
  workUnitIds: readonly string[];
};
export type SterlingAcceptanceReport = {
  passed: boolean; cases: readonly SterlingAcceptanceCase[]; noiseFailures: readonly string[];
};

type CaseDefinition = {
  id: string; pattern: RegExp; identifiers: readonly string[]; expected: string;
  categories?: readonly SterlingTodayProposal["recommendations"][number]["category"][];
  parties?: readonly SterlingPortfolioAssessment["nextStepOwner"][];
  productionStage?: boolean;
  allowSuppressed?: boolean;
  obligations?: "vendor_wait_closed" | "retain_supported_engraving";
};

const CASES: readonly CaseDefinition[] = [
  { id: "ABBEY/C026137", pattern: /\bAbbey\b|C026137/i, identifiers: ["C026137"],
    categories: ["waiting_on_client"], parties: ["client"], expected: "waiting_on_client/client" },
  { id: "SARAH/C026143", pattern: /\bSarah\b|C026143/i, identifiers: ["C026143"], allowSuppressed: true,
    obligations: "vendor_wait_closed", expected: "vendor wait closed; founder review only if evidenced" },
  { id: "NATHAN", pattern: /\bNath?an\b|\bNate\b|C026176/i, identifiers: ["C026176"],
    categories: ["waiting_on_shop", "held_watching"], parties: ["vendor_shop"], expected: "current vendor/shop-held state" },
  { id: "ALEX/C026510", pattern: /\bAlex\b|C026510/i, identifiers: ["C026510"],
    categories: ["waiting_on_shop", "held_watching"], parties: ["vendor_shop"],
    obligations: "retain_supported_engraving", expected: "stone review closed; vendor/shop-held; supported engraving retained" },
  { id: "MADI RUTLEDGE", pattern: /Madi\s+Rutledge|\bMadi\b|C026000|C017756/i, identifiers: ["C026000", "C017756"],
    categories: ["waiting_on_client"], parties: ["client"], expected: "waiting_on_client/client" },
  { id: "DYLAN/C025610", pattern: /Dyl[ao]n|C025610/i, identifiers: ["C025610"],
    categories: ["in_production"], productionStage: true, expected: "in_production" },
  { id: "F. GRANT/C025885", pattern: /F\.?\s*Grant|C025885/i, identifiers: ["C025885"],
    categories: ["in_production"], productionStage: true, expected: "in_production" },
  { id: "J. PENNOCK/C025519", pattern: /J\.?\s*Pennock|C025519/i, identifiers: ["C025519"],
    categories: ["in_production"], productionStage: true, expected: "in_production" },
  { id: "DUANE/C026350", pattern: /\bDuane\b|C026350/i, identifiers: ["C026350"],
    categories: ["in_production"], productionStage: true, expected: "in_production" },
  { id: "TIM/JENN/C025964", pattern: /\bTim\b|\bJenn\b|C025964/i, identifiers: ["C025964"],
    categories: ["in_production"], productionStage: true, expected: "in_production" },
] as const;

const recommendationText = (item: SterlingTodayProposal["recommendations"][number]) =>
  [item.title, item.summary, item.explanation, item.projectStage.stage, ...item.obligations.map(row => row.description)].filter(Boolean).join(" ");

export function evaluateSterlingTodayAcceptance(
  workingSet: SterlingTodayWorkingSet,
  proposal: SterlingTodayProposal,
): SterlingAcceptanceReport {
  const evidence = new Map(workingSet.evidence.map(row => [row.evidenceId, row]));
  const assessments = new Map(proposal.portfolioAssessments.map(row => [row.workUnitId, row]));
  const recommendations = new Map(proposal.recommendations.map(row => [row.itemId, row]));
  const cases = CASES.map(definition => {
    const matching = workingSet.workUnits.filter(unit => definition.pattern.test([
      unit.label, ...unit.observedIdentifiers,
      ...unit.evidenceRefs.flatMap(ref => {
        const row = evidence.get(ref); return [row?.subject ?? "", row?.excerpt ?? "", ...(row?.attachmentFilenames ?? [])];
      }),
    ].join(" ")));
    const exact = matching.filter(unit => unit.observedIdentifiers.some(id => definition.identifiers.includes(id)));
    const canonical = matching.filter(unit => unit.kind === "canonical_project");
    const selected = exact.length === 1 ? exact[0] : canonical.length === 1 ? canonical[0] : matching.length === 1 ? matching[0] : null;
    if (matching.length === 0) return result(definition, false, "input_missing", "no scoped work unit", []);
    if (!selected) return result(definition, false, "identity_ambiguous", `${matching.length} matching work units`, matching.map(row => row.workUnitId));
    const assessment = assessments.get(selected.workUnitId);
    if (!assessment) return result(definition, false, "missing_output", "work unit present; assessment absent", [selected.workUnitId]);
    const actual = assessmentActual(assessment, recommendations.get(assessment.recommendationItemId ?? ""));
    if (assessment.evidenceRefs.length === 0) return result(definition, false, "insufficient_evidence", actual, [selected.workUnitId]);
    if (assessment.identityStatus === "unresolved_identity") {
      return result(definition, false, "identity_ambiguous", actual, [selected.workUnitId]);
    }
    if (assessment.todayDisposition === "ambiguous") {
      return result(definition, false, "legitimate_ambiguity", actual, [selected.workUnitId]);
    }
    const recommendation = assessment.recommendationItemId ? recommendations.get(assessment.recommendationItemId) : null;
    const obligationFailure = obligationMismatch(definition, selected, assessment, workingSet);
    if (definition.allowSuppressed && assessment.todayDisposition === "suppressed" && !obligationFailure) {
      return result(definition, true, "pass", actual, [selected.workUnitId]);
    }
    if (assessment.todayDisposition !== "presented" || !recommendation) {
      return result(definition, false, "omitted_from_today", actual, [selected.workUnitId]);
    }
    if (definition.categories && !definition.categories.includes(recommendation.category)) {
      const stageCorrect = definition.productionStage && /(^|_)production$/i.test(assessment.currentStage.stage ?? "");
      return result(definition, false, stageCorrect ? "wrong_category" : definition.productionStage ? "project_stage_mismatch" : "wrong_category",
        actual, [selected.workUnitId]);
    }
    if (definition.parties && !definition.parties.includes(assessment.nextStepOwner)) {
      return result(definition, false, "wrong_responsible_party", actual, [selected.workUnitId]);
    }
    if (obligationFailure) return result(definition, false, "obligation_mismatch", actual, [selected.workUnitId]);
    return result(definition, true, "pass", actual, [selected.workUnitId]);
  });

  const noise = /newsletter|editorial|schema fragment|technician notice|shipping boilerplate|cold solicitation/i;
  const noiseFailures = proposal.recommendations
    .filter(item => {
      const unit = workingSet.workUnits.find(row => row.workUnitId === item.workUnitId);
      return unit?.kind === "provisional_evidence" &&
        ["up_next", "founder_actions", "waiting_on_client", "waiting_on_shop"].includes(item.category) &&
        noise.test(recommendationText(item));
    })
    .map(item => item.itemId);
  return { passed: cases.every(row => row.passed) && noiseFailures.length === 0, cases, noiseFailures };
}

function obligationMismatch(
  definition: CaseDefinition,
  unit: SterlingTodayWorkingSet["workUnits"][number],
  assessment: SterlingPortfolioAssessment,
  workingSet: SterlingTodayWorkingSet,
): boolean {
  if (definition.obligations === "vendor_wait_closed") {
    return assessment.obligations.some(row => row.responsibleParty === "vendor_shop" && row.status === "open");
  }
  if (definition.obligations === "retain_supported_engraving") {
    const evidence = new Map(workingSet.evidence.map(row => [row.evidenceId, row]));
    const engravingSupported = unit.evidenceRefs.some(ref => {
      const row = evidence.get(ref); return /engrav/i.test(`${row?.subject ?? ""} ${row?.excerpt ?? ""}`);
    });
    return engravingSupported && !assessment.obligations.some(row => row.responsibleParty === "founder" &&
      (row.status === "open" || row.status === "ambiguous") && /engrav/i.test(row.description));
  }
  return false;
}

function assessmentActual(
  assessment: SterlingPortfolioAssessment,
  recommendation: SterlingTodayProposal["recommendations"][number] | undefined,
): string {
  const obligations = assessment.obligations.map(row => `${row.status}:${row.responsibleParty}`).join(",") || "none";
  return `disposition=${assessment.todayDisposition};category=${recommendation?.category ?? "none"};owner=${assessment.nextStepOwner};stage=${assessment.currentStage.stage ?? "none"};obligations=${obligations}`;
}

function result(
  definition: CaseDefinition,
  passed: boolean,
  outcome: SterlingAcceptanceOutcome,
  actual: string,
  workUnitIds: readonly string[],
): SterlingAcceptanceCase {
  return { id: definition.id, passed, outcome, actual, expected: definition.expected, workUnitIds };
}
