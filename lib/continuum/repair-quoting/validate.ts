/**
 * Bounded repair-quote parsing. No inference from operating notes or Gmail.
 */

import { parseDateOnly } from "@/lib/continuum/date-only";
import { parseDwtToMillidwt } from "./gold";
import { parseUsdToCents } from "./money";
import {
  CREATED_BY_MAX,
  GOLD_INPUT_SOURCES,
  GOLD_WEIGHT_KINDS,
  MARKUP_PERMYRIAD_ONE,
  OVERRIDE_REASON_MAX,
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_STATES,
  REPAIR_QUOTE_TYPES,
  SOURCE_EDITION_MAX,
  SOURCE_LINE_LABEL_MAX,
  SOURCE_LINE_REF_MAX,
  SOURCE_PRICE_SEMANTICS,
  type GoldInputSource,
  type GoldWeightKind,
  type RepairMetalFamily,
  type RepairQuoteState,
  type RepairQuoteType,
  type SourcePriceSemantics,
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

export function isSourcePriceSemantics(value: unknown): value is SourcePriceSemantics {
  return (
    typeof value === "string" &&
    (SOURCE_PRICE_SEMANTICS as readonly string[]).includes(value)
  );
}

export function isGoldInputSource(value: unknown): value is GoldInputSource {
  return typeof value === "string" && (GOLD_INPUT_SOURCES as readonly string[]).includes(value);
}

export function isGoldWeightKind(value: unknown): value is GoldWeightKind {
  return typeof value === "string" && (GOLD_WEIGHT_KINDS as readonly string[]).includes(value);
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

export function parseSourceEdition(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, SOURCE_EDITION_MAX);
}

export function parseSourceLineRef(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, SOURCE_LINE_REF_MAX);
}

export function parseSourceLineLabel(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, SOURCE_LINE_LABEL_MAX);
}

export function parseCreatedBy(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, CREATED_BY_MAX);
}

export function parseOverrideReason(raw: string | null | undefined): string | null {
  return parseRequiredText(raw, OVERRIDE_REASON_MAX);
}

export function parseMarkupRatioPermyriad(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n < 10) return Math.round(n * MARKUP_PERMYRIAD_ONE);
  if (Number.isInteger(n) && n >= MARKUP_PERMYRIAD_ONE && n <= 99_999) return n;
  return null;
}

export function parseUsdCentsField(raw: string | null | undefined): number | null {
  return parseUsdToCents(raw);
}

export function parseWeightMillidwt(raw: string | null | undefined): number | null {
  return parseDwtToMillidwt(raw);
}

export function parseRequiredDate(raw: string | null | undefined): string | null {
  return parseDateOnly(raw);
}
