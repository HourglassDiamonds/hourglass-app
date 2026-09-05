/**
 * Bounded Open Job parsing. No inference from prose, notes, or Gmail bodies.
 */

import {
  OPEN_JOB_ACTORS,
  OPEN_JOB_CREATED_BY_MAX,
  OPEN_JOB_DETAIL_MAX,
  OPEN_JOB_KINDS,
  OPEN_JOB_SOURCE_REF_MAX,
  OPEN_JOB_SOURCE_SYSTEMS,
  OPEN_JOB_STATES,
  OPEN_JOB_SUBJECT_MAX,
  UNRESOLVED_OPEN_JOB_STATES,
  type OpenJobActor,
  type OpenJobKind,
  type OpenJobSourceSystem,
  type OpenJobState,
  type UnresolvedOpenJobState,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isOpenJobKind(value: unknown): value is OpenJobKind {
  return typeof value === "string" && (OPEN_JOB_KINDS as readonly string[]).includes(value);
}

export function isOpenJobActor(value: unknown): value is OpenJobActor {
  return typeof value === "string" && (OPEN_JOB_ACTORS as readonly string[]).includes(value);
}

export function isOpenJobState(value: unknown): value is OpenJobState {
  return typeof value === "string" && (OPEN_JOB_STATES as readonly string[]).includes(value);
}

export function isUnresolvedOpenJobState(
  value: unknown,
): value is UnresolvedOpenJobState {
  return (
    typeof value === "string" &&
    (UNRESOLVED_OPEN_JOB_STATES as readonly string[]).includes(value)
  );
}

export function isOpenJobSourceSystem(
  value: unknown,
): value is OpenJobSourceSystem {
  return (
    typeof value === "string" &&
    (OPEN_JOB_SOURCE_SYSTEMS as readonly string[]).includes(value)
  );
}

export function isOpenJobUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseOpenJobSubject(
  value: string | null | undefined,
): { ok: true; subject: string } | { ok: false } {
  if (value == null) return { ok: false };
  const subject = value.trim();
  if (
    !subject ||
    subject.length > OPEN_JOB_SUBJECT_MAX ||
    /[\n\r]/.test(subject)
  ) {
    return { ok: false };
  }
  return { ok: true, subject };
}

export function parseOpenJobDetail(
  value: string | null | undefined,
): { ok: true; detail: string | null } | { ok: false } {
  if (value == null || value.trim() === "") return { ok: true, detail: null };
  if (value.length > OPEN_JOB_DETAIL_MAX || value.includes("\u0000")) {
    return { ok: false };
  }
  return { ok: true, detail: value };
}

export function parseOpenJobSourceRef(
  value: string | null | undefined,
): { ok: true; sourceRef: string | null } | { ok: false } {
  const sourceRef = trimOrNull(value);
  if (!sourceRef) return { ok: true, sourceRef: null };
  if (
    sourceRef.length > OPEN_JOB_SOURCE_REF_MAX ||
    /[\n\r]/.test(sourceRef)
  ) {
    return { ok: false };
  }
  return { ok: true, sourceRef };
}

export function parseOpenJobCreatedBy(
  value: string | null | undefined,
): { ok: true; createdBy: string } | { ok: false } {
  const createdBy = trimOrNull(value);
  if (!createdBy || createdBy.length > OPEN_JOB_CREATED_BY_MAX) {
    return { ok: false };
  }
  return { ok: true, createdBy };
}

export function parseOptionalIso(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false } {
  const trimmed = trimOrNull(value);
  if (!trimmed) return { ok: true, value: null };
  if (!ISO_RE.test(trimmed)) return { ok: false };
  return { ok: true, value: trimmed };
}

export function stateTimestampsValid(input: {
  state: OpenJobState;
  deferredUntil: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
}): boolean {
  if (input.state === "open") {
    return (
      input.deferredUntil == null &&
      input.resolvedAt == null &&
      input.cancelledAt == null
    );
  }
  if (input.state === "snoozed") {
    return (
      input.deferredUntil != null &&
      input.resolvedAt == null &&
      input.cancelledAt == null
    );
  }
  if (input.state === "resolved") {
    return (
      input.resolvedAt != null &&
      input.cancelledAt == null &&
      input.deferredUntil == null
    );
  }
  return (
    input.cancelledAt != null &&
    input.resolvedAt == null &&
    input.deferredUntil == null
  );
}
