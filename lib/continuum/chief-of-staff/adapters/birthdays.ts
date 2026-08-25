/**
 * Upcoming birthday worth-knowing adapter.
 * Current approved facts with a known day only. No age. No year in copy.
 */

import { upcomingBirthdays } from "@/lib/continuum/client-memory/facts/date";
import type { BirthdayRead } from "@/lib/continuum/client-memory/facts/types";
import { birthdayReadFromFact } from "@/lib/continuum/client-memory/read/birthdays";
import type { PersonFact } from "@/lib/continuum/client-memory/types";
import { BIRTHDAY_HORIZON_DAYS, COS_FOUNDER_TIME_ZONE } from "../constants";
import type { SpecialistObservation } from "../types";

export function approvedBirthdayReads(input: {
  facts: PersonFact[];
  namesByPersonId: Map<string, string>;
}): BirthdayRead[] {
  const rows: BirthdayRead[] = [];
  for (const fact of input.facts) {
    if (fact.approvalStatus !== "approved") continue;
    const name = input.namesByPersonId.get(fact.personId);
    if (!name) continue;
    const row = birthdayReadFromFact(fact, name);
    if (!row || row.day == null) continue;
    rows.push(row);
  }
  return rows;
}

export function birthdayHeadline(displayName: string, daysUntil: number): string {
  const first = displayName.trim();
  if (daysUntil === 0) return `${first}'s birthday is today.`;
  if (daysUntil === 1) return `${first}'s birthday is in 1 day.`;
  return `${first}'s birthday is in ${daysUntil} days.`;
}

export function observationsFromUpcomingBirthdays(input: {
  birthdays: BirthdayRead[];
  now: Date;
  observedAt: string;
  horizonDays?: number;
  timeZone?: string;
}): SpecialistObservation[] {
  const horizon = input.horizonDays ?? BIRTHDAY_HORIZON_DAYS;
  const upcoming = upcomingBirthdays(
    input.birthdays,
    input.now,
    input.timeZone ?? COS_FOUNDER_TIME_ZONE,
    horizon,
  );

  return upcoming.map((row) => ({
    specialist: "client-memory" as const,
    kind: "birthday-upcoming",
    subject: { personId: row.personId },
    summary: birthdayHeadline(row.displayName, row.daysUntil),
    epistemicClass: "observed" as const,
    importanceHint: "low" as const,
    urgencyHint: "watch" as const,
    audienceHint: "fyi" as const,
    confidence: "high" as const,
    evidenceIds: [],
    observationIds: [],
    observedAt: input.observedAt,
    dedupeKey: `birthday:${row.personId}:${row.month}-${row.day}`,
    changeClass: "novel" as const,
  }));
}
