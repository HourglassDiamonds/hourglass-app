import { CONCIERGE_FOREGROUND_MODEL } from "@/lib/continuum/concierge-sol/models";
import { buildSterlingTodayRequestPackage } from "./request";
import type { SterlingTodayAssembly } from "./server-runner";
import { STERLING_TODAY_SARAH_TARGET } from "./scope";
import {
  diagnoseSterlingTargetChronology,
  sterlingTargetChronologyComplete,
  type SterlingTargetChronologyDiagnostics,
} from "./target-chronology";
import type { SterlingTargetExtractionDiagnostics } from "./target-extraction-diagnostics";

export const STERLING_TODAY_SARAH_PROJECT_ID = "18e9ef2b-5b22-453e-8be8-e54dab0d86b1" as const;
export const STERLING_TODAY_SARAH_THREAD_ID = "1a0881b53067a9e6" as const;
export const STERLING_TODAY_SARAH_LATEST_REQUIRED_AT = "2026-10-21T17:58:38.000Z" as const;
export const STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS = 8_000;
export const STERLING_TODAY_SARAH_MAX_REQUEST_BYTES = 64_000;

export type SarahSemanticPackageDiagnostics = {
  requiredTargetThreadCount: number;
  scheduledTargetThreadCount: number;
  liveRetrievedTargetThreadCount: number;
  indexedMessageCount: number;
  liveMessageCount: number;
  includedMessageCount: number;
  messageCountParity: boolean;
  earliestVerifiedMessageAt: string | null;
  latestVerifiedMessageAt: string | null;
  mod9EvidencePresent: boolean;
  citationHandleCount: number;
  sourceAttributionValid: boolean;
  chronologyValid: boolean;
  provenanceValid: boolean;
  serializedRequestBytes: number | null;
  requestByteCeiling: number;
  requestByteCeilingPassed: boolean;
  chronologyInvariant: SterlingTargetChronologyDiagnostics | null;
  extractionDiagnostics: SterlingTargetExtractionDiagnostics | null;
  componentBytes: null | {
    instructions: number;
    workingSet: number;
    outputSchema: number;
    envelopeAndEncodingOverhead: number;
    evidenceRecords: number;
    operationalText: number;
    attachmentMetadata: number;
    repeatedOperationalText: number;
    quotedText: number;
    possibleSignatureText: number;
  };
};

export type SarahSemanticPackagePreflight =
  | { ok: true; diagnostics: SarahSemanticPackageDiagnostics }
  | { ok: false; reason: string; diagnostics: SarahSemanticPackageDiagnostics };

export type SarahSemanticPreflight = { ok: true } | { ok: false; reason: string };

export class SarahSemanticPreflightError extends Error {
  constructor(readonly safeReason: string) {
    super("sterling-today-sarah-semantic-preflight-failed");
    this.name = "SarahSemanticPreflightError";
  }
}

function textBytes(value: string | null | undefined): number {
  return Buffer.byteLength(value ?? "", "utf8");
}

function contentSizeDiagnostics(assembly: SterlingTodayAssembly) {
  const evidence = assembly.requestWorkingSet.evidence;
  const excerptCounts = new Map<string, number>();
  let excerptText = 0;
  let attachmentMetadata = 0;
  let quotedText = 0;
  let possibleSignatureText = 0;
  for (const row of evidence) {
    const excerpt = row.excerpt ?? "";
    excerptText += textBytes(excerpt);
    attachmentMetadata += row.attachmentFilenames.reduce((total, value) => total + textBytes(value), 0);
    if (excerpt) excerptCounts.set(excerpt, (excerptCounts.get(excerpt) ?? 0) + 1);
    for (const line of excerpt.split(/\r?\n/)) {
      if (/^\s*>/.test(line)) quotedText += textBytes(line);
      if (/^\s*(?:--\s*$|best(?: regards)?[,!]?|regards[,!]?|sincerely[,!]?|thanks[,!]?|thank you[,!]?)\s*$/i.test(line)) {
        possibleSignatureText += textBytes(line);
      }
    }
  }
  const repeatedExcerptText = [...excerptCounts.entries()].reduce((total, [excerpt, count]) =>
    total + (count > 1 ? textBytes(excerpt) * (count - 1) : 0), 0);
  return {
    evidenceRecords: Buffer.byteLength(JSON.stringify(evidence)),
    operationalText: excerptText,
    attachmentMetadata,
    repeatedOperationalText: repeatedExcerptText,
    quotedText,
    possibleSignatureText,
  };
}

function emptyDiagnostics(assembly: SterlingTodayAssembly): SarahSemanticPackageDiagnostics {
  const target = assembly.targetDiagnostics;
  return {
    requiredTargetThreadCount: target?.requiredThreadCount ?? 0,
    scheduledTargetThreadCount: target?.scheduledThreadCount ?? 0,
    liveRetrievedTargetThreadCount: target?.successfullyLiveRetrievedThreadCount ?? 0,
    indexedMessageCount: target?.requiredIndexedMessageCount ?? 0,
    liveMessageCount: target?.successfullyLiveRetrievedMessageCount ?? 0,
    includedMessageCount: target?.includedEvidenceMessageCount ?? 0,
    messageCountParity: false,
    earliestVerifiedMessageAt: null,
    latestVerifiedMessageAt: target?.latestVerifiedSourceAt ?? null,
    mod9EvidencePresent: false,
    citationHandleCount: 0,
    sourceAttributionValid: false,
    chronologyValid: false,
    provenanceValid: false,
    serializedRequestBytes: null,
    requestByteCeiling: STERLING_TODAY_SARAH_MAX_REQUEST_BYTES,
    requestByteCeilingPassed: false,
    chronologyInvariant: target?.chronologyInvariant ?? null,
    extractionDiagnostics: target?.extractionDiagnostics ?? null,
    componentBytes: null,
  };
}

/** Constructs and measures the exact semantic request without performing a network request. */
export function prepareSarahSemanticPackage(assembly: SterlingTodayAssembly): SarahSemanticPackagePreflight {
  const diagnostics = emptyDiagnostics(assembly);
  if (assembly.target?.caseId !== STERLING_TODAY_SARAH_TARGET) {
    return { ok: false, reason: "target-resolution-failed", diagnostics };
  }
  if (assembly.targetBlockedReason || !assembly.targetDiagnostics?.complete) {
    return { ok: false, reason: assembly.targetDiagnostics?.stoppedAtStage ??
      (assembly.targetBlockedReason === "target-required-evidence-incomplete"
        ? "target-thread-live-retrieval-incomplete" : "target-resolution-failed"), diagnostics };
  }
  const selected = assembly.target.selectedWorkUnitId;
  if (assembly.requestWorkingSet.workUnits.length !== 1 ||
      assembly.requestWorkingSet.workUnits[0]?.workUnitId !== selected) {
    return { ok: false, reason: "target-resolution-failed", diagnostics };
  }
  const unit = assembly.requestWorkingSet.workUnits[0]!;
  if (unit.kind !== "canonical_project" || unit.projectId !== STERLING_TODAY_SARAH_PROJECT_ID) {
    return { ok: false, reason: "target-resolution-failed", diagnostics };
  }
  const bindings = unit.targetThreadBindings ?? [];
  if (diagnostics.requiredTargetThreadCount !== 1 || diagnostics.scheduledTargetThreadCount !== 1 ||
      diagnostics.liveRetrievedTargetThreadCount !== 1 || assembly.targetDiagnostics.missingOrFailedThreadCount !== 0) {
    return { ok: false, reason: "target-thread-live-retrieval-incomplete", diagnostics };
  }
  if (!unit.threadIds.includes(STERLING_TODAY_SARAH_THREAD_ID) || bindings.length !== 1 ||
      bindings[0]?.threadId !== STERLING_TODAY_SARAH_THREAD_ID) {
    return { ok: false, reason: "target-evidence-binding-incomplete", diagnostics };
  }
  const gmailEvidence = assembly.requestWorkingSet.evidence.filter((row) => row.sourceType === "gmail");
  if (gmailEvidence.some((row) => row.threadId !== STERLING_TODAY_SARAH_THREAD_ID)) {
    return { ok: false, reason: "target-package-cross-unit-evidence", diagnostics };
  }
  if (gmailEvidence.length === 0 || gmailEvidence.some((row) => !unit.evidenceRefs.includes(row.evidenceId))) {
    return { ok: false, reason: "target-evidence-binding-incomplete", diagnostics };
  }

  const messageIds = gmailEvidence.map((row) => row.messageId).filter((id): id is string => Boolean(id));
  const chronology = gmailEvidence.map((row) => row.timestamp);
  const evidenceIds = new Set(assembly.requestWorkingSet.evidence.map((row) => row.evidenceId));
  const referencedEvidence = new Set(unit.evidenceRefs);
  diagnostics.citationHandleCount = referencedEvidence.size;
  diagnostics.messageCountParity = gmailEvidence.length === diagnostics.indexedMessageCount &&
    gmailEvidence.length === diagnostics.liveMessageCount && gmailEvidence.length === diagnostics.includedMessageCount;
  diagnostics.chronologyValid = chronology.every((timestamp, index) =>
    index === 0 || chronology[index - 1]! <= timestamp);
  diagnostics.provenanceValid = gmailEvidence.every((row) =>
    row.provenance === "indexed_gmail+live_quote_stripped_current_message");
  diagnostics.sourceAttributionValid = gmailEvidence.every((row) =>
    row.threadId === STERLING_TODAY_SARAH_THREAD_ID && Boolean(row.messageId) &&
    (row.direction === "inbound" || row.direction === "outbound") && referencedEvidence.has(row.evidenceId)) &&
    [...referencedEvidence].every((evidenceId) => evidenceIds.has(evidenceId));
  diagnostics.earliestVerifiedMessageAt = [...chronology].sort().at(0) ?? null;
  diagnostics.latestVerifiedMessageAt = [...chronology].sort().at(-1) ?? null;
  const latest = [...gmailEvidence].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1);
  const latestMaterial = latest ? [latest.subject, latest.excerpt, ...latest.attachmentFilenames]
    .filter(Boolean).join(" ") : "";
  diagnostics.mod9EvidencePresent = Boolean(latest) && latest!.timestamp >= STERLING_TODAY_SARAH_LATEST_REQUIRED_AT &&
    /\bmod\s*9\b/i.test(latestMaterial) && /\bstl\b/i.test(latestMaterial);
  diagnostics.chronologyInvariant = diagnoseSterlingTargetChronology({
    evidence: gmailEvidence,
    requiredThreadIds: [STERLING_TODAY_SARAH_THREAD_ID],
    referencedEvidenceIds: unit.evidenceRefs,
    indexedMessageCount: diagnostics.indexedMessageCount,
    liveMessageCount: diagnostics.liveMessageCount,
    includedMessageCount: diagnostics.includedMessageCount,
  });

  if (!diagnostics.messageCountParity || messageIds.length !== gmailEvidence.length ||
      new Set(messageIds).size !== messageIds.length || !diagnostics.chronologyValid ||
      !diagnostics.provenanceValid || !diagnostics.sourceAttributionValid || !diagnostics.mod9EvidencePresent) {
    return { ok: false, reason: "target-chronology-incomplete", diagnostics };
  }
  if (!sterlingTargetChronologyComplete(diagnostics.chronologyInvariant)) {
    return { ok: false, reason: "target-chronology-incomplete", diagnostics };
  }

  let requestPackage;
  try {
    requestPackage = buildSterlingTodayRequestPackage({
      model: CONCIERGE_FOREGROUND_MODEL,
      workingSet: assembly.requestWorkingSet,
      maxOutputTokens: STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS,
      disableTruncation: true,
    });
  } catch {
    return { ok: false, reason: "target-evidence-binding-incomplete", diagnostics };
  }
  diagnostics.serializedRequestBytes = requestPackage.requestBytes;
  diagnostics.requestByteCeilingPassed = requestPackage.requestBytes <= STERLING_TODAY_SARAH_MAX_REQUEST_BYTES;
  diagnostics.componentBytes = { ...requestPackage.componentBytes, ...contentSizeDiagnostics(assembly) };
  if (!diagnostics.requestByteCeilingPassed) {
    return { ok: false, reason: "target-package-oversized", diagnostics };
  }
  return { ok: true, diagnostics };
}

/** Fixed-case semantic preflight shared by live semantic execution and package preflight. */
export function validateSarahSemanticAssembly(assembly: SterlingTodayAssembly): SarahSemanticPreflight {
  const result = prepareSarahSemanticPackage(assembly);
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}
