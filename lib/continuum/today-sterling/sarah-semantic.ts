import type { SterlingTodayAssembly } from "./server-runner";
import { STERLING_TODAY_SARAH_TARGET } from "./scope";

export const STERLING_TODAY_SARAH_PROJECT_ID = "18e9ef2b-5b22-453e-8be8-e54dab0d86b1" as const;
export const STERLING_TODAY_SARAH_THREAD_ID = "1a0881b53067a9e6" as const;
export const STERLING_TODAY_SARAH_LATEST_REQUIRED_AT = "2026-10-21T17:58:38.000Z" as const;
export const STERLING_TODAY_SARAH_MAX_OUTPUT_TOKENS = 8_000;
export const STERLING_TODAY_SARAH_MAX_REQUEST_BYTES = 64_000;

export type SarahSemanticPreflight = { ok: true } | { ok: false; reason: string };

export class SarahSemanticPreflightError extends Error {
  constructor(readonly safeReason: string) {
    super("sterling-today-sarah-semantic-preflight-failed");
    this.name = "SarahSemanticPreflightError";
  }
}

/** Fixed-case semantic preflight. It validates same-request live chronology before any model request. */
export function validateSarahSemanticAssembly(assembly: SterlingTodayAssembly): SarahSemanticPreflight {
  if (assembly.target?.caseId !== STERLING_TODAY_SARAH_TARGET) {
    return { ok: false, reason: "target-resolution-failed" };
  }
  if (assembly.targetBlockedReason || !assembly.targetDiagnostics?.complete) {
    return { ok: false, reason: assembly.targetDiagnostics?.stoppedAtStage ??
      (assembly.targetBlockedReason === "target-required-evidence-incomplete"
        ? "target-thread-live-retrieval-incomplete" : "target-resolution-failed") };
  }
  const selected = assembly.target.selectedWorkUnitId;
  if (assembly.requestWorkingSet.workUnits.length !== 1 ||
      assembly.requestWorkingSet.workUnits[0]?.workUnitId !== selected) {
    return { ok: false, reason: "target-resolution-failed" };
  }
  const unit = assembly.requestWorkingSet.workUnits[0]!;
  if (unit.kind !== "canonical_project" || unit.projectId !== STERLING_TODAY_SARAH_PROJECT_ID) {
    return { ok: false, reason: "target-resolution-failed" };
  }
  const bindings = unit.targetThreadBindings ?? [];
  if (assembly.targetDiagnostics.requiredThreadCount !== 1 ||
      assembly.targetDiagnostics.scheduledThreadCount !== 1 ||
      assembly.targetDiagnostics.successfullyLiveRetrievedThreadCount !== 1 ||
      assembly.targetDiagnostics.missingOrFailedThreadCount !== 0) {
    return { ok: false, reason: "target-thread-live-retrieval-incomplete" };
  }
  if (!unit.threadIds.includes(STERLING_TODAY_SARAH_THREAD_ID) || bindings.length !== 1 ||
      bindings[0]?.threadId !== STERLING_TODAY_SARAH_THREAD_ID) {
    return { ok: false, reason: "target-evidence-binding-incomplete" };
  }
  const gmailEvidence = assembly.requestWorkingSet.evidence.filter((row) => row.sourceType === "gmail");
  if (gmailEvidence.some((row) => row.threadId !== STERLING_TODAY_SARAH_THREAD_ID)) {
    return { ok: false, reason: "target-package-cross-unit-evidence" };
  }
  if (gmailEvidence.length === 0 || gmailEvidence.some((row) => !unit.evidenceRefs.includes(row.evidenceId))) {
    return { ok: false, reason: "target-evidence-binding-incomplete" };
  }
  const messageIds = gmailEvidence.map((row) => row.messageId).filter((id): id is string => Boolean(id));
  const chronology = gmailEvidence.map((row) => row.timestamp);
  if (gmailEvidence.length !== assembly.targetDiagnostics.requiredIndexedMessageCount ||
      gmailEvidence.length !== assembly.targetDiagnostics.successfullyLiveRetrievedMessageCount ||
      gmailEvidence.length !== assembly.targetDiagnostics.includedEvidenceMessageCount ||
      messageIds.length !== gmailEvidence.length || new Set(messageIds).size !== messageIds.length ||
      chronology.some((timestamp, index) => index > 0 && chronology[index - 1]! > timestamp) ||
      gmailEvidence.some((row) => row.provenance !== "indexed_gmail+live_quote_stripped_current_message")) {
    return { ok: false, reason: "target-chronology-incomplete" };
  }
  const latest = [...gmailEvidence].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1);
  if (!latest || latest.timestamp < STERLING_TODAY_SARAH_LATEST_REQUIRED_AT) {
    return { ok: false, reason: "target-chronology-incomplete" };
  }
  const latestMaterial = [latest.subject, latest.excerpt, ...latest.attachmentFilenames]
    .filter(Boolean).join(" ");
  if (!/\bmod\s*9\b/i.test(latestMaterial) || !/\bstl\b/i.test(latestMaterial)) {
    return { ok: false, reason: "target-chronology-incomplete" };
  }
  if (Buffer.byteLength(JSON.stringify(assembly.requestWorkingSet)) > STERLING_TODAY_SARAH_MAX_REQUEST_BYTES) {
    return { ok: false, reason: "target-package-oversized" };
  }
  return { ok: true };
}
