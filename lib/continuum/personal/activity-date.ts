import type { VisibleActivityDate } from "./types";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ActivityDateComparison = "match" | "conflict" | "unknown";

export function compareActivityDate(sourceDate: VisibleActivityDate | undefined, selectedDate: string): ActivityDateComparison {
  if (!sourceDate || sourceDate.evidence !== "observed") return "unknown";
  const match = DATE_KEY.exec(selectedDate);
  if (!match) return "unknown";
  const [, year, month, day] = match;
  if (Number(month) !== sourceDate.month || Number(day) !== sourceDate.day) return "conflict";
  return sourceDate.year === undefined || Number(year) === sourceDate.year ? "match" : "conflict";
}

export function visibleActivityDateLabel(sourceDate: VisibleActivityDate): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2020, sourceDate.month - 1, 1)));
  return `${month} ${sourceDate.day}${sourceDate.year === undefined ? " (year not visible)" : `, ${sourceDate.year}`}`;
}
