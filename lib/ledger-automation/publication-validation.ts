import { bandForDegrees, computeTemperatureDegrees } from "@/app/ledger/system-temperature";
import {
  LEDGER_BUFFER_DOMAIN_IDS,
  LEDGER_MONITOR_IDS,
  type LedgerPublication,
} from "./publication-types";

export type PublicationValidationIssue = {
  code: string;
  message: string;
};

export type PublicationValidationContext = {
  publicationIdExists: (publicationId: string) => Promise<boolean>;
  predecessorExists: (publicationId: string) => Promise<boolean>;
};

function exactIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((id) => actual.includes(id));
}

function validSources(publication: LedgerPublication): boolean {
  const sourceGroups = [
    ...publication.monitors.map((monitor) => monitor.sourceReferences),
    ...publication.bufferHealth.domains.map((domain) => domain.sourceReferences),
  ];
  return sourceGroups.every((sources) => sources.length > 0 && sources.every((source) => {
    if (!source.institution.trim() || !source.title.trim() || !source.date.trim() || !source.supports.trim()) {
      return false;
    }
    if (!source.url) return true;
    try {
      return new URL(source.url).protocol === "https:";
    } catch {
      return false;
    }
  }));
}

export async function validateLedgerPublication(
  publication: LedgerPublication,
  context: PublicationValidationContext,
): Promise<readonly PublicationValidationIssue[]> {
  const issues: PublicationValidationIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });

  if (await context.publicationIdExists(publication.publicationId)) {
    add("duplicate-publication-id", `Publication ID ${publication.publicationId} already exists.`);
  }

  if (!exactIds(publication.monitors.map((monitor) => monitor.id), LEDGER_MONITOR_IDS)) {
    add("monitor-set", "The publication must contain each supported monitor exactly once and no unsupported monitor.");
  }
  if (!exactIds(publication.bufferHealth.domains.map((domain) => domain.id), LEDGER_BUFFER_DOMAIN_IDS)) {
    add("buffer-domain-set", "Buffer Health must contain each required domain exactly once.");
  }

  const expectedDate = publication.publicationDate;
  const allMonitorDatesMatch = publication.monitors.every((monitor) =>
    monitor.publicationDate === expectedDate &&
    monitor.evidenceReviewedThrough === publication.evidenceReviewedThrough
  );
  if (!allMonitorDatesMatch) add("monitor-date-drift", "All monitor publication and evidence dates must match the hub publication.");
  if (
    publication.bufferHealth.publicationDate !== expectedDate ||
    publication.bufferHealth.evidenceReviewedThrough !== publication.evidenceReviewedThrough ||
    publication.bufferHealth.domains.some((domain) =>
      domain.publicationDate !== expectedDate ||
      domain.evidenceReviewedThrough !== publication.evidenceReviewedThrough
    )
  ) {
    add("buffer-date-drift", "Buffer Health publication and evidence dates must match the hub publication.");
  }

  for (const monitor of publication.monitors) {
    if (monitor.state !== monitor.hubState) add("hub-monitor-state", `${monitor.id} hub state does not match its standalone state.`);
    if (monitor.direction !== monitor.hubDirection) add("hub-monitor-direction", `${monitor.id} hub direction does not match its standalone direction.`);
  }

  const computedTemperature = computeTemperatureDegrees(publication.overall.temperatureSnapshot);
  if (computedTemperature !== publication.overall.temperature) {
    add("temperature-methodology", `Published temperature ${publication.overall.temperature} does not match methodology output ${computedTemperature}.`);
  }
  const expectedBand = bandForDegrees(publication.overall.temperature).label;
  if (expectedBand !== publication.overall.qualitativeState) {
    add("qualitative-state", `Qualitative state must be ${expectedBand} for ${publication.overall.temperature}°.`);
  }
  if (
    publication.overall.temperatureSnapshot.reviewDate !== expectedDate ||
    publication.overall.temperatureSnapshot.evidenceCutoff !== publication.evidenceReviewedThrough
  ) {
    add("temperature-date-drift", "System Temperature dates must match the canonical publication.");
  }

  if (publication.previousPublicationId && !(await context.predecessorExists(publication.previousPublicationId))) {
    add("missing-predecessor", `Previous publication ${publication.previousPublicationId} does not exist.`);
  }
  if (!validSources(publication)) add("invalid-source-reference", "Every monitor and Buffer domain requires valid frozen source references.");
  if (publication.audit.requiredSourceFailure && !publication.audit.approvalRequired) {
    add("required-source-failure", "A required source failure must be explicitly approval-gated.");
  }
  if (publication.audit.validationWarnings.length > 0 && !publication.audit.approvalRequired) {
    add("validation-warning", "Validation warnings require founder approval.");
  }
  if (publication.audit.publicationStatus !== "APPROVED" && publication.audit.publicationStatus !== "PUBLISHING") {
    add("not-approved", "Only an approved publication may enter the atomic writer.");
  }
  if (publication.audit.approvalRequired && publication.audit.founderDecision?.decision !== "APPROVE") {
    add("founder-approval", "An approval-required publication needs a persisted founder approval decision.");
  }

  return issues;
}

export class LedgerPublicationValidationError extends Error {
  constructor(public readonly issues: readonly PublicationValidationIssue[]) {
    super(`Ledger publication rejected: ${issues.map((issue) => issue.message).join(" ")}`);
    this.name = "LedgerPublicationValidationError";
  }
}
