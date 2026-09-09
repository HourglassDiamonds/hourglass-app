/**
 * Fail-closed Blue Book quote calculator.
 * Does not ship book prices. Does not default historical gold or markup.
 */

import { parseDateOnly } from "@/lib/continuum/date-only";
import { fineGoldMillidwt, goldIsStale, metalDeltaCents } from "./gold";
import { roundRatioCents } from "./money";
import {
  GOLD_INPUT_SOURCES,
  GOLD_KARAT_BY_METAL,
  GOLD_WEIGHT_KINDS,
  MARKUP_PERMYRIAD_ONE,
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_SOURCE_FAMILY,
  REPAIR_QUOTE_TYPES,
  SOURCE_EDITION_MAX,
  SOURCE_LINE_LABEL_MAX,
  SOURCE_LINE_REF_MAX,
  SOURCE_PRICE_SEMANTICS,
  type RepairQuoteCalculateResult,
  type RepairQuoteCalculationInput,
  type RepairQuoteInvalidCode,
  type RepairQuoteLineResult,
  type RepairQuoteWarning,
  type SourcePriceSemantics,
} from "./types";

function fail(code: RepairQuoteInvalidCode): RepairQuoteCalculateResult {
  return { ok: false, reason: "invalid-input", code };
}

function isPositiveCents(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 99_999_999_00;
}

function isNonNegativeCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 99_999_999_00;
}

function trimmed(value: string | null | undefined, max: number): string | null {
  const next = value?.trim() ?? "";
  if (!next || next.length > max || /[\u0000\n\r]/.test(next)) return null;
  return next;
}

export function defaultGoldSensitive(input: {
  repairType: RepairQuoteCalculationInput["repairType"];
  metalFamily: RepairQuoteCalculationInput["metalFamily"];
}): boolean {
  const policy =
    input.repairType === "fourteen_k_operation"
      ? "gold_sensitive"
      : input.repairType === "laser_work" ||
          input.repairType === "stone_reset" ||
          input.repairType === "platinum_labor"
        ? "not_gold_sensitive"
        : "metal_dependent";
  if (policy === "gold_sensitive") return true;
  if (policy === "not_gold_sensitive") return false;
  return GOLD_KARAT_BY_METAL[input.metalFamily] != null;
}

export function calculateRepairQuote(
  input: RepairQuoteCalculationInput,
): RepairQuoteCalculateResult {
  if (!(REPAIR_QUOTE_TYPES as readonly string[]).includes(input.repairType)) {
    return fail("invalid-repair-type");
  }
  if (!(REPAIR_METAL_FAMILIES as readonly string[]).includes(input.metalFamily)) {
    return fail("invalid-metal");
  }
  const sourceEdition = trimmed(input.sourceEditionLabel, SOURCE_EDITION_MAX);
  if (!sourceEdition) return fail("invalid-source-edition");
  if (!input.sourcePriceSemantics) return fail("missing-source-semantics");
  if (
    !(SOURCE_PRICE_SEMANTICS as readonly string[]).includes(
      input.sourcePriceSemantics,
    )
  ) {
    return fail("invalid-source-semantics");
  }
  const semantics = input.sourcePriceSemantics as SourcePriceSemantics;
  const quoteDate = parseDateOnly(input.quoteDate);
  const goldDate = parseDateOnly(input.gold.asOfDate);
  if (!quoteDate || !goldDate) return fail("invalid-gold-input");
  if (
    !(GOLD_INPUT_SOURCES as readonly string[]).includes(input.gold.source) ||
    !isPositiveCents(input.gold.usdCentsPerTroyOz)
  ) {
    return fail("invalid-gold-input");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return fail("missing-lines");
  }

  const needsGold =
    input.lines.some((line) => line.goldSensitive) ||
    input.gold.baselineUsdCentsPerTroyOz != null;
  if (needsGold && input.lines.some((line) => line.goldSensitive)) {
    if (input.gold.baselineUsdCentsPerTroyOz == null) {
      return fail("missing-gold-baseline");
    }
    if (!isPositiveCents(input.gold.baselineUsdCentsPerTroyOz)) {
      return fail("invalid-gold-input");
    }
  }

  const lines: RepairQuoteLineResult[] = [];
  for (const line of input.lines) {
    const sourceLineRef = trimmed(line.sourceLineRef, SOURCE_LINE_REF_MAX);
    const sourceLineLabel = trimmed(line.sourceLineLabel, SOURCE_LINE_LABEL_MAX);
    if (!sourceLineRef || !sourceLineLabel) return fail("invalid-source-line");
    if (!isPositiveCents(line.sourceAmountCents)) {
      return fail("invalid-source-amount");
    }
    if (line.goldSensitive && GOLD_KARAT_BY_METAL[input.metalFamily] == null) {
      if (input.metalFamily === "platinum") return fail("platinum-is-not-gold");
      return fail("missing-gold-weight");
    }
    const hasManual =
      line.manualMetalDeltaCents != null &&
      Number.isInteger(line.manualMetalDeltaCents);
    if (line.goldSensitive && hasManual) {
      return fail("double-material-adjustment");
    }
    if (!line.goldSensitive && hasManual) {
      if (!Number.isInteger(line.manualMetalDeltaCents)) {
        return fail("invalid-gold-weight");
      }
      const delta = line.manualMetalDeltaCents as number;
      lines.push({
        sourceLineRef,
        sourceLineLabel,
        sourceAmountCents: line.sourceAmountCents,
        goldSensitive: false,
        goldWeightKind: null,
        goldWeightMillidwt: null,
        fineGoldMillidwt: null,
        metalDeltaCents: delta,
        adjustedSourceCents: line.sourceAmountCents + delta,
      });
      continue;
    }
    if (!line.goldSensitive) {
      lines.push({
        sourceLineRef,
        sourceLineLabel,
        sourceAmountCents: line.sourceAmountCents,
        goldSensitive: false,
        goldWeightKind: null,
        goldWeightMillidwt: null,
        fineGoldMillidwt: null,
        metalDeltaCents: 0,
        adjustedSourceCents: line.sourceAmountCents,
      });
      continue;
    }
    if (
      input.gold.baselineUsdCentsPerTroyOz == null ||
      !isPositiveCents(input.gold.baselineUsdCentsPerTroyOz)
    ) {
      return fail("missing-gold-baseline");
    }
    const kind = line.goldWeightKind ?? null;
    if (!kind || !(GOLD_WEIGHT_KINDS as readonly string[]).includes(kind)) {
      return fail("missing-gold-weight");
    }
    const millidwt = line.goldWeightMillidwt;
    if (millidwt == null || !Number.isInteger(millidwt) || millidwt <= 0) {
      return fail("missing-gold-weight");
    }
    const fine = fineGoldMillidwt({
      kind,
      millidwt,
      metalFamily: input.metalFamily,
    });
    if (fine == null) return fail("invalid-gold-weight");
    const delta = metalDeltaCents({
      currentUsdCentsPerTroyOz: input.gold.usdCentsPerTroyOz,
      baselineUsdCentsPerTroyOz: input.gold.baselineUsdCentsPerTroyOz,
      fineMillidwt: fine,
    });
    lines.push({
      sourceLineRef,
      sourceLineLabel,
      sourceAmountCents: line.sourceAmountCents,
      goldSensitive: true,
      goldWeightKind: kind,
      goldWeightMillidwt: millidwt,
      fineGoldMillidwt: fine,
      metalDeltaCents: delta,
      adjustedSourceCents: line.sourceAmountCents + delta,
    });
  }

  const sourceAmountTotalCents = lines.reduce(
    (sum, line) => sum + line.sourceAmountCents,
    0,
  );
  const metalDeltaTotalCents = lines.reduce(
    (sum, line) => sum + line.metalDeltaCents,
    0,
  );
  const adjustedSourceTotalCents = lines.reduce(
    (sum, line) => sum + line.adjustedSourceCents,
    0,
  );
  if (!isNonNegativeCents(adjustedSourceTotalCents) && adjustedSourceTotalCents < 0) {
    return fail("invalid-source-amount");
  }

  let markupRatioPermyriad: number | null = input.markupRatioPermyriad;
  if (semantics === "suggested_retail") {
    if (markupRatioPermyriad == null || markupRatioPermyriad === MARKUP_PERMYRIAD_ONE) {
      markupRatioPermyriad = MARKUP_PERMYRIAD_ONE;
    } else {
      return fail("double-markup-blocked");
    }
  } else {
    if (markupRatioPermyriad == null) return fail("missing-markup");
    if (
      !Number.isInteger(markupRatioPermyriad) ||
      markupRatioPermyriad < MARKUP_PERMYRIAD_ONE ||
      markupRatioPermyriad > 99_999
    ) {
      return fail("invalid-markup");
    }
  }

  const computedHourglassQuoteCents =
    semantics === "suggested_retail"
      ? adjustedSourceTotalCents
      : roundRatioCents(adjustedSourceTotalCents, markupRatioPermyriad);

  const overrideAmount = input.overrideAmountCents ?? null;
  if (overrideAmount != null) {
    if (!isPositiveCents(overrideAmount)) return fail("invalid-override");
    const reason = trimmed(input.overrideReason ?? "", 240);
    if (!reason) return fail("invalid-override");
  }

  const warnings: RepairQuoteWarning[] = [];
  if (goldIsStale({ goldAsOfDate: goldDate, quoteDate })) {
    warnings.push("stale-gold");
  }

  return {
    ok: true,
    calculation: {
      sourceFamily: REPAIR_QUOTE_SOURCE_FAMILY,
      sourceEditionLabel: sourceEdition,
      sourcePriceSemantics: semantics,
      goldUsdCentsPerTroyOz: input.gold.usdCentsPerTroyOz,
      goldAsOfDate: goldDate,
      goldInputSource: input.gold.source,
      goldBaselineUsdCentsPerTroyOz: input.gold.baselineUsdCentsPerTroyOz,
      markupRatioPermyriad,
      lines,
      sourceAmountTotalCents,
      metalDeltaTotalCents,
      adjustedSourceTotalCents,
      computedHourglassQuoteCents,
      hourglassQuoteCents: overrideAmount ?? computedHourglassQuoteCents,
      overrideApplied: overrideAmount != null,
      warnings,
    },
  };
}
