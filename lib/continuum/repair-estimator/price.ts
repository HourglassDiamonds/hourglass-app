/**
 * Quantity composition over Geller cost columns.
 * Tier 1 lives in the catalog. Later breaks are the additive index
 * for laser sizing and laser tips. No price is invented when a break is missing.
 */

import breaksArtifact from "./quantity-breaks.json";
import { calculateRepairQuote } from "@/lib/continuum/repair-quoting/calculate";
import { GELLER_COST_BASIS } from "@/lib/continuum/repair-quoting/contract";
import {
  formatUsdEighthCents,
  hourglassQuoteEighthCents,
  roundToNearestFiveDollarsEighthCents,
} from "@/lib/continuum/repair-quoting/money";
import type { GellerCatalogRow } from "@/lib/continuum/repair-quoting/parse-export";
import type { GellerSourceAmounts } from "@/lib/continuum/repair-quoting/source";
import type { RepairEstimateLineItem } from "./types";

type BreakTier = {
  maxQty: number | null;
  amounts: GellerSourceAmounts;
};

const BREAKS = breaksArtifact as Record<string, BreakTier[]>;

export function additionalBreaks(sku: string): readonly BreakTier[] {
  return BREAKS[sku] ?? [];
}

function scaleEighthCents(unitEighthCents: number, milli: number): number {
  const product = unitEighthCents * milli;
  const quotient = Math.floor(product / 1000);
  const remainder = product % 1000;
  return remainder * 2 >= 1000 ? quotient + 1 : quotient;
}

function rawEighthCents(amounts: GellerSourceAmounts): number {
  return hourglassQuoteEighthCents({
    costLaborCents: amounts.costLaborCents,
    costPartsCents: amounts.costPartsCents,
    costOtherCents: amounts.costOtherCents,
  });
}

function pricedUnit(row: GellerCatalogRow, amounts: GellerSourceAmounts): number | null {
  const calculated = calculateRepairQuote({
    repairType: row.inferredRepairType,
    metalFamily: row.inferredMetalFamily,
    line: {
      sku: row.sku,
      taskDescription: row.taskDescription,
      amounts,
      metalSemantics: row.metalSemantics,
      inventedMetalQuantity: false,
      expressSelected: false,
      costBasis: GELLER_COST_BASIS,
    },
  });
  if (!calculated.ok) return null;
  const raw = rawEighthCents(amounts);
  if (calculated.calculation.rawComputedQuoteEighthCents !== raw) return null;
  return raw;
}

function formatMilli(milli: number): string {
  const value = milli / 1000;
  return Number.isInteger(value) ? String(value) : String(value);
}

export type PricedRow = {
  lineItems: RepairEstimateLineItem[];
  rawEighthCents: number;
  quantityMode: "flat" | "each";
};

export function priceCatalogRow(
  row: GellerCatalogRow,
  input: { label: string; quantityMilli: number | null },
): PricedRow | null {
  const breaks = additionalBreaks(row.sku);
  const perEach = input.quantityMilli != null && (breaks.length > 0 || row.maxQty1 != null);
  if (!perEach || input.quantityMilli == null) {
    const unit = pricedUnit(row, row.amounts);
    if (unit == null) return null;
    return {
      quantityMode: "flat",
      rawEighthCents: unit,
      lineItems: [
        {
          label: input.label,
          detail: "Published job price",
          baseLabel: formatUsdEighthCents(unit),
          modifierLabel: null,
          modifierReason: null,
          lineLabel: formatUsdEighthCents(unit),
          sourceTask: row.taskDescription,
        },
      ],
    };
  }

  const tiers: BreakTier[] = [{ maxQty: row.maxQty1 ?? 1, amounts: row.amounts }, ...breaks];
  const portions: Array<{ milli: number; amounts: GellerSourceAmounts; tierIndex: number }> = [];
  let cursor = 0;
  for (let index = 0; index < tiers.length && cursor < input.quantityMilli; index += 1) {
    const tier = tiers[index]!;
    const end = tier.maxQty == null ? input.quantityMilli : tier.maxQty * 1000;
    const takeEnd = Math.min(input.quantityMilli, Math.max(end, cursor));
    const milli = takeEnd - cursor;
    if (milli > 0) portions.push({ milli, amounts: tier.amounts, tierIndex: index });
    cursor = takeEnd;
    if (tier.maxQty == null) break;
  }
  if (cursor < input.quantityMilli) return null;

  const lineItems: RepairEstimateLineItem[] = [];
  let raw = 0;
  portions.forEach((portion, index) => {
    const unit = pricedUnit(row, portion.amounts);
    if (unit == null) return;
    const lineRaw = scaleEighthCents(unit, portion.milli);
    raw += lineRaw;
    const first = portion.tierIndex === 0;
    const partial = portion.milli !== 1000;
    const detail = first
      ? partial
        ? `${formatMilli(portion.milli)} of the first unit`
        : "First unit"
      : `${formatMilli(portion.milli)} additional unit`;
    lineItems.push({
      label: input.label,
      detail,
      baseLabel: formatUsdEighthCents(unit),
      modifierLabel: partial || !first ? `× ${formatMilli(portion.milli)}` : null,
      modifierReason:
        index === 0 && portions.length === 1
          ? "Quantity is within the first published break."
          : "The repair book prices the first unit on the primary break and each additional unit on the next break.",
      lineLabel: formatUsdEighthCents(lineRaw),
      sourceTask: row.taskDescription,
    });
  });
  if (lineItems.length !== portions.length) return null;
  return { quantityMode: "each", rawEighthCents: raw, lineItems };
}

export function roundEstimate(rawEighthCents: number): {
  rawLabel: string;
  totalLabel: string;
} {
  return {
    rawLabel: formatUsdEighthCents(rawEighthCents),
    totalLabel: formatUsdEighthCents(roundToNearestFiveDollarsEighthCents(rawEighthCents)),
  };
}
