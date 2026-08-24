/**
 * Pure Continuum home composition.
 * V1: founder greeting + honestly quiet Chief of Staff.
 * No Agent OS, SLA, reviews, or invented recommendations.
 */

import type {
  ContinuumHomeModel,
  GreetingPeriod,
} from "./types";

export const CONTINUUM_FOUNDER_DISPLAY_NAME = "Justin" as const;
export const CONTINUUM_FOUNDER_TIME_ZONE = "America/New_York";

export type ComposeContinuumHomeInput = {
  now?: Date;
};

function founderLocalHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTINUUM_FOUNDER_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const raw = parts.find((part) => part.type === "hour")?.value;
  const hour = raw == null ? Number.NaN : Number(raw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return now.getHours();
  }
  return hour;
}

export function greetingPeriodFromDate(now: Date): GreetingPeriod {
  const hour = founderLocalHour(now);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function greetingLine(model: Pick<ContinuumHomeModel, "greeting">): string {
  return `Good ${model.greeting.period}, ${model.greeting.displayName}.`;
}

export function composeContinuumHome(
  input: ComposeContinuumHomeInput = {},
): ContinuumHomeModel {
  const now = input.now ?? new Date();
  return {
    greeting: {
      period: greetingPeriodFromDate(now),
      displayName: CONTINUUM_FOUNDER_DISPLAY_NAME,
    },
    chiefOfStaff: {
      status: "quiet",
      items: [],
    },
  };
}
