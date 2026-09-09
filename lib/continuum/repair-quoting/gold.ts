/**
 * Gold-weight and stale-gold helpers.
 * Metal delta uses troy math only: 20 dwt = 1 troy oz.
 * Does not invent Geller dwt tables.
 */

import {
  addCalendarDays,
  compareDateOnly,
  parseDateOnly,
  type DateOnly,
} from "@/lib/continuum/date-only";
import {
  GOLD_KARAT_BY_METAL,
  GOLD_STALE_AFTER_DAYS,
  TROY_OZ_TO_DWT,
  type GoldWeightKind,
  type RepairMetalFamily,
} from "./types";

const MILLIDWT_RE = /^([0-9]{1,6})(?:\.([0-9]{1,3}))?$/;

export function parseDwtToMillidwt(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const match = MILLIDWT_RE.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = (match[2] ?? "").padEnd(3, "0");
  const millidwt = whole * 1000 + Number(frac || "0");
  if (!Number.isInteger(millidwt) || millidwt <= 0 || millidwt > 9_999_999) {
    return null;
  }
  return millidwt;
}

export function formatMillidwt(millidwt: number): string {
  if (!Number.isInteger(millidwt) || millidwt < 0) return "";
  const whole = Math.floor(millidwt / 1000);
  const frac = String(millidwt % 1000).padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

export function fineGoldMillidwt(input: {
  kind: GoldWeightKind;
  millidwt: number;
  metalFamily: RepairMetalFamily;
}): number | null {
  if (!Number.isInteger(input.millidwt) || input.millidwt <= 0) return null;
  if (input.kind === "fine_dwt") return input.millidwt;
  const karat = GOLD_KARAT_BY_METAL[input.metalFamily];
  if (karat == null) return null;
  return Math.round((input.millidwt * karat) / 24);
}

export function metalDeltaCents(input: {
  currentUsdCentsPerTroyOz: number;
  baselineUsdCentsPerTroyOz: number;
  fineMillidwt: number;
}): number {
  const current = input.currentUsdCentsPerTroyOz;
  const baseline = input.baselineUsdCentsPerTroyOz;
  const weight = input.fineMillidwt;
  if (
    !Number.isInteger(current) ||
    !Number.isInteger(baseline) ||
    !Number.isInteger(weight) ||
    weight < 0
  ) {
    throw new Error("invalid-gold-weight");
  }
  return Math.round(
    ((current - baseline) * weight) / (TROY_OZ_TO_DWT * 1000),
  );
}

export function goldIsStale(input: {
  goldAsOfDate: DateOnly;
  quoteDate: DateOnly;
}): boolean {
  const cutoff = addCalendarDays(input.quoteDate, -GOLD_STALE_AFTER_DAYS);
  if (!cutoff) return false;
  return compareDateOnly(input.goldAsOfDate, cutoff) < 0;
}

export function parseGoldDate(raw: string | null | undefined): DateOnly | null {
  return parseDateOnly(raw);
}
