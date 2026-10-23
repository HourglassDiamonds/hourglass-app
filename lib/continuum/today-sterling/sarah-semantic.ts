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
    return { ok: false, reason: "sarah-target-not-selected" };
  }
  if (assembly.targetBlockedReason || !assembly.targetDiagnostics?.complete) {
    return { ok: false, reason: assembly.targetBlockedReason ?? "sarah-evidence-incomplete" };
  }
  const selected = assembly.target.selectedWorkUnitId;
  if (assembly.requestWorkingSet.workUnits.length !== 1 ||
      assembly.requestWorkingSet.workUnits[0]?.workUnitId !== selected) {
    return { ok: false, reason: "sarah-target-package-not-isolated" };
  }
  const unit = assembly.requestWorkingSet.workUnits[0]!;
  if (unit.kind !== "canonical_project" || unit.projectId !== STERLING_TODAY_SARAH_PROJECT_ID) {
    return { ok: false, reason: "sarah-canonical-identity-unverified" };
  }
  if (assembly.targetDiagnostics.requiredThreadCount !== 1 ||
      assembly.targetDiagnostics.scheduledThreadCount !== 1 ||
      assembly.targetDiagnostics.successfullyLiveRetrievedThreadCount !== 1 ||
      assembly.targetDiagnostics.missingOrFailedThreadCount !== 0 ||
      !unit.threadIds.includes(STERLING_TODAY_SARAH_THREAD_ID)) {
    return { ok: false, reason: "sarah-same-request-live-evidence-incomplete" };
  }
  const gmailEvidence = assembly.requestWorkingSet.evidence.filter((row) => row.sourceType === "gmail");
  if (gmailEvidence.length === 0 || gmailEvidence.some((row) =>
    row.threadId !== STERLING_TODAY_SARAH_THREAD_ID ||
    row.provenance !== "indexed_gmail+live_quote_stripped_current_message")) {
    return { ok: false, reason: "sarah-live-chronology-unverified" };
  }
  const latest = [...gmailEvidence].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1);
  if (!latest || latest.timestamp < STERLING_TODAY_SARAH_LATEST_REQUIRED_AT) {
    return { ok: false, reason: "sarah-latest-chronology-missing" };
  }
  const latestMaterial = [latest.subject, latest.excerpt, ...latest.attachmentFilenames]
    .filter(Boolean).join(" ");
  if (!/\bmod\s*9\b/i.test(latestMaterial) || !/\bstl\b/i.test(latestMaterial)) {
    return { ok: false, reason: "sarah-mod9-stl-evidence-missing" };
  }
  return { ok: true };
}
