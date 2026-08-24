/**
 * Ask Concierge V1 contracts. Deterministic structured lookup only.
 * No LLM, persistence, or conversation history.
 */

import { MONTH_NAMES, type BirthdayRead } from "../facts/types";

export const ASK_CONCIERGE_QUERY_MAX_LENGTH = 400;

export const ASK_UNSUPPORTED_MESSAGE =
  "I can't answer that from structured memory yet." as const;

export const ASK_UNSUPPORTED_DETAIL = "Birthday lookups are connected first." as const;

export const ASK_ERROR_MESSAGE =
  "I couldn't read relationship memory just now." as const;

export const ASK_PENDING_MESSAGE = "Looking…" as const;

export type AskConciergeIntent =
  | {
      kind: "birthdays-by-month";
      month: number;
    }
  | {
      kind: "birthdays-next-month";
    }
  | {
      kind: "unsupported";
    };

export type AskConciergeAnswer =
  | {
      kind: "birthdays-by-month";
      month: number;
      people: BirthdayRead[];
    }
  | {
      kind: "unsupported";
    }
  | {
      kind: "error";
    };

export function formatAskBirthdayDate(row: Pick<BirthdayRead, "month" | "day">): string {
  const monthName = MONTH_NAMES[row.month - 1];
  if (!monthName) return "";
  if (row.day == null) return monthName;
  return `${monthName} ${row.day}`;
}

export function askBirthdaysByMonthHeadline(month: number, count: number): string {
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) return ASK_ERROR_MESSAGE;
  if (count === 0) {
    return `No birthdays are currently recorded for ${monthName}.`;
  }
  if (count === 1) {
    return `I currently have 1 ${monthName} birthday recorded.`;
  }
  return `I currently have ${count} ${monthName} birthdays recorded.`;
}
