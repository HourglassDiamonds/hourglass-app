/**
 * Generic Capability / ObservationDraft validation.
 * Domain-neutral: does not know Studio value shapes.
 */

import {
  EPISTEMIC_CLASSES,
  type Materiality,
  type Urgency,
} from "../contracts/types";
import { assertNoPii, findPiiViolation, validateConfidence } from "../contracts/validation";
import {
  CAPABILITY_CONTRACT_VERSION,
  CAPABILITY_DOMAINS,
  type CapabilityDefinition,
  type CapabilityInvocation,
  type JsonValue,
  type ObservationDraft,
} from "./types";

export type CapabilityValidation =
  | { ok: true }
  | { ok: false; reason: string; failureCode: string };

const MATERIALITY: readonly Materiality[] = ["monitor", "notable", "material"];
const URGENCY: readonly Urgency[] = ["critical", "high", "medium", "low"];
const SEMVER = /^\d+\.\d+\.\d+$/;

export function isIsoTimestamp(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return t !== "number" || Number.isFinite(value as number);
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (t === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

export function validateCapabilityDefinition(
  definition: CapabilityDefinition,
): CapabilityValidation {
  if (!definition.capabilityId.trim()) {
    return {
      ok: false,
      reason: "capabilityId required",
      failureCode: "invalid-definition",
    };
  }
  if (definition.contractVersion !== CAPABILITY_CONTRACT_VERSION) {
    return {
      ok: false,
      reason: "unsupported contractVersion",
      failureCode: "unsupported-contract-version",
    };
  }
  if (!SEMVER.test(definition.capabilityVersion)) {
    return {
      ok: false,
      reason: "capabilityVersion must be semver",
      failureCode: "invalid-definition",
    };
  }
  if (!(CAPABILITY_DOMAINS as readonly string[]).includes(definition.domain)) {
    return {
      ok: false,
      reason: "unknown domain",
      failureCode: "invalid-definition",
    };
  }
  if (!Array.isArray(definition.requiredSources)) {
    return {
      ok: false,
      reason: "requiredSources required",
      failureCode: "invalid-definition",
    };
  }
  if (
    !Array.isArray(definition.allowedObservationTypes) ||
    definition.allowedObservationTypes.some((t) => !t.trim())
  ) {
    return {
      ok: false,
      reason: "allowedObservationTypes invalid",
      failureCode: "invalid-definition",
    };
  }
  if (!Array.isArray(definition.reads)) {
    return {
      ok: false,
      reason: "reads required",
      failureCode: "invalid-definition",
    };
  }
  if (typeof definition.producesObservations !== "boolean") {
    return {
      ok: false,
      reason: "producesObservations required",
      failureCode: "invalid-definition",
    };
  }
  return { ok: true };
}

export function validateCapabilityInvocation(
  invocation: CapabilityInvocation,
  capabilityId: string,
): CapabilityValidation {
  if (!invocation.invocationId.trim()) {
    return {
      ok: false,
      reason: "invocationId required",
      failureCode: "invalid-invocation",
    };
  }
  if (invocation.capabilityId !== capabilityId) {
    return {
      ok: false,
      reason: "invocation capabilityId mismatch",
      failureCode: "capability-id-mismatch",
    };
  }
  if (invocation.mode !== "fixture" && invocation.mode !== "live") {
    return {
      ok: false,
      reason: "mode must be fixture or live",
      failureCode: "invalid-invocation",
    };
  }
  if (!isIsoTimestamp(invocation.requestedAt) || !isIsoTimestamp(invocation.asOf)) {
    return {
      ok: false,
      reason: "requestedAt and asOf must be ISO timestamps",
      failureCode: "invalid-invocation",
    };
  }
  if (invocation.window) {
    if (
      !isIsoTimestamp(invocation.window.start) ||
      !isIsoTimestamp(invocation.window.end)
    ) {
      return {
        ok: false,
        reason: "window timestamps invalid",
        failureCode: "invalid-invocation",
      };
    }
    if (Date.parse(invocation.window.start) > Date.parse(invocation.window.end)) {
      return {
        ok: false,
        reason: "window start after end",
        failureCode: "invalid-invocation",
      };
    }
  }
  return { ok: true };
}

export function dedupeEvidenceRefs(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort((a, b) => a.localeCompare(b));
}

export function validateObservationDraftShape(
  draft: ObservationDraft,
  allowedObservationTypes: readonly string[],
): CapabilityValidation {
  if (!draft.observationType.trim()) {
    return {
      ok: false,
      reason: "observationType required",
      failureCode: "invalid-observation",
    };
  }
  if (!allowedObservationTypes.includes(draft.observationType)) {
    return {
      ok: false,
      reason: "undeclared observationType",
      failureCode: "undeclared-observation-type",
    };
  }
  const confidence = validateConfidence(draft.confidence);
  if (!confidence.ok) {
    return {
      ok: false,
      reason: confidence.reason,
      failureCode: "invalid-confidence",
    };
  }
  if (!Array.isArray(draft.evidenceRefs) || draft.evidenceRefs.length < 1) {
    return {
      ok: false,
      reason: "at least one evidenceRef required",
      failureCode: "empty-evidence-refs",
    };
  }
  if (draft.evidenceRefs.some((id) => !id || typeof id !== "string")) {
    return {
      ok: false,
      reason: "evidenceRefs must be non-empty strings",
      failureCode: "invalid-observation",
    };
  }
  if (!(MATERIALITY as readonly string[]).includes(draft.materiality)) {
    return {
      ok: false,
      reason: "invalid materiality",
      failureCode: "invalid-observation",
    };
  }
  if (!(URGENCY as readonly string[]).includes(draft.urgency)) {
    return {
      ok: false,
      reason: "invalid urgency",
      failureCode: "invalid-observation",
    };
  }
  if (!(EPISTEMIC_CLASSES as readonly string[]).includes(draft.epistemicClass)) {
    return {
      ok: false,
      reason: "invalid epistemicClass",
      failureCode: "invalid-observation",
    };
  }
  if (!isJsonValue(draft.value)) {
    return {
      ok: false,
      reason: "value is not JSON-safe",
      failureCode: "invalid-observation-value",
    };
  }
  if (typeof draft.statement !== "string" || !draft.statement.trim()) {
    return {
      ok: false,
      reason: "statement required",
      failureCode: "invalid-observation",
    };
  }
  const pii = assertNoPii(
    { statement: draft.statement, value: draft.value },
    "observation draft",
  );
  if (!pii.ok) {
    return { ok: false, reason: pii.reason, failureCode: "pii" };
  }
  if (draft.subjectEntityId !== null && typeof draft.subjectEntityId !== "string") {
    return {
      ok: false,
      reason: "subjectEntityId must be string or null",
      failureCode: "invalid-observation",
    };
  }
  if (draft.validFrom != null && !isIsoTimestamp(draft.validFrom)) {
    return {
      ok: false,
      reason: "validFrom must be ISO",
      failureCode: "invalid-observation",
    };
  }
  if (draft.validUntil != null && !isIsoTimestamp(draft.validUntil)) {
    return {
      ok: false,
      reason: "validUntil must be ISO",
      failureCode: "invalid-observation",
    };
  }
  return { ok: true };
}

export function draftContainsPii(draft: ObservationDraft): string | null {
  return findPiiViolation({
    statement: draft.statement,
    value: draft.value,
  });
}
