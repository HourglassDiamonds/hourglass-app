import type { LedgerRunType } from "./types";

const TIME_ZONE = "America/New_York";

export type LedgerScheduleDecision = {
  execute: boolean;
  localDate: string;
  localWeekday: string;
  localTime: string;
  reason: string;
};

export function evaluateLedgerSchedule(now: Date, runType: LedgerRunType): LedgerScheduleDecision {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const localDate = `${value("year")}-${value("month")}-${value("day")}`;
  const localWeekday = value("weekday");
  const localTime = `${value("hour")}:${value("minute")}`;
  const expectedWeekday = runType === "TUESDAY_FULL" ? "Tue" : "Fri";
  const execute = localWeekday === expectedWeekday && localTime === "06:30";
  return {
    execute,
    localDate,
    localWeekday,
    localTime,
    reason: execute
      ? `Accepted ${expectedWeekday} 06:30 America/New_York candidate.`
      : `Ignored candidate outside ${expectedWeekday} 06:30 America/New_York.`,
  };
}
