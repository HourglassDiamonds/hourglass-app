/**
 * Domain writer for manual structured Person facts.
 * V1: birthday only. Does not write Notes, Wishes, Evidence, or Observations.
 */

import type { ClientMemoryEntity, PersonFact } from "../types";
import {
  birthdayFromParts,
  birthdayValuesEqual,
  parseBirthdayValue,
} from "./date";
import {
  FACT_VERIFICATION_MANUAL,
  MANUAL_BIRTHDAY_APPROVAL_STATUS,
  MANUAL_BIRTHDAY_CONFIDENCE,
  MANUAL_BIRTHDAY_CREATED_BY,
  MANUAL_BIRTHDAY_SOURCE_SYSTEM,
  MANUAL_BIRTHDAY_STATUS,
  MANUAL_BIRTHDAY_USAGE_PERMISSION,
  MANUAL_BIRTHDAY_VISIBILITY,
  PERSON_FACT_TYPE_BIRTHDAY,
  type BirthdayValue,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SetCurrentPersonFactResult =
  | { status: "inserted"; record: PersonFact; supersededId: string | null }
  | { status: "already-present"; record: PersonFact };

export type SetManualBirthdayInput = {
  personId: string;
  submissionId: string;
  month: unknown;
  day?: unknown;
  year?: unknown;
};

export type SetManualBirthdayInvalidCode =
  | "invalid-id"
  | "missing-month"
  | "invalid-month"
  | "invalid-day"
  | "invalid-year"
  | "invalid-calendar"
  | "invalid-shape";

export type SetManualBirthdayResult =
  | {
      ok: true;
      factId: string;
      status: "inserted" | "already-present";
      supersededId: string | null;
      value: BirthdayValue;
    }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "person-not-found"
        | "idempotency-conflict"
        | "unavailable";
      code?: SetManualBirthdayInvalidCode;
    };

export type ManualBirthdayWriteDeps = {
  nowIso: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  setCurrentPersonFact: (
    fact: PersonFact,
  ) => Promise<SetCurrentPersonFactResult>;
};

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function buildManualBirthdayFact(input: {
  factId: string;
  personId: string;
  value: BirthdayValue;
  createdAt: string;
}): PersonFact {
  return {
    id: input.factId,
    personId: input.personId,
    factType: PERSON_FACT_TYPE_BIRTHDAY,
    value: input.value,
    confidence: MANUAL_BIRTHDAY_CONFIDENCE,
    verification: FACT_VERIFICATION_MANUAL,
    approvalStatus: MANUAL_BIRTHDAY_APPROVAL_STATUS,
    status: MANUAL_BIRTHDAY_STATUS,
    visibility: MANUAL_BIRTHDAY_VISIBILITY,
    usagePermission: MANUAL_BIRTHDAY_USAGE_PERMISSION,
    validFrom: null,
    validUntil: null,
    supersedesId: null,
    sourceSystem: MANUAL_BIRTHDAY_SOURCE_SYSTEM,
    createdAt: input.createdAt,
    createdBy: MANUAL_BIRTHDAY_CREATED_BY,
  };
}

export async function setManualBirthday(
  deps: ManualBirthdayWriteDeps,
  input: SetManualBirthdayInput,
): Promise<SetManualBirthdayResult> {
  const submissionId = input.submissionId.trim();
  const personId = input.personId.trim();
  if (!isUuid(submissionId) || !isUuid(personId)) {
    return { ok: false, reason: "invalid-input", code: "invalid-id" };
  }

  const parsed = birthdayFromParts({
    month: input.month,
    day: input.day,
    year: input.year,
  });
  if (!parsed.ok) {
    return { ok: false, reason: "invalid-input", code: parsed.reason };
  }

  try {
    const person = await deps.getEntity(personId);
    if (!person || person.kind !== "person") {
      return { ok: false, reason: "person-not-found" };
    }

    const fact = buildManualBirthdayFact({
      factId: submissionId,
      personId,
      value: parsed.value,
      createdAt: deps.nowIso(),
    });

    const result = await deps.setCurrentPersonFact(fact);
    const stored = parseBirthdayValue(result.record.value);
    if (!stored.ok) {
      return { ok: false, reason: "unavailable" };
    }
    if (
      result.status === "already-present" &&
      !birthdayValuesEqual(stored.value, parsed.value)
    ) {
      return { ok: false, reason: "idempotency-conflict" };
    }
    return {
      ok: true,
      factId: result.record.id,
      status: result.status,
      supersededId:
        result.status === "inserted" ? result.supersededId : null,
      value: stored.value,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("person-not-found")) {
      return { ok: false, reason: "person-not-found" };
    }
    if (message.includes("fact-id-conflict")) {
      return { ok: false, reason: "idempotency-conflict" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
