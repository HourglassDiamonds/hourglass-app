import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { calculateRepairQuote } from "./calculate";
import { GELLER_BLUE_BOOK } from "./contract";
import {
  formatUsdEighthCents,
  hourglassQuoteEighthCents,
  loadedLaborEighthCents,
} from "./money";
import {
  lookupVerifiedSku,
  VERIFIED_14KT_GOLD_BAND,
} from "./source";
import type { RepairQuoteCalculationInput, RepairQuoteLineInput } from "./types";

const ENGINE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "calculate.ts"),
  "utf8",
);
const MONEY_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "money.ts"),
  "utf8",
);

function skuLine(
  sku: string,
  extra: Partial<RepairQuoteLineInput> = {},
): RepairQuoteLineInput {
  const verified = lookupVerifiedSku(sku);
  assert.ok(verified);
  return {
    sku: verified.sku,
    taskDescription: verified.taskDescription,
    amounts: { ...verified.amounts },
    metalBand: verified.metalBand,
    hasExplicitMetalQuantity: verified.hasExplicitMetalQuantity,
    metalSemantics: verified.metalSemantics,
    inventedMetalQuantity: false,
    expressSelected: false,
    costBasis: "geller_cost_columns",
    ...extra,
  };
}

function skuInput(
  sku: string,
  extra: Partial<RepairQuoteCalculationInput> = {},
): RepairQuoteCalculationInput {
  const verified = lookupVerifiedSku(sku);
  assert.ok(verified);
  return {
    repairType: verified.repairType,
    metalFamily: verified.metalFamily,
    line: skuLine(sku),
    ...extra,
  };
}

describe("Blue Book 2.5x cost calculator", () => {
  it("quotes SKU 1000 at $50 from Cost Labor, not Geller retail", () => {
    const result = calculateRepairQuote(skuInput("1000"));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const calc = result.calculation;
    assert.equal(calc.sourceAmounts.priceLaborCents, 6_000);
    assert.equal(calc.sourceAmounts.costLaborCents, 1_600);
    assert.equal(calc.loadedLaborEighthCents, loadedLaborEighthCents(1_600));
    assert.equal(formatUsdEighthCents(calc.loadedLaborEighthCents), "$20");
    assert.equal(calc.rawComputedQuoteEighthCents, 40_000);
    assert.equal(formatUsdEighthCents(calc.rawComputedQuoteEighthCents), "$50");
    assert.equal(calc.explanation.sourceLaborEighthCents, 12_800);
    assert.equal(calc.explanation.sourcePartsEighthCents, 0);
    assert.equal(calc.explanation.additionalMetalEighthCents, 0);
    const retailAsCost = hourglassQuoteEighthCents({
      costLaborCents: 6_000,
      costPartsCents: 0,
      costOtherCents: 0,
    });
    assert.notEqual(calc.rawComputedQuoteEighthCents, retailAsCost);
  });

  it("quotes SKU 1008 at $93.125 from loaded labor plus Cost Parts", () => {
    const result = calculateRepairQuote(skuInput("1008"));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const calc = result.calculation;
    assert.equal(calc.sourceAmounts.priceLaborCents, 7_900);
    assert.equal(calc.sourceAmounts.pricePartsCents, 3_300);
    assert.equal(calc.sourceAmounts.costLaborCents, 2_100);
    assert.equal(calc.sourceAmounts.costPartsCents, 1_100);
    assert.equal(formatUsdEighthCents(calc.loadedLaborEighthCents), "$26.25");
    assert.equal(calc.fullyLoadedDirectCostEighthCents, 29_800);
    assert.equal(calc.rawComputedQuoteEighthCents, 74_500);
    assert.equal(formatUsdEighthCents(calc.rawComputedQuoteEighthCents), "$93.125");
    assert.equal(formatUsdEighthCents(calc.roundedComputedQuoteEighthCents), "$95");
    assert.equal(calc.hourglassQuoteEighthCents, calc.roundedComputedQuoteEighthCents);
    assert.equal(calc.metalSemantics, "embedded_parts");
    assert.equal(calc.metalInclusion, "none");
    assert.equal(calc.explanation.additionalMetalEighthCents, 0);
  });

  it("never uses bold retail as cost and applies 2.5x once", () => {
    const inflatedRetail = calculateRepairQuote(
      skuInput("1000", {
        line: skuLine("1000", {
          amounts: {
            ...lookupVerifiedSku("1000")!.amounts,
            priceLaborCents: 9_999_00,
          },
        }),
      }),
    );
    assert.equal(inflatedRetail.ok, true);
    if (!inflatedRetail.ok) return;
    assert.equal(inflatedRetail.calculation.rawComputedQuoteEighthCents, 40_000);

    const retailBasis = calculateRepairQuote(
      skuInput("1000", {
        line: skuLine("1000", { costBasis: "geller_price_columns" }),
      }),
    );
    assert.equal(retailBasis.ok, false);
    if (!retailBasis.ok) assert.equal(retailBasis.code, "retail-used-as-cost");

    const sku1008 = calculateRepairQuote(skuInput("1008"));
    assert.equal(sku1008.ok, true);
    if (!sku1008.ok) return;
    const loaded = sku1008.calculation.fullyLoadedDirectCostEighthCents;
    const once = Math.round((loaded * 5) / 2);
    const doubled = Math.round((once * 5) / 2);
    assert.equal(sku1008.calculation.rawComputedQuoteEighthCents, once);
    assert.notEqual(sku1008.calculation.rawComputedQuoteEighthCents, doubled);
    assert.doesNotMatch(ENGINE_SRC, /priceLaborCents\s*[*]/);
    assert.doesNotMatch(MONEY_SRC, /priceLaborCents|pricePartsCents/);
  });

  it("uses source Cost Parts for metal bands and refuses invented dwt", () => {
    const metal = calculateRepairQuote({
      repairType: "fourteen_k_operation",
      metalFamily: "gold_14k",
      line: {
        sku: "14KT-DWT-2850",
        taskDescription: VERIFIED_14KT_GOLD_BAND.label,
        amounts: {
          priceLaborCents: 0,
          pricePartsCents: VERIFIED_14KT_GOLD_BAND.pricePartsCents,
          priceOtherCents: 0,
          costLaborCents: 0,
          costPartsCents: VERIFIED_14KT_GOLD_BAND.costPartsCents,
          costOtherCents: 0,
        },
        metalBand: VERIFIED_14KT_GOLD_BAND,
        hasExplicitMetalQuantity: true,
        inventedMetalQuantity: false,
        expressSelected: false,
        costBasis: "geller_cost_columns",
      },
    });
    assert.equal(metal.ok, true);
    if (!metal.ok) return;
    assert.equal(metal.calculation.partsCostEighthCents, 9_200 * 8);
    assert.equal(
      metal.calculation.rawComputedQuoteEighthCents,
      hourglassQuoteEighthCents({
        costLaborCents: 0,
        costPartsCents: 9_200,
        costOtherCents: 0,
      }),
    );
    const retailParts = hourglassQuoteEighthCents({
      costLaborCents: 0,
      costPartsCents: 27_600,
      costOtherCents: 0,
    });
    assert.notEqual(metal.calculation.rawComputedQuoteEighthCents, retailParts);

    const invented = calculateRepairQuote(
      skuInput("1000", {
        line: skuLine("1000", { inventedMetalQuantity: true }),
      }),
    );
    assert.equal(invented.ok, false);
    if (!invented.ok) assert.equal(invented.code, "invented-metal-quantity");
    assert.equal(lookupVerifiedSku("1000")?.hasExplicitMetalQuantity, false);
    assert.doesNotMatch(ENGINE_SRC, /alloy_dwt|fine_dwt/);
  });

  it("preserves Geller edition, burden, markup, and does not auto-apply Express", () => {
    const result = calculateRepairQuote(skuInput("1008"));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const calc = result.calculation;
    assert.equal(calc.sourceFamily, "geller_blue_book");
    assert.equal(calc.sourceVersion, GELLER_BLUE_BOOK.version);
    assert.equal(calc.sourceRelease, GELLER_BLUE_BOOK.release);
    assert.equal(calc.sourceEditionLabel, GELLER_BLUE_BOOK.editionLabel);
    assert.equal(calc.sourceSku, "1008");
    assert.equal(calc.laborBurdenNumerator, 5);
    assert.equal(calc.laborBurdenDenominator, 4);
    assert.equal(calc.hourglassMarkupNumerator, 5);
    assert.equal(calc.hourglassMarkupDenominator, 2);
    assert.equal(calc.expressSelected, false);
    const express = calculateRepairQuote(
      skuInput("1000", {
        line: skuLine("1000", { expressSelected: true }),
      }),
    );
    assert.equal(express.ok, false);
    if (!express.ok) assert.equal(express.code, "express-not-enabled");
  });

  it("replaces per-dwt source Cost Parts instead of stacking metal", () => {
    const row = lookupVerifiedSku("100047");
    assert.ok(row);
    assert.equal(row.metalSemantics, "per_dwt_14k");
    const asPublished = calculateRepairQuote({
      repairType: row.repairType,
      metalFamily: row.metalFamily,
      line: {
        sku: row.sku,
        taskDescription: row.taskDescription,
        amounts: row.amounts,
        metalSemantics: row.metalSemantics,
        inventedMetalQuantity: false,
        expressSelected: false,
        costBasis: "geller_cost_columns",
      },
    });
    assert.equal(asPublished.ok, true);
    if (!asPublished.ok) return;
    assert.equal(asPublished.calculation.sourceAmounts.costPartsCents, 9_200);
    assert.equal(asPublished.calculation.metalInclusion, "none");
    const replaced = calculateRepairQuote({
      repairType: row.repairType,
      metalFamily: row.metalFamily,
      line: {
        sku: row.sku,
        taskDescription: row.taskDescription,
        amounts: row.amounts,
        metalSemantics: row.metalSemantics,
        goldUsdPerOz: 6250,
        millidwt: 1000,
        metalSensitive: { goldUsdPerOz: 6250, millidwt: 1000 },
        inventedMetalQuantity: false,
        expressSelected: false,
        costBasis: "geller_cost_columns",
      },
    });
    assert.equal(replaced.ok, true);
    if (!replaced.ok) return;
    assert.equal(replaced.calculation.metalInclusion, "replaced_source_parts");
    assert.equal(replaced.calculation.sourceAmounts.costPartsCents, 9_200);
    assert.notEqual(replaced.calculation.metalCostEighthCents, 9_200 * 8);
    assert.equal(
      replaced.calculation.rawComputedQuoteEighthCents,
      hourglassQuoteEighthCents({
        costLaborCents: row.amounts.costLaborCents,
        costPartsCents: replaced.calculation.metalCostEighthCents / 8,
        costOtherCents: 0,
      }),
    );
    assert.notEqual(
      replaced.calculation.rawComputedQuoteEighthCents,
      hourglassQuoteEighthCents({
        costLaborCents: row.amounts.costLaborCents,
        costPartsCents: 9_200 + replaced.calculation.metalCostEighthCents / 8,
        costOtherCents: 0,
      }),
    );
  });
});
