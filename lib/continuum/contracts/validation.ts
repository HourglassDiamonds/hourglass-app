import {
  EVIDENCE_SOURCE_KINDS,
  PERSON_IDENTITY_KINDS,
  type ContinuumEvidence,
  type ContinuumException,
  type ContinuumJsonValue,
  type ContinuumObservation,
  type EvidenceSourceKind,
  type IdentityKind,
} from "./types";

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/;
const US_PHONE_RE =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/;
const FORBIDDEN_PII_KEYS = new Set([
  "email",
  "recipient",
  "recipientemail",
  "recipient_email",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "name",
  "phone",
  "phonenumber",
  "phone_number",
  "emailnormalized",
  "email_normalized",
  "emailhash",
  "email_hash",
]);

export type ContinuumValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function isPersonIdentityKind(value: string): value is IdentityKind {
  return (PERSON_IDENTITY_KINDS as readonly string[]).includes(value);
}

export function validateIdentityKind(value: string): ContinuumValidation {
  if (value === "hubspot_deal_id") {
    return {
      ok: false,
      reason: "hubspot_deal_id is a source-record reference, not a person identity",
    };
  }
  if (!isPersonIdentityKind(value)) {
    return { ok: false, reason: `unsupported identity kind: ${value}` };
  }
  return { ok: true };
}

export function validateConfidence(value: number): ContinuumValidation {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return { ok: false, reason: "confidence must be between 0.0 and 1.0" };
  }
  return { ok: true };
}

export function validateEvidenceSourceRefs(
  evidence: Pick<
    ContinuumEvidence,
    "sourceKind" | "sourceRecordId" | "eventId" | "observationId"
  >,
): ContinuumValidation {
  const { sourceKind, sourceRecordId, eventId, observationId } = evidence;
  if (!(EVIDENCE_SOURCE_KINDS as readonly string[]).includes(sourceKind)) {
    return { ok: false, reason: `unknown source kind: ${sourceKind}` };
  }
  const kind = sourceKind as EvidenceSourceKind;
  if (kind === "source-record") {
    if (!sourceRecordId) {
      return { ok: false, reason: "source-record evidence requires sourceRecordId" };
    }
    if (eventId != null || observationId != null) {
      return {
        ok: false,
        reason: "source-record evidence must not set eventId or observationId",
      };
    }
    return { ok: true };
  }
  if (kind === "event") {
    if (!eventId) {
      return { ok: false, reason: "event evidence requires eventId" };
    }
    if (observationId != null) {
      return { ok: false, reason: "event evidence must not set observationId" };
    }
    return { ok: true };
  }
  if (kind === "observation") {
    if (!observationId) {
      return { ok: false, reason: "observation evidence requires observationId" };
    }
    if (eventId != null) {
      return { ok: false, reason: "observation evidence must not set eventId" };
    }
    return { ok: true };
  }
  if (eventId != null || observationId != null) {
    return {
      ok: false,
      reason: `${kind} evidence must not set eventId or observationId`,
    };
  }
  return { ok: true };
}

export function isContinuumJsonValue(
  value: unknown,
): value is ContinuumJsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isContinuumJsonValue);
  if (t === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Object.values(value as Record<string, unknown>).every(
      isContinuumJsonValue,
    );
  }
  return false;
}

export function validateObservation(
  observation: Pick<ContinuumObservation, "confidence" | "epistemicClass" | "value">,
): ContinuumValidation {
  const confidence = validateConfidence(observation.confidence);
  if (!confidence.ok) return confidence;
  if (!isContinuumJsonValue(observation.value)) {
    return { ok: false, reason: "observation value is not JSON-safe" };
  }
  return { ok: true };
}

export function validateExceptionPayload(
  payload: ContinuumException["payload"],
): ContinuumValidation {
  const keys = Object.keys(payload);
  for (const key of keys) {
    if (key !== "emailsSent") {
      return { ok: false, reason: `exception payload forbids field: ${key}` };
    }
  }
  if (payload.emailsSent != null && payload.emailsSent !== 1) {
    return { ok: false, reason: "emailsSent must be 1 when present" };
  }
  return { ok: true };
}

export function findPiiViolation(value: unknown, path = "$"): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) return `${path}: email-shaped string`;
    if (US_PHONE_RE.test(value) && !/[a-z]/i.test(value)) {
      return `${path}: phone-shaped string`;
    }
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean") return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = findPiiViolation(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_PII_KEYS.has(key.replace(/_/g, "").toLowerCase())) {
        return `${path}.${key}: forbidden PII field`;
      }
      const hit = findPiiViolation(child, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

export function assertNoPii(value: unknown, label: string): ContinuumValidation {
  const hit = findPiiViolation(value);
  if (hit) return { ok: false, reason: `${label} PII rejected (${hit})` };
  return { ok: true };
}
