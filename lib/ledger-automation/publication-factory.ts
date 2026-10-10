import type { LedgerEvidenceSource } from "@/app/ledger/ledger-monitor-framework";
import type { FounderDecisionRecord, LedgerAutomationRunRecord, LedgerSourceCheck, LedgerSourceStatus } from "./types";
import type { LedgerPublication } from "./publication-types";

function displayDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00.000Z`));
}

function sourceReference(check: LedgerSourceCheck): LedgerEvidenceSource {
  return {
    institution: check.sourceAuthority,
    title: check.sourceName,
    date: check.observationTimestamp ?? check.checkedAt,
    url: check.sourceUrl,
    supports: check.normalizedObservation?.summary ?? "Reviewed evidence source.",
  };
}

function mergeSources(
  previous: readonly LedgerEvidenceSource[],
  checks: readonly LedgerSourceCheck[],
): readonly LedgerEvidenceSource[] {
  const sources = [...previous, ...checks.filter((check) => !check.failure).map(sourceReference)];
  return [...new Map(sources.map((source) => [`${source.institution}|${source.title}|${source.date}`, source])).values()];
}

function sourceHealth(checks: readonly LedgerSourceCheck[]): Readonly<Record<LedgerSourceStatus, number>> {
  const statuses: LedgerSourceStatus[] = [
    "OK", "STALE", "UNAVAILABLE", "INVALID", "RATE_LIMITED", "AUTH_REQUIRED", "MANUAL_REVIEW_REQUIRED",
  ];
  return Object.fromEntries(statuses.map((status) => [status, checks.filter((check) => check.status === status).length])) as Record<LedgerSourceStatus, number>;
}

export function buildCanonicalPublication(
  run: LedgerAutomationRunRecord,
  previous: LedgerPublication,
  now: Date,
  founderDecision: FounderDecisionRecord | null = null,
): LedgerPublication {
  if (run.classification === "NO_CHANGE") throw new Error("NO_CHANGE reviews do not create publications.");
  const timestamp = now.toISOString();
  const publicationDate = displayDate(run.scheduledDate);
  const checks = run.evidencePacket.sourceChecks;
  const approvalRequired = run.classification === "APPROVAL_REQUIRED";
  const status = approvalRequired && founderDecision?.decision !== "APPROVE" ? "AWAITING_APPROVAL" : "APPROVED";
  const temperatureSnapshot = {
    ...run.evidencePacket.overallTemperature.snapshot,
    reviewDate: publicationDate,
    evidenceCutoff: publicationDate,
  };

  const monitors = previous.monitors.map((prior) => {
    const proposal = run.evidencePacket.monitorObservations.find((item) => item.monitorId === prior.id);
    const relevant = checks.filter((check) => check.monitorId === prior.id);
    const summaries = relevant.flatMap((check) => check.normalizedObservation ? [check.normalizedObservation.summary] : []);
    const contradictoryIds = new Set(proposal?.contradictorySourceIds ?? []);
    return {
      ...prior,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
      state: proposal?.proposedState ?? prior.state,
      direction: proposal?.proposedDirection ?? prior.direction,
      hubState: proposal?.proposedState ?? prior.state,
      hubDirection: proposal?.proposedDirection ?? prior.direction,
      summary: summaries.length > 0 ? summaries.join(" ") : prior.summary,
      supportingEvidence: relevant.filter((check) => !check.failure && !contradictoryIds.has(check.sourceId)).flatMap((check) => check.normalizedObservation ? [check.normalizedObservation.summary] : []),
      counterEvidence: relevant.filter((check) => contradictoryIds.has(check.sourceId)).flatMap((check) => check.normalizedObservation ? [check.normalizedObservation.summary] : []),
      watchItems: prior.watchItems,
      sourceReferences: mergeSources(prior.sourceReferences, relevant),
    };
  });

  const domains = previous.bufferHealth.domains.map((prior) => {
    const proposal = run.evidencePacket.bufferHealthChanges.find((item) => item.domainId === prior.id);
    const relevant = checks.filter((check) => check.bufferDomainId === prior.id);
    const evidence = relevant.flatMap((check) => check.normalizedObservation ? [check.normalizedObservation.summary] : []);
    return {
      ...prior,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
      state: proposal?.proposedState ?? prior.state,
      rationale: evidence.length > 0 ? evidence.join(" ") : prior.rationale,
      supportingEvidence: evidence,
      counterEvidence: [],
      sourceReferences: mergeSources(prior.sourceReferences, relevant),
    };
  });

  const whatChanged = run.proposedPublication.whatChanged.length > 0
    ? run.proposedPublication.whatChanged
    : ["Evidence and source references were refreshed without changing the formal interpretation."];

  return {
    schemaVersion: "ledger-publication-v2",
    publicationId: `${run.runId}-publication`,
    publicationDate,
    evidenceReviewedThrough: publicationDate,
    createdAt: timestamp,
    approvedAt: status === "APPROVED" ? founderDecision?.decidedAt ?? timestamp : "",
    publishedAt: status === "APPROVED" ? timestamp : "",
    runId: run.runId,
    runType: run.runType,
    previousPublicationId: previous.publicationId,
    overall: {
      temperature: run.evidencePacket.overallTemperature.proposedDegrees,
      qualitativeState: run.evidencePacket.overallTemperature.proposedState,
      systemicDirection: temperatureSnapshot.functioningLabel,
      confidence: run.evidencePacket.overallTemperature.proposedConfidence,
      ledgerNote: whatChanged.join(" "),
      synopsis: run.classification === "SAFE_UPDATE"
        ? `${publicationDate} evidence refresh; the formal Ledger interpretation is unchanged.`
        : `${publicationDate} proposal awaiting founder decision.`,
      whatChanged,
      temperatureSnapshot,
    },
    monitors,
    bufferHealth: {
      ...previous.bufferHealth,
      publicationDate,
      evidenceReviewedThrough: publicationDate,
      domains,
    },
    historicalComparison: {
      previousPublicationId: previous.publicationId,
      previousPublicationDate: previous.publicationDate,
      temperatureDelta: run.evidencePacket.overallTemperature.proposedDegrees - previous.overall.temperature,
    },
    audit: {
      sourceHealthSummary: sourceHealth(checks),
      classification: run.classification,
      approvalRequired,
      founderDecision,
      publicationStatus: status,
      methodologyChanged: temperatureSnapshot.methodologyVersion !== previous.overall.temperatureSnapshot.methodologyVersion,
      materiallyNewNarrativeClaim: checks.some((check) => check.normalizedObservation?.significance === "MATERIAL"),
      requiredSourceFailure: checks.some((check) => check.required && check.failure !== null),
      validationWarnings: run.evidencePacket.overallTemperature.validationIssues.map((issue) => issue.message),
    },
  };
}
