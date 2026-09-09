import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateRepairQuote } from "./calculate";
import {
  EXTRAPOLATED_METAL_LABEL,
  extrapolated14kCostPerDwtCents,
  HIGHEST_PUBLISHED_14K_BAND,
  lookupPublished14kBand,
} from "./gold-14k";
import {
  formatUsdEighthCents,
  hourglassQuoteEighthCents,
  loadedLaborEighthCents,
} from "./money";
import { founderQuoteExamples } from "./examples";
import { lookupVerifiedSku } from "./source";
import type { RepairQuoteLineInput } from "./types";

function skuLine(sku: string, extra: Partial<RepairQuoteLineInput> = {}): RepairQuoteLineInput {
  const verified = lookupVerifiedSku(sku);
  assert.ok(verified);
  return {
    sku: verified.sku,
    taskDescription: verified.taskDescription,
    amounts: { ...verified.amounts },
    metalBand: verified.metalBand,
    hasExplicitMetalQuantity: verified.hasExplicitMetalQuantity,
    inventedMetalQuantity: false,
    expressSelected: false,
    costBasis: "geller_cost_columns",
    ...extra,
  };
}

function laborPlusDwt(goldUsdPerOz: number, millidwt = 1000) {
  return calculateRepairQuote({
    repairType: "sizing",
    metalFamily: "gold_14k",
    line: skuLine("1000", {
      goldUsdPerOz,
      millidwt,
      metalSensitive: { goldUsdPerOz, millidwt },
    }),
  });
}

describe("14K source band vs extrapolated metal", () => {
  it("uses the exact published Geller band inside the range", () => {
    const inside = lookupPublished14kBand(2875);
    assert.ok(inside);
    assert.equal(inside.goldUsdPerOzMin, 2850);
    assert.equal(inside.goldUsdPerOzMax, 2899);
    assert.equal(inside.costPartsCents, 9_200);
    const quote = laborPlusDwt(2875);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.calculation.metalPricing, "source_band");
    assert.equal(quote.calculation.metalCostEighthCents, 9_200 * 8);
    assert.notEqual(
      quote.calculation.metalCostEighthCents,
      extrapolated14kCostPerDwtCents(2875) * 8,
    );
    assert.equal(
      quote.calculation.loadedLaborEighthCents,
      loadedLaborEighthCents(1_600),
    );
  });

  it("keeps the highest published band as source pricing, not extrapolated", () => {
    const highest = lookupPublished14kBand(4049);
    assert.ok(highest);
    assert.equal(highest.sku, HIGHEST_PUBLISHED_14K_BAND.sku);
    const quote = laborPlusDwt(4049);
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.calculation.metalPricing, "source_band");
    assert.equal(quote.calculation.metalCostEighthCents, 12_900 * 8);
    assert.equal(quote.calculation.metalExtrapolation, null);
  });

  it("activates extrapolation on the first value above the highest band", () => {
    const atTop = laborPlusDwt(4049);
    const firstAbove = laborPlusDwt(4050);
    assert.equal(atTop.ok, true);
    assert.equal(firstAbove.ok, true);
    if (!atTop.ok || !firstAbove.ok) return;
    assert.equal(firstAbove.calculation.metalPricing, "extrapolated");
    assert.equal(firstAbove.calculation.metalExtrapolation?.label, EXTRAPOLATED_METAL_LABEL);
    assert.notEqual(
      firstAbove.calculation.metalCostEighthCents,
      atTop.calculation.metalCostEighthCents,
    );
  });

  it("extrapolates $6,000 and $8,000 deterministically without changing labor", () => {
    const six = laborPlusDwt(6000);
    const eight = laborPlusDwt(8000);
    assert.equal(six.ok, true);
    assert.equal(eight.ok, true);
    if (!six.ok || !eight.ok) return;
    assert.equal(six.calculation.metalPricing, "extrapolated");
    assert.equal(eight.calculation.metalPricing, "extrapolated");
    assert.equal(six.calculation.loadedLaborEighthCents, loadedLaborEighthCents(1_600));
    assert.equal(eight.calculation.loadedLaborEighthCents, loadedLaborEighthCents(1_600));
    assert.equal(six.calculation.metalCostEighthCents, extrapolated14kCostPerDwtCents(6000) * 8);
    assert.equal(eight.calculation.metalCostEighthCents, extrapolated14kCostPerDwtCents(8000) * 8);
    assert.equal(
      six.calculation.rawComputedQuoteEighthCents,
      hourglassQuoteEighthCents({
        costLaborCents: 1_600,
        costPartsCents: extrapolated14kCostPerDwtCents(6000),
        costOtherCents: 0,
      }),
    );
    const again = laborPlusDwt(6000);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.deepEqual(again.calculation, six.calculation);
  });

  it("leaves fixed non-metal parts unchanged unless metal-sensitive", () => {
    const verified = lookupVerifiedSku("1008");
    assert.ok(verified);
    const withMetal = calculateRepairQuote({
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: skuLine("1008", {
        goldUsdPerOz: 2875,
        millidwt: 1000,
        metalSensitive: { goldUsdPerOz: 2875, millidwt: 1000 },
      }),
    });
    const without = calculateRepairQuote({
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: skuLine("1008"),
    });
    assert.equal(withMetal.ok, true);
    assert.equal(without.ok, true);
    if (!withMetal.ok || !without.ok) return;
    assert.equal(withMetal.calculation.sourceAmounts.costPartsCents, 1_100);
    assert.equal(without.calculation.sourceAmounts.costPartsCents, 1_100);
    assert.equal(withMetal.calculation.loadedLaborEighthCents, without.calculation.loadedLaborEighthCents);
    assert.equal(
      withMetal.calculation.metalCostEighthCents,
      without.calculation.metalCostEighthCents + 9_200 * 8,
    );
  });

  it("fails closed without supported dwt and keeps raw arithmetic plus $5 rounding", () => {
    const missing = calculateRepairQuote({
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: skuLine("1000", { goldUsdPerOz: 6000 }),
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "missing-metal-quantity");

    const platinum = calculateRepairQuote({
      repairType: "platinum_labor",
      metalFamily: "platinum",
      line: skuLine("1000", {
        goldUsdPerOz: 6000,
        millidwt: 1000,
        metalSensitive: { goldUsdPerOz: 6000, millidwt: 1000 },
      }),
    });
    assert.equal(platinum.ok, false);
    if (!platinum.ok) assert.equal(platinum.code, "platinum-dynamic-blocked");

    const sku1008 = calculateRepairQuote({
      repairType: "sizing",
      metalFamily: "gold_14k",
      line: skuLine("1008"),
    });
    assert.equal(sku1008.ok, true);
    if (!sku1008.ok) return;
    assert.equal(formatUsdEighthCents(sku1008.calculation.rawComputedQuoteEighthCents), "$93.125");
    assert.equal(formatUsdEighthCents(sku1008.calculation.roundedComputedQuoteEighthCents), "$95");
    assert.equal(sku1008.calculation.metalPricing, "none");
  });

  it("records SOURCE BAND vs EXTRAPOLATED on issued-style snapshots", () => {
    const source = laborPlusDwt(2875);
    const extrapolated = laborPlusDwt(6250);
    assert.equal(source.ok, true);
    assert.equal(extrapolated.ok, true);
    if (!source.ok || !extrapolated.ok) return;
    assert.equal(source.calculation.metalPricing, "source_band");
    assert.equal(extrapolated.calculation.metalPricing, "extrapolated");
    assert.match(
      extrapolated.calculation.metalExtrapolation?.explanation ?? "",
      /Gold input: \$6,250\/oz/,
    );
    assert.match(
      extrapolated.calculation.metalExtrapolation?.explanation ?? "",
      /Geller V5\.0 R6\.50/,
    );
  });
});

describe("Founder V1 UI examples", () => {
  it("covers Geller-range, above-range, labor-only, missing-weight, and override", () => {
    const examples = founderQuoteExamples();
    assert.equal(examples.map((row) => row.id).join(","), "geller-range,above-range,labor-only,missing-weight,founder-override");
    const range = examples[0];
    const above = examples[1];
    const labor = examples[2];
    const missing = examples[3];
    const override = examples[4];
    assert.equal(range?.result.ok, true);
    assert.equal(above?.result.ok, true);
    assert.equal(labor?.result.ok, true);
    assert.equal(missing?.result.ok, false);
    assert.equal(override?.result.ok, true);
    if (!range?.result.ok || !above?.result.ok || !labor?.result.ok || missing?.result.ok || !override?.result.ok) {
      return;
    }
    if (missing.result.ok) return;
    assert.equal(range.result.calculation.metalPricing, "none");
    assert.equal(above.result.calculation.metalPricing, "extrapolated");
    assert.equal(labor.result.calculation.metalPricing, "none");
    assert.equal(missing.result.code, "missing-metal-quantity");
    assert.equal(override.result.calculation.overrideApplied, true);
    assert.equal(override.result.calculation.rawComputedQuoteEighthCents, 40_000);
  });
});
