/**
 * Structured Person fact contracts. Birthday is the only typed fact in V1.
 * Do not introduce alternate type names (birthdate, dob, bday).
 */

import { CONCIERGE_MANUAL_SOURCE_SYSTEM } from "../write/types";
import type {
  ClientMemoryVisibility,
  FactApprovalStatus,
  FactStatus,
  UsagePermission,
} from "../types";

export const PERSON_FACT_TYPE_BIRTHDAY = "birthday" as const;

export type PersonFactTypeBirthday = typeof PERSON_FACT_TYPE_BIRTHDAY;

export const BIRTHDAY_CALENDAR_GREGORIAN = "gregorian" as const;

export type BirthdayCalendar = typeof BIRTHDAY_CALENDAR_GREGORIAN;

export const FACT_VERIFICATION_MANUAL = "manual" as const;

export type FactVerificationManual = typeof FACT_VERIFICATION_MANUAL;

export const MANUAL_BIRTHDAY_CREATED_BY = CONCIERGE_MANUAL_SOURCE_SYSTEM;

export const MANUAL_BIRTHDAY_SOURCE_SYSTEM = CONCIERGE_MANUAL_SOURCE_SYSTEM;

export const MANUAL_BIRTHDAY_CONFIDENCE = 1 as const;

export const MANUAL_BIRTHDAY_STATUS: FactStatus = "current";

export const MANUAL_BIRTHDAY_APPROVAL_STATUS: FactApprovalStatus = "approved";

export const MANUAL_BIRTHDAY_VISIBILITY: ClientMemoryVisibility = "internal-only";

export const MANUAL_BIRTHDAY_USAGE_PERMISSION: UsagePermission = "unset";

export const BIRTHDAY_YEAR_MIN = 1800 as const;
export const BIRTHDAY_YEAR_MAX = 2100 as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type BirthdayValue = {
  calendar: BirthdayCalendar;
  month: number;
  day: number | null;
  year: number | null;
};

export type BirthdayRead = {
  factId: string;
  personId: string;
  displayName: string;
  month: number;
  day: number | null;
  year: number | null;
  verification: string | null;
  sourceSystem: string;
};

export type BirthdayParseFailure = {
  ok: false;
  reason:
    | "missing-month"
    | "invalid-month"
    | "invalid-day"
    | "invalid-year"
    | "invalid-calendar"
    | "invalid-shape";
};

export type BirthdayParseSuccess = {
  ok: true;
  value: BirthdayValue;
};

export type BirthdayParseResult = BirthdayParseSuccess | BirthdayParseFailure;
