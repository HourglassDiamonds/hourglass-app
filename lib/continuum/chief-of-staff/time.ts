import { COS_FOUNDER_TIME_ZONE } from "./constants";

export function founderCivilDate(
  now: Date,
  timeZone: string = COS_FOUNDER_TIME_ZONE,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function founderLocalDate(
  now: Date,
  timeZone: string = COS_FOUNDER_TIME_ZONE,
): string {
  const { year, month, day } = founderCivilDate(now, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
