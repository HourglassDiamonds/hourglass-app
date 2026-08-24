/**
 * Deterministic current-birthday reads. No notes, Gmail, or LLM.
 */

import type { PersonFact } from "../types";
import { parseBirthdayValue } from "../facts/date";
import {
  PERSON_FACT_TYPE_BIRTHDAY,
  type BirthdayRead,
} from "../facts/types";

export function isCalendarMonth(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
}

export function birthdayReadFromFact(
  fact: PersonFact,
  displayName: string,
): BirthdayRead | null {
  if (fact.factType !== PERSON_FACT_TYPE_BIRTHDAY) return null;
  if (fact.status !== "current") return null;
  const parsed = parseBirthdayValue(fact.value);
  if (!parsed.ok) return null;
  const name = displayName.trim();
  if (!name) return null;
  return {
    factId: fact.id,
    personId: fact.personId,
    displayName: name,
    month: parsed.value.month,
    day: parsed.value.day,
    year: parsed.value.year,
    verification: fact.verification,
    sourceSystem: fact.sourceSystem,
  };
}

export function listCurrentBirthdaysByMonthFromRows(input: {
  month: number;
  facts: PersonFact[];
  namesByPersonId: Map<string, string>;
}): BirthdayRead[] {
  if (!isCalendarMonth(input.month)) return [];
  const rows: BirthdayRead[] = [];
  for (const fact of input.facts) {
    const name = input.namesByPersonId.get(fact.personId);
    if (!name) continue;
    const row = birthdayReadFromFact(fact, name);
    if (!row || row.month !== input.month) continue;
    rows.push(row);
  }
  rows.sort((a, b) => {
    if (a.day == null && b.day == null) return a.displayName.localeCompare(b.displayName);
    if (a.day == null) return 1;
    if (b.day == null) return -1;
    if (a.day !== b.day) return a.day - b.day;
    return a.displayName.localeCompare(b.displayName);
  });
  return rows;
}
