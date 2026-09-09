import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { calculateRepairQuote, defaultGoldSensitive } from "./calculate";
import { UNVERIFIED_HISTORICAL_CONTEXT } from "./types";
import type { RepairQuoteCalculationInput } from "./types";

const NOW = "2026-09-09";
const ENGINE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "calculate.ts"),
  "utf8",
);

function base(
  extra: Partial<RepairQuoteCalculationInput> = {},
): RepairQuoteCalculationInput {
  return {
    repairType: "sizing",
    metalFamily: "gold_14k",
    sourceEditionLabel: "Founder-transcribed Blue Book line",
    sourcePriceSemantics: "shop_cost",
    gold: {
      usdCentsPerTroyOz: 440_000,
      asOfDate: NOW,
      source: "founder_manual",
      baselineUsdCentsPerTroyOz: 300_000,
    },
    markupRatioPermyriad: 25_000,
    lines: [
      {
        sourceLineRef: "SZ-14K-UP",
        sourceLineLabel: "Size 14K ring up one half size",
        sourceAmountCents: 12_000,
        goldSensitive: true,
        goldWeightKind: "alloy_dwt",
        goldWeightMillidwt: 2_500,
      },
    ],
    quoteDate: NOW,
    ...extra,
  };
}

describe("Blue Book repair quote calculator", () => {
  it("does not read unverified historical gold or markup as live defaults", () => {
    assert.equal(UNVERIFIED_HISTORICAL_CONTEXT.status, "unverified_not_live_default");
    assert.doesNotMatch(ENGINE_SRC, /2850/);
    assert.doesNotMatch(ENGINE_SRC, /2\.5/);
    assert.doesNotMatch(ENGINE_SRC, /UNVERIFIED_HISTORICAL_CONTEXT/);
    const missing = calculateRepairQuote(
      base({
        gold: {
          usdCentsPerTroyOz: 440_000,
          asOfDate: NOW,
          source: "founder_manual",
          baselineUsdCentsPerTroyOz: null,
        },
      }),
    );
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "missing-gold-baseline");
    const noMarkup = calculateRepairQuote(base({ markupRatioPermyriad: null }));
    assert.equal(noMarkup.ok, false);
    if (!noMarkup.ok) assert.equal(noMarkup.code, "missing-markup");
  });

  it("adjusts gold-sensitive sizing and leaves laser labor unchanged", () => {
    const sizing = calculateRepairQuote(base());
    assert.equal(sizing.ok, true);
    if (!sizing.ok) return;
    const fine = Math.round((2500 * 14) / 24);
    const expectedDelta = Math.round(((440_000 - 300_000) * fine) / 20_000);
    assert.equal(sizing.calculation.lines[0]?.metalDeltaCents, expectedDelta);
    assert.equal(
      sizing.calculation.adjustedSourceTotalCents,
      12_000 + expectedDelta,
    );
    assert.equal(
      sizing.calculation.hourglassQuoteCents,
      Math.round((12_000 + expectedDelta) * 2.5),
    );

    const laser = calculateRepairQuote(
      base({
        repairType: "laser_work",
        lines: [
          {
            sourceLineRef: "LSR-SHANK",
            sourceLineLabel: "Laser weld shank",
            sourceAmountCents: 8_500,
            goldSensitive: false,
          },
        ],
      }),
    );
    assert.equal(laser.ok, true);
    if (!laser.ok) return;
    assert.equal(laser.calculation.metalDeltaTotalCents, 0);
    assert.equal(laser.calculation.adjustedSourceTotalCents, 8_500);
    const laserHigherGold = calculateRepairQuote(
      base({
        repairType: "laser_work",
        gold: {
          usdCentsPerTroyOz: 999_999,
          asOfDate: NOW,
          source: "founder_manual",
          baselineUsdCentsPerTroyOz: 300_000,
        },
        lines: [
          {
            sourceLineRef: "LSR-SHANK",
            sourceLineLabel: "Laser weld shank",
            sourceAmountCents: 8_500,
            goldSensitive: false,
          },
        ],
      }),
    );
    assert.equal(laserHigherGold.ok, true);
    if (!laserHigherGold.ok) return;
    assert.equal(
      laserHigherGold.calculation.hourglassQuoteCents,
      laser.calculation.hourglassQuoteCents,
    );
  });

  it("blocks extra markup on suggested retail and platinum gold flags", () => {
    const retail = calculateRepairQuote(
      base({
        sourcePriceSemantics: "suggested_retail",
        markupRatioPermyriad: 25_000,
      }),
    );
    assert.equal(retail.ok, false);
    if (!retail.ok) assert.equal(retail.code, "double-markup-blocked");
    const retailOk = calculateRepairQuote(
      base({
        sourcePriceSemantics: "suggested_retail",
        markupRatioPermyriad: 10_000,
      }),
    );
    assert.equal(retailOk.ok, true);
    if (!retailOk.ok) return;
    assert.equal(
      retailOk.calculation.hourglassQuoteCents,
      retailOk.calculation.adjustedSourceTotalCents,
    );

    const platinumGold = calculateRepairQuote(
      base({
        repairType: "platinum_labor",
        metalFamily: "platinum",
        lines: [
          {
            sourceLineRef: "PT-HEAD",
            sourceLineLabel: "Platinum head labor",
            sourceAmountCents: 22_000,
            goldSensitive: true,
            goldWeightKind: "fine_dwt",
            goldWeightMillidwt: 1000,
          },
        ],
      }),
    );
    assert.equal(platinumGold.ok, false);
    if (!platinumGold.ok) assert.equal(platinumGold.code, "platinum-is-not-gold");
  });

  it("blocks double material adjustment and warns on stale gold", () => {
    const doubled = calculateRepairQuote(
      base({
        lines: [
          {
            sourceLineRef: "SZ-14K-UP",
            sourceLineLabel: "Size 14K ring up one half size",
            sourceAmountCents: 12_000,
            goldSensitive: true,
            goldWeightKind: "alloy_dwt",
            goldWeightMillidwt: 2_500,
            manualMetalDeltaCents: 4_000,
          },
        ],
      }),
    );
    assert.equal(doubled.ok, false);
    if (!doubled.ok) assert.equal(doubled.code, "double-material-adjustment");

    const stale = calculateRepairQuote(
      base({
        gold: {
          usdCentsPerTroyOz: 440_000,
          asOfDate: "2026-09-01",
          source: "founder_manual",
          baselineUsdCentsPerTroyOz: 300_000,
        },
        quoteDate: NOW,
      }),
    );
    assert.equal(stale.ok, true);
    if (!stale.ok) return;
    assert.deepEqual(stale.calculation.warnings, ["stale-gold"]);
  });

  it("is deterministic and uses metal-dependent gold defaults", () => {
    const first = calculateRepairQuote(base());
    const second = calculateRepairQuote(base());
    assert.deepEqual(first, second);
    assert.equal(defaultGoldSensitive({ repairType: "sizing", metalFamily: "gold_14k" }), true);
    assert.equal(defaultGoldSensitive({ repairType: "sizing", metalFamily: "platinum" }), false);
    assert.equal(defaultGoldSensitive({ repairType: "laser_work", metalFamily: "gold_14k" }), false);
    assert.equal(
      defaultGoldSensitive({ repairType: "head_prong_replacement", metalFamily: "gold_14k" }),
      true,
    );
  });

  it("fails closed without source semantics or a transcribed book line", () => {
    const noSemantics = calculateRepairQuote(
      base({ sourcePriceSemantics: "" as never }),
    );
    assert.equal(noSemantics.ok, false);
    if (!noSemantics.ok) assert.equal(noSemantics.code, "missing-source-semantics");
    const noLines = calculateRepairQuote(base({ lines: [] }));
    assert.equal(noLines.ok, false);
    if (!noLines.ok) assert.equal(noLines.code, "missing-lines");
  });
});
