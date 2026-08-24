/**
 * Deterministic Ask Concierge router.
 * Structured Client Memory reads only. No notes, Gmail, search, or LLM.
 */

import { CONTINUUM_FOUNDER_TIME_ZONE } from "../../dashboard/compose";
import { civilDateInTimeZone } from "../facts/date";
import type { ClientMemoryReader } from "../read/reader";
import { parseAskConciergeIntent } from "./intent";
import type { AskConciergeAnswer } from "./types";

function nextCalendarMonth(now: Date): number {
  const current = civilDateInTimeZone(now, CONTINUUM_FOUNDER_TIME_ZONE).month;
  return current === 12 ? 1 : current + 1;
}

async function readBirthdaysByMonth(
  reader: ClientMemoryReader,
  month: number,
): Promise<AskConciergeAnswer> {
  try {
    const people = await reader.listCurrentBirthdaysByMonth(month);
    return { kind: "birthdays-by-month", month, people };
  } catch {
    return { kind: "error" };
  }
}

export async function answerAskConciergeQuery(
  reader: ClientMemoryReader,
  query: string,
  now: Date = new Date(),
): Promise<AskConciergeAnswer> {
  const intent = parseAskConciergeIntent(query);
  switch (intent.kind) {
    case "unsupported":
      return { kind: "unsupported" };
    case "birthdays-by-month":
      return readBirthdaysByMonth(reader, intent.month);
    case "birthdays-next-month":
      return readBirthdaysByMonth(reader, nextCalendarMonth(now));
  }
}
