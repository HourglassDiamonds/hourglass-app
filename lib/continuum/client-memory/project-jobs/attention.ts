import {
  ATTENTION_ASSUMPTIONS_MAX,
  ATTENTION_CONDITION_MAX,
  ATTENTION_METADATA_MAX_BYTES,
  ATTENTION_MODES,
  ATTENTION_REFERENCE_MAX,
  ATTENTION_TIMING_PRECISIONS,
  ATTENTION_WORDING_MAX,
  type AttentionMetadata,
  type AttentionMode,
  type ProjectJob,
} from "./types";
import { parseOptionalIso } from "./validate";

const METADATA_KEYS = new Set([
  "version", "timingPrecision", "timezone", "originalWording",
  "referenceInstant", "originalLocalDateTime", "conditionPolicy",
  "conditionText", "targetIdentity", "workstreamIdentity",
  "obligationIdentity", "sourceReference", "revisionReference",
  "commitmentReference", "assumptions", "unscheduledConfirmed",
]);
const OPTIONAL_REFERENCE_KEYS = [
  "targetIdentity", "workstreamIdentity", "obligationIdentity",
  "sourceReference", "revisionReference", "commitmentReference",
] as const;

export type AttentionValidationCode =
  | "invalid-attention-mode"
  | "invalid-attention-schedule"
  | "invalid-attention-metadata"
  | "unsupported-attention-metadata-version";

export type CanonicalAttention = {
  attentionMode: AttentionMode;
  activationAt: string | null;
  checkpointAt: string | null;
  attentionMetadata: AttentionMetadata | null;
};

export function attentionModeOf(job: Pick<ProjectJob, "attentionMode">): AttentionMode {
  return job.attentionMode ?? "action";
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

function boundedText(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && (allowEmpty || value.trim().length > 0) && value.length <= max && !value.includes("\u0000");
}

export function parseAttentionMetadata(value: unknown):
  | { ok: true; value: AttentionMetadata | null }
  | { ok: false; code: AttentionValidationCode } {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return { ok: false, code: "invalid-attention-metadata" }; }
  if (new TextEncoder().encode(serialized).byteLength > ATTENTION_METADATA_MAX_BYTES) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  const row = value as Record<string, unknown>;
  if (row.version !== 1) {
    return { ok: false, code: "unsupported-attention-metadata-version" };
  }
  if (Object.keys(row).some((key) => !METADATA_KEYS.has(key))) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  if (!(ATTENTION_TIMING_PRECISIONS as readonly unknown[]).includes(row.timingPrecision) ||
      !boundedText(row.timezone, 100) || !isIanaTimezone(row.timezone) ||
      !boundedText(row.originalWording, ATTENTION_WORDING_MAX) ||
      !boundedText(row.originalLocalDateTime, 64) ||
      row.conditionPolicy !== "review-only" ||
      !Array.isArray(row.assumptions) || row.assumptions.length > ATTENTION_ASSUMPTIONS_MAX ||
      row.assumptions.some((item) => !boundedText(item, ATTENTION_REFERENCE_MAX))) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  const reference = parseOptionalIso(typeof row.referenceInstant === "string" ? row.referenceInstant : null);
  if (!reference.ok || reference.value == null) return { ok: false, code: "invalid-attention-metadata" };
  if (row.conditionText !== undefined && !boundedText(row.conditionText, ATTENTION_CONDITION_MAX)) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  for (const key of OPTIONAL_REFERENCE_KEYS) {
    if (row[key] !== undefined && !boundedText(row[key], ATTENTION_REFERENCE_MAX)) {
      return { ok: false, code: "invalid-attention-metadata" };
    }
  }
  if (row.unscheduledConfirmed !== undefined && row.unscheduledConfirmed !== true) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  return { ok: true, value: structuredClone(row) as AttentionMetadata };
}

export function parseAttention(input: {
  attentionMode?: unknown;
  activationAt?: string | null;
  checkpointAt?: string | null;
  attentionMetadata?: unknown;
  waitingOnActor: string;
}): { ok: true; value: CanonicalAttention } | { ok: false; code: AttentionValidationCode } {
  const mode = input.attentionMode ?? "action";
  if (!(ATTENTION_MODES as readonly unknown[]).includes(mode)) {
    return { ok: false, code: "invalid-attention-mode" };
  }
  const activation = parseOptionalIso(input.activationAt);
  const checkpoint = parseOptionalIso(input.checkpointAt);
  const metadata = parseAttentionMetadata(input.attentionMetadata);
  if (!activation.ok || !checkpoint.ok) return { ok: false, code: "invalid-attention-schedule" };
  if (!metadata.ok) return metadata;
  if (mode === "action" && (activation.value != null || checkpoint.value != null)) {
    return { ok: false, code: "invalid-attention-schedule" };
  }
  if (mode === "reminder" && (activation.value == null || checkpoint.value != null || input.waitingOnActor !== "founder")) {
    return { ok: false, code: "invalid-attention-schedule" };
  }
  if (mode === "watching" && activation.value != null) {
    return { ok: false, code: "invalid-attention-schedule" };
  }
  if (mode === "watching" && checkpoint.value == null && metadata.value?.unscheduledConfirmed !== true) {
    return { ok: false, code: "invalid-attention-schedule" };
  }
  if (mode !== "action" && metadata.value == null) {
    return { ok: false, code: "invalid-attention-metadata" };
  }
  return {
    ok: true,
    value: {
      attentionMode: mode as AttentionMode,
      activationAt: activation.value,
      checkpointAt: checkpoint.value,
      attentionMetadata: metadata.value,
    },
  };
}

export function canonicalAttentionOf(job: ProjectJob): CanonicalAttention {
  return {
    attentionMode: attentionModeOf(job),
    activationAt: job.activationAt ?? null,
    checkpointAt: job.checkpointAt ?? null,
    attentionMetadata: job.attentionMetadata ?? null,
  };
}

export function exactAttentionIdentity(job: Pick<ProjectJob,
  "sourceRef" | "attentionMetadata">): string | null {
  const metadata = job.attentionMetadata;
  const parts = [metadata?.sourceReference, metadata?.revisionReference,
    metadata?.obligationIdentity, metadata?.commitmentReference].filter(Boolean);
  return parts.length > 0 ? parts.join("\u001f") : null;
}
