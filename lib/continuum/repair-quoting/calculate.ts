/**
 * Fail-closed Hourglass repair quote calculator.
 * Uses Geller Cost columns only. Never marks up bold retail.
 * Formula: 2.5 × (Cost Labor × 1.25 + Cost Parts + Cost Other + metal).
 * V1 then rounds the raw quote to nearest $5 without mutating source cost.
 */

import {
  GELLER_BLUE_BOOK,
  GELLER_COST_BASIS,
} from "./contract";
import { resolve14kMetalCost } from "./gold-14k";
import {
  centsToEighthCents,
  hourglassQuoteEighthCents,
  loadedLaborEighthCents,
  overrideCentsToEighthCents,
  roundToNearestFiveDollarsEighthCents,
} from "./money";
import {
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_SOURCE_FAMILY,
  REPAIR_QUOTE_TYPES,
  SOURCE_LINE_LABEL_MAX,
  SOURCE_SKU_MAX,
  type RepairQuoteCalculateResult,
  type RepairQuoteCalculationInput,
  type RepairQuoteInvalidCode,
  type RepairQuoteLineResult,
} from "./types";

function fail(code: RepairQuoteInvalidCode): RepairQuoteCalculateResult {
  return { ok: false, reason: "invalid-input", code };
}

function isNonNegativeCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 99_999_999_00;
}

function trimmed(value: string | null | undefined, max: number): string | null {
  const next = value?.trim() ?? "";
  if (!next || next.length > max || /[\u0000\n\r]/.test(next)) return null;
  return next;
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
  const line = input.line;
  if (!line) return fail("missing-lines");
  const sku = trimmed(line.sku, SOURCE_SKU_MAX);
  const taskDescription = trimmed(line.taskDescription, SOURCE_LINE_LABEL_MAX);
  if (!sku || !taskDescription) return fail("invalid-source-line");
  if (line.costBasis === "geller_price_columns") return fail("retail-used-as-cost");
  if (line.costBasis != null && line.costBasis !== GELLER_COST_BASIS) {
    return fail("retail-used-as-cost");
  }
  if (line.expressSelected) return fail("express-not-enabled");
  if (line.inventedMetalQuantity) return fail("invented-metal-quantity");
  const amounts = line.amounts;
  if (
    !amounts ||
    !isNonNegativeCents(amounts.priceLaborCents) ||
    !isNonNegativeCents(amounts.pricePartsCents) ||
    !isNonNegativeCents(amounts.priceOtherCents) ||
    !isNonNegativeCents(amounts.costLaborCents) ||
    !isNonNegativeCents(amounts.costPartsCents) ||
    !isNonNegativeCents(amounts.costOtherCents)
  ) {
    return fail("invalid-source-amount");
  }

  const metalResolved = resolve14kMetalCost({
    metalFamily: input.metalFamily,
    metalSensitive: line.metalSensitive,
    goldUsdPerOz: line.goldUsdPerOz,
    millidwt: line.millidwt,
  });
  if (!metalResolved.ok) return fail(metalResolved.code);
  const metal = metalResolved.result;
  const metalCostCents = metal.metalCostCents;
  const totalCostPartsCents = amounts.costPartsCents + metalCostCents;
  if (amounts.costLaborCents + totalCostPartsCents + amounts.costOtherCents <= 0) {
    return fail("invalid-source-amount");
  }

  const loadedLabor = loadedLaborEighthCents(amounts.costLaborCents);
  const partsCost = centsToEighthCents(totalCostPartsCents);
  const otherCost = centsToEighthCents(amounts.costOtherCents);
  const metalCost = centsToEighthCents(metalCostCents);
  const fullyLoaded = loadedLabor + partsCost + otherCost;
  const rawComputed = hourglassQuoteEighthCents({
    costLaborCents: amounts.costLaborCents,
    costPartsCents: totalCostPartsCents,
    costOtherCents: amounts.costOtherCents,
  });
  const roundedComputed = roundToNearestFiveDollarsEighthCents(rawComputed);

  const overrideAmount = input.overrideAmountCents ?? null;
  if (overrideAmount != null) {
    if (!Number.isInteger(overrideAmount) || overrideAmount <= 0) {
      return fail("invalid-override");
    }
    const reason = trimmed(input.overrideReason ?? "", 240);
    if (!reason) return fail("invalid-override");
  }

  const resultLine: RepairQuoteLineResult = {
    sku,
    taskDescription,
    amounts,
    metalBand: line.metalBand ?? null,
    hasExplicitMetalQuantity:
      line.hasExplicitMetalQuantity === true || metal.millidwt != null,
    loadedLaborEighthCents: loadedLabor,
    partsCostEighthCents: partsCost,
    otherCostEighthCents: otherCost,
    metalCostEighthCents: metalCost,
    fullyLoadedDirectCostEighthCents: fullyLoaded,
    metalPricing: metal.pricing,
    millidwt: metal.millidwt,
    goldUsdPerOz: metal.goldUsdPerOz,
    publishedMetalBand: metal.sourceBand,
    metalSensitive:
      metal.millidwt != null && metal.goldUsdPerOz != null
        ? { goldUsdPerOz: metal.goldUsdPerOz, millidwt: metal.millidwt }
        : null,
  };

  return {
    ok: true,
    calculation: {
      sourceFamily: REPAIR_QUOTE_SOURCE_FAMILY,
      sourceVersion: GELLER_BLUE_BOOK.version,
      sourceRelease: GELLER_BLUE_BOOK.release,
      sourceEditionLabel: GELLER_BLUE_BOOK.editionLabel,
      sourceSku: sku,
      sourceTaskDescription: taskDescription,
      sourceAmounts: amounts,
      laborBurdenNumerator: 5,
      laborBurdenDenominator: 4,
      hourglassMarkupNumerator: 5,
      hourglassMarkupDenominator: 2,
      metalBand: line.metalBand ?? null,
      metalPricing: metal.pricing,
      publishedMetalBand: metal.sourceBand,
      millidwt: metal.millidwt,
      goldUsdPerOz: metal.goldUsdPerOz,
      metalCostEighthCents: metalCost,
      metalExtrapolation: metal.extrapolation,
      expressSelected: false,
      line: resultLine,
      loadedLaborEighthCents: loadedLabor,
      partsCostEighthCents: partsCost,
      otherCostEighthCents: otherCost,
      fullyLoadedDirectCostEighthCents: fullyLoaded,
      rawComputedQuoteEighthCents: rawComputed,
      roundedComputedQuoteEighthCents: roundedComputed,
      computedHourglassQuoteEighthCents: roundedComputed,
      hourglassQuoteEighthCents:
        overrideAmount != null
          ? overrideCentsToEighthCents(overrideAmount)
          : roundedComputed,
      overrideApplied: overrideAmount != null,
      warnings: [],
    },
  };
}
