import type { LedgerPublication } from "./publication-types";

export type AutoPublishDecision = { eligible: boolean; reasons: readonly string[] };

export function evaluateSafeUpdateAutoPublish(
  previous: LedgerPublication,
  candidate: LedgerPublication,
): AutoPublishDecision {
  const reasons: string[] = [];
  if (candidate.audit.classification !== "SAFE_UPDATE") reasons.push("Classification is not SAFE_UPDATE.");
  if (candidate.overall.temperature !== previous.overall.temperature) reasons.push("Temperature changed.");
  if (candidate.overall.qualitativeState !== previous.overall.qualitativeState) reasons.push("Qualitative state changed.");
  if (candidate.overall.systemicDirection !== previous.overall.systemicDirection) reasons.push("Systemic direction changed.");
  if (candidate.audit.methodologyChanged) reasons.push("Methodology changed.");
  if (candidate.audit.materiallyNewNarrativeClaim) reasons.push("A materially new narrative claim is present.");
  if (candidate.audit.requiredSourceFailure) reasons.push("A required source failed.");
  if (candidate.overall.confidence === "low") reasons.push("Confidence is below the acceptable threshold.");
  if (candidate.audit.validationWarnings.length > 0) reasons.push("Validation requires interpretation.");

  for (const monitor of candidate.monitors) {
    const prior = previous.monitors.find((item) => item.id === monitor.id);
    if (!prior || monitor.state !== prior.state) reasons.push(`${monitor.id} state changed.`);
  }
  for (const domain of candidate.bufferHealth.domains) {
    const prior = previous.bufferHealth.domains.find((item) => item.id === domain.id);
    if (!prior || domain.state !== prior.state) reasons.push(`Buffer ${domain.id} state changed.`);
  }
  return { eligible: reasons.length === 0, reasons };
}
