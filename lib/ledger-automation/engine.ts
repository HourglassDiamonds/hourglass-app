import { ACAI_SNAPSHOT } from "@/app/ledger/ai-capability-acceleration-data";
import { BUFFER_HEALTH_DOMAINS } from "@/app/ledger/buffer-health-data";
import { GPM_SNAPSHOT } from "@/app/ledger/global-pressure-monitor-data";
import { GWS_SNAPSHOT } from "@/app/ledger/global-water-stress-data";
import { ISM_SNAPSHOT } from "@/app/ledger/information-signal-map-data";
import { ISI_SNAPSHOT } from "@/app/ledger/infrastructure-strain-data";
import type { LedgerIndexId } from "@/app/ledger/ledger-data";
import { PMI_SNAPSHOT } from "@/app/ledger/precious-materials-data";
import {
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01,
  computeTemperatureDegrees,
  publishTemperatureReading,
  type SystemTemperatureSnapshot,
} from "@/app/ledger/system-temperature";
import type {
  BufferProposal,
  LedgerAutomationRunRecord,
  LedgerEvidencePacket,
  LedgerPublicationPreview,
  LedgerRunClassification,
  LedgerRunState,
  LedgerRunType,
  LedgerSourceAdapter,
  LedgerSourceCheck,
  LedgerSourceDefinition,
  MonitorProposal,
  TemperatureProposal,
} from "./types";
import { LEDGER_AUTOMATION_MODE } from "./types";

const MONITOR_BASELINES: Readonly<Record<Exclude<LedgerIndexId, "buffer-health">, string>> = {
  "global-pressure": GPM_SNAPSHOT.currentState,
  "ai-capability": ACAI_SNAPSHOT.currentState,
  "precious-materials": PMI_SNAPSHOT.currentState,
  "infrastructure-strain": ISI_SNAPSHOT.currentState,
  "global-water-stress": GWS_SNAPSHOT.currentState,
  "information-signal": ISM_SNAPSHOT.currentState,
};

const MONITOR_ORDER = Object.keys(MONITOR_BASELINES) as Exclude<LedgerIndexId, "buffer-health">[];

export type RunEngineInput = {
  runType: LedgerRunType;
  scheduledDate: string;
  startedAt: string;
  completedAt?: string;
  registry: readonly LedgerSourceDefinition[];
  adapter: LedgerSourceAdapter;
  previousReview?: LedgerAutomationRunRecord | null;
};

function runSlug(runType: LedgerRunType): string {
  return runType === "TUESDAY_FULL" ? "tuesday-full" : "friday-delta";
}

export function buildRunKey(scheduledDate: string, runType: LedgerRunType): string {
  return `ledger:${scheduledDate}:${runSlug(runType)}`;
}

function previousMonitorState(
  monitorId: Exclude<LedgerIndexId, "buffer-health">,
  previousReview?: LedgerAutomationRunRecord | null,
): string {
  return previousReview?.evidencePacket.monitorObservations.find(
    (proposal) => proposal.monitorId === monitorId,
  )?.proposedState ?? MONITOR_BASELINES[monitorId];
}

function checksForFriday(checks: readonly LedgerSourceCheck[]): LedgerSourceCheck[] {
  return checks.filter(
    (check) =>
      check.failure !== null ||
      check.freshness !== "CURRENT" ||
      check.normalizedObservation?.significance !== "NONE",
  );
}

function confidenceFor(checks: readonly LedgerSourceCheck[]): "HIGH" | "MODERATE" | "LOW" {
  if (checks.some((check) => check.failure || check.freshness !== "CURRENT" || check.reliability === "LOW")) {
    return "LOW";
  }
  return checks.length > 0 && checks.every((check) => check.reliability === "HIGH")
    ? "HIGH"
    : "MODERATE";
}

function buildMonitorProposals(
  checks: readonly LedgerSourceCheck[],
  previousReview?: LedgerAutomationRunRecord | null,
): MonitorProposal[] {
  return MONITOR_ORDER.map((monitorId) => {
    const previousState = previousMonitorState(monitorId, previousReview);
    const relevant = checks.filter((check) => check.monitorId === monitorId);
    const proposals = [...new Set(relevant.flatMap((check) => {
      const state = check.normalizedObservation?.proposedMonitorState;
      return state ? [state] : [];
    }))];
    const conflict = proposals.length > 1;
    const proposedState = conflict ? previousState : (proposals[0] ?? previousState);
    const materialChange = proposedState !== previousState || relevant.some(
      (check) => check.normalizedObservation?.significance === "MATERIAL",
    );
    return {
      monitorId,
      previousState,
      proposedState,
      changeExplanation: conflict
        ? "Approved sources propose conflicting states; the prior state is retained pending founder review."
        : materialChange
          ? "New normalized evidence proposes a material monitor change."
          : relevant.some((check) => check.normalizedObservation?.significance === "MINOR")
            ? "Supporting evidence changed without changing the monitor interpretation."
            : "No material change from the prior formal state.",
      confidence: confidenceFor(relevant),
      supportingSourceIds: relevant.filter((check) => !check.failure).map((check) => check.sourceId),
      contradictorySourceIds: conflict ? relevant.map((check) => check.sourceId) : [],
      materialChange,
    };
  });
}

function buildBufferProposals(
  checks: readonly LedgerSourceCheck[],
  previousReview?: LedgerAutomationRunRecord | null,
): BufferProposal[] {
  return BUFFER_HEALTH_DOMAINS.map((domain) => {
    const previousState = previousReview?.evidencePacket.bufferHealthChanges.find(
      (proposal) => proposal.domainId === domain.id,
    )?.proposedState ?? domain.reserveState;
    const relevant = checks.filter((check) => check.bufferDomainId === domain.id);
    const proposals = [...new Set(relevant.flatMap((check) => {
      const state = check.normalizedObservation?.proposedBufferState;
      return state ? [state] : [];
    }))];
    const conflict = proposals.length > 1;
    const proposedState = conflict ? previousState : (proposals[0] ?? previousState);
    const materialChange = proposedState !== previousState;
    return {
      domainId: domain.id,
      previousState,
      proposedState,
      changeExplanation: conflict
        ? "Approved sources conflict; the prior reserve state is retained pending review."
        : materialChange
          ? "New normalized evidence proposes a Buffer Health category change."
          : "No Buffer Health category change.",
      confidence: confidenceFor(relevant),
      supportingSourceIds: relevant.filter((check) => !check.failure).map((check) => check.sourceId),
      materialChange,
    };
  });
}

function buildTemperatureProposal(
  checks: readonly LedgerSourceCheck[],
  scheduledDate: string,
  previousReview?: LedgerAutomationRunRecord | null,
): TemperatureProposal {
  const prior = previousReview?.evidencePacket.overallTemperature.snapshot ?? SYSTEM_TEMPERATURE_SNAPSHOT_2026_10_01;
  const channels = prior.channels.map((channel) => {
    const proposal = checks
      .map((check) => check.normalizedObservation?.proposedTemperatureChannel)
      .find((candidate) => candidate?.channelId === channel.id);
    if (!proposal) return { ...channel, materialChange: false };
    const changed = proposal.pressure !== channel.pressure || proposal.transmission !== channel.transmission;
    return {
      ...channel,
      pressure: proposal.pressure,
      transmission: proposal.transmission,
      materialChange: changed,
      transmissionExplanation: proposal.explanation,
      coolingNotes: proposal.coolingNotes,
    };
  });
  const snapshot: SystemTemperatureSnapshot = {
    ...prior,
    reviewDate: scheduledDate,
    evidenceCutoff: scheduledDate,
    channels,
    isBaselineReading: false,
  };
  const previousDegrees = computeTemperatureDegrees(prior);
  const reading = publishTemperatureReading(snapshot, { previousDegrees });
  return {
    previousDegrees,
    proposedDegrees: reading.degrees,
    previousState: previousReview?.proposedPublication.proposedState ?? SYSTEM_TEMPERATURE_READING.bandLabel,
    proposedState: reading.bandLabel,
    previousConfidence: prior.confidence,
    proposedConfidence: reading.confidence,
    snapshot,
    validationIssues: reading.validation.issues,
  };
}

function classify(
  checks: readonly LedgerSourceCheck[],
  monitors: readonly MonitorProposal[],
  buffers: readonly BufferProposal[],
  temperature: TemperatureProposal,
): { classification: LedgerRunClassification; reasons: string[]; failed: boolean } {
  const reasons: string[] = [];
  const requiredFailure = checks.some((check) => check.required && check.failure);
  if (requiredFailure) reasons.push("One or more required approved sources failed; missing evidence was not treated as neutral or unchanged.");
  if (checks.some((check) => check.freshness !== "CURRENT")) reasons.push("One or more source observations are stale or have unknown freshness.");
  if (monitors.some((proposal) => proposal.contradictorySourceIds.length > 0)) reasons.push("Source evidence conflicts materially.");
  if (monitors.some((proposal) => proposal.materialChange)) reasons.push("A monitor has a material proposed change.");
  if (buffers.some((proposal) => proposal.materialChange)) reasons.push("A Buffer Health category has a proposed change.");
  if (temperature.proposedDegrees !== temperature.previousDegrees) reasons.push("The proposed overall Ledger temperature changes.");
  if (temperature.proposedState !== temperature.previousState) reasons.push("The proposed overall qualitative state changes.");
  if (temperature.proposedConfidence === "low" && temperature.previousConfidence !== "low") reasons.push("Overall confidence drops below the existing threshold.");
  if (temperature.validationIssues.length > 0) reasons.push("System Temperature validation produced an issue.");
  if (checks.some((check) => check.normalizedObservation?.significance === "MATERIAL")) reasons.push("New evidence would introduce a materially new claim.");
  if (checks.some((check) =>
    check.status === "MANUAL_REVIEW_REQUIRED" && check.metadata.adapterId === "ledger-live-hybrid-v1.1"
  )) reasons.push("One or more live or retained manual observations require founder interpretation under the existing methodology.");

  if (reasons.length > 0) return { classification: "APPROVAL_REQUIRED", reasons, failed: requiredFailure };
  if (checks.some((check) => check.normalizedObservation?.significance === "MINOR")) {
    return { classification: "SAFE_UPDATE", reasons: ["Only non-material evidence or supporting-statistic changes were found."], failed: false };
  }
  return { classification: "NO_CHANGE", reasons: ["No material or publication-worthy change was found."], failed: false };
}

export async function runLedgerAutomation(input: RunEngineInput): Promise<LedgerAutomationRunRecord> {
  const runKey = buildRunKey(input.scheduledDate, input.runType);
  const runId = runKey.replaceAll(":", "-");
  const allChecks = await Promise.all(
    input.registry.map((source) => input.adapter.check(source, {
      runType: input.runType,
      checkedAt: input.startedAt,
      runId,
    })),
  );
  const checks = input.runType === "FRIDAY_DELTA" ? checksForFriday(allChecks) : allChecks;
  const monitors = buildMonitorProposals(checks, input.previousReview);
  const buffers = buildBufferProposals(checks, input.previousReview);
  const temperature = buildTemperatureProposal(checks, input.scheduledDate, input.previousReview);
  const result = classify(checks, monitors, buffers, temperature);
  const completedAt = input.completedAt ?? input.startedAt;
  const preview: LedgerPublicationPreview = {
    proposedDate: input.scheduledDate,
    proposedTemperature: temperature.proposedDegrees,
    proposedState: temperature.proposedState,
    proposedConfidence: temperature.proposedConfidence,
    proposedMonitorChanges: monitors.filter((proposal) => proposal.materialChange),
    proposedBufferHealthChanges: buffers.filter((proposal) => proposal.materialChange),
    whatChanged: result.classification === "NO_CHANGE"
      ? ["No material change since the prior formal Ledger review."]
      : [...monitors.filter((proposal) => proposal.materialChange).map((proposal) => `${proposal.monitorId}: ${proposal.changeExplanation}`), ...buffers.filter((proposal) => proposal.materialChange).map((proposal) => `Buffer ${proposal.domainId}: ${proposal.changeExplanation}`)],
    evidenceReferences: checks.filter((check) => !check.failure).map((check) => check.sourceId),
  };
  const packet: LedgerEvidencePacket = {
    schemaVersion: "ledger-automation-v1.1",
    runId,
    runKey,
    runType: input.runType,
    startedAt: input.startedAt,
    completedAt,
    sourceChecks: checks,
    sourceFailures: checks.filter((check) => check.failure),
    monitorObservations: monitors,
    bufferHealthChanges: buffers,
    overallTemperature: temperature,
    reasons: result.reasons,
    publicationRecommendation: result.classification,
  };
  const terminalState: LedgerRunState = result.failed
    ? "FAILED"
    : result.classification === "NO_CHANGE"
      ? "NO_CHANGE"
      : "AWAITING_APPROVAL";
  const stateHistory: LedgerRunState[] = ["CREATED", "FETCHING", "ANALYZING", "DRAFTED", terminalState];
  return {
    schemaVersion: "ledger-run-v1",
    runId,
    runKey,
    runType: input.runType,
    scheduledDate: input.scheduledDate,
    createdAt: input.startedAt,
    completedAt,
    state: terminalState,
    stateHistory: stateHistory.map((state) => ({ state, at: state === terminalState ? completedAt : input.startedAt })),
    classification: result.classification,
    theoreticalAutoPublishEligible: result.classification === "SAFE_UPDATE",
    mode: LEDGER_AUTOMATION_MODE,
    evidencePacket: packet,
    proposedPublication: preview,
    founderApproval: null,
    publicationOccurred: false,
    publicationId: null,
    publicationDate: null,
  };
}
