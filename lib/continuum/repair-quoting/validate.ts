/**
 * Bounded repair-quote parsing. No inference from operating notes or Gmail.
 */

import { parseUsdToCents } from "./money";
import {
  CREATED_BY_MAX,
  OVERRIDE_REASON_MAX,
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_STATES,
  REPAIR_QUOTE_TYPES,
  SOURCE_LINE_LABEL_MAX,
  SOURCE_SKU_MAX,
  type RepairMetalFamily,
  type RepairQuoteState,
  type RepairQuoteType,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRepairQuoteUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isRepairQuoteType(value: unknown): value is RepairQuoteType {
  return typeof value === "string" && (REPAIR_QUOTE_TYPES as readonly string[]).includes(value);
}

export function isRepairMetalFamily(value: unknown): value is RepairMetalFamily {
  return (
    typeof value === "string" &&
    (REPAIR_METAL_FAMILIES as readonly string[]).includes(value)
  );
}

export function isRepairQuoteState(value: unknown): value is RepairQuoteState {
  return typeof value === "string" && (REPAIR_QUOTE_STATES as readonly string[]).includes(value);
}

export function parseRequiredText(
  raw: string | null | undefined,
  max: number,
): string | null {
  const next = raw?.trim() ?? "";
  if (!next || next.length > max || /[\u0000\n\r]/.test(next)) return null;
  return next;
}

export function parseSku(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, SOURCE_SKU_MAX);
}

export function parseTaskDescription(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, SOURCE_LINE_LABEL_MAX);
}

export function parseCreatedBy(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, CREATED_BY_MAX);
}

export function parseOverrideReason(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, OVERRIDE_REASON_MAX);
}

export function parseUsdCentsField(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return 0;
  return parseUsdToCents(trimmed);
}

export function parseOptionalUsdCents(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  return parseUsdToCents(trimmed);
}

export function parseGoldUsdPerOz(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const cents = parseUsdToCents(trimmed);
  if (cents == null || cents % 100 !== 0) return null;
  const usd = cents / 100;
  if (!Number.isInteger(usd) || usd <= 0 || usd > 99_999) return null;
  return usd;
}

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
