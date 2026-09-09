/**
 * 14K per-dwt metal cost: published Geller band first, OLS only above the
 * highest published band. Never interpolates an existing band. Never invents dwt.
 */

import { GELLER_BLUE_BOOK } from "./contract";
import {
  GELLER_14K_COST_OLS,
  GELLER_14K_GOLD_BANDS,
  type Published14kGoldBand,
} from "./gold-bands";

export const EXTRAPOLATED_METAL_LABEL =
  "EXTRAPOLATED BEYOND GELLER PUBLISHED RANGE" as const;

export type MetalPricingKind = "none" | "source_band" | "extrapolated";

export type MetalSensitiveInput = {
  goldUsdPerOz: number;
  millidwt: number;
};

export type MetalResolution =
  | { ok: true; result: MetalResolutionResult }
  | { ok: false; code: "missing-metal-quantity" | "source-metal-band-missing" | "platinum-dynamic-blocked" | "fourteen-k-metal-only" };

export type MetalExtrapolationSnapshot = {
  label: typeof EXTRAPOLATED_METAL_LABEL;
  calibrationSource: string;
  sourceBandCount: number;
  highestPublishedBand: Published14kGoldBand;
  slopeMicro: number;
  interceptMicro: number;
  requestedGoldUsdPerOz: number;
  extrapolatedCostPerDwtCents: number;
  supportedMillidwt: number;
  metalCostCents: number;
  explanation: string;
};

export type MetalResolutionResult = {
  pricing: MetalPricingKind;
  goldUsdPerOz: number | null;
  millidwt: number | null;
  sourceBand: Published14kGoldBand | null;
  metalCostCents: number;
  extrapolation: MetalExtrapolationSnapshot | null;
};

export const HIGHEST_PUBLISHED_14K_BAND =
  GELLER_14K_GOLD_BANDS[GELLER_14K_GOLD_BANDS.length - 1]!;

function roundDiv(num: bigint, den: bigint): number {
  const zero = BigInt(0);
  const two = BigInt(2);
  const signed = num < zero;
  const abs = signed ? -num : num;
  const rounded = (abs + den / two) / den;
  const n = Number(signed ? -rounded : rounded);
  if (!Number.isSafeInteger(n)) throw new Error("invalid-money");
  return n;
}

export function lookupPublished14kBand(
  goldUsdPerOz: number,
): Published14kGoldBand | null {
  const hits = GELLER_14K_GOLD_BANDS.filter(
    (band) =>
      goldUsdPerOz >= band.goldUsdPerOzMin && goldUsdPerOz <= band.goldUsdPerOzMax,
  );
  if (hits.length === 0) return null;
  hits.sort(
    (a, b) =>
      a.goldUsdPerOzMax - a.goldUsdPerOzMin - (b.goldUsdPerOzMax - b.goldUsdPerOzMin),
  );
  return hits[0] ?? null;
}

export function metalCostCentsFromPerDwt(
  costPartsCents: number,
  millidwt: number,
): number {
  return roundDiv(BigInt(costPartsCents) * BigInt(millidwt), BigInt(1000));
}

export function extrapolated14kCostPerDwtCents(goldUsdPerOz: number): number {
  return roundDiv(
    BigInt(GELLER_14K_COST_OLS.slopeMicro) * BigInt(goldUsdPerOz) +
      BigInt(GELLER_14K_COST_OLS.interceptMicro),
    BigInt(1_000_000),
  );
}

export function formatGoldUsdPerOz(goldUsdPerOz: number): string {
  const grouped = String(goldUsdPerOz).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}/oz`;
}

export function resolve14kMetalCost(input: {
  metalFamily: string;
  metalSensitive?: MetalSensitiveInput | null;
  goldUsdPerOz?: number | null;
  millidwt?: number | null;
}): MetalResolution {
  const gold =
    input.metalSensitive?.goldUsdPerOz ?? input.goldUsdPerOz ?? null;
  const millidwt = input.metalSensitive?.millidwt ?? input.millidwt ?? null;
  const goldPresent = gold != null;
  const dwtPresent = millidwt != null;
  if (!goldPresent && !dwtPresent) {
    return {
      ok: true,
      result: {
        pricing: "none",
        goldUsdPerOz: null,
        millidwt: null,
        sourceBand: null,
        metalCostCents: 0,
        extrapolation: null,
      },
    };
  }
  if (!goldPresent || !dwtPresent) {
    return { ok: false, code: "missing-metal-quantity" };
  }
  if (!Number.isInteger(gold) || gold <= 0 || gold > 99_999) {
    return { ok: false, code: "missing-metal-quantity" };
  }
  if (!Number.isInteger(millidwt) || millidwt <= 0 || millidwt > 9_999_999) {
    return { ok: false, code: "missing-metal-quantity" };
  }
  if (input.metalFamily === "platinum") {
    return { ok: false, code: "platinum-dynamic-blocked" };
  }
  if (input.metalFamily !== "gold_14k") {
    return { ok: false, code: "fourteen-k-metal-only" };
  }

  const band = lookupPublished14kBand(gold);
  if (band) {
    return {
      ok: true,
      result: {
        pricing: "source_band",
        goldUsdPerOz: gold,
        millidwt,
        sourceBand: band,
        metalCostCents: metalCostCentsFromPerDwt(band.costPartsCents, millidwt),
        extrapolation: null,
      },
    };
  }
  if (gold <= HIGHEST_PUBLISHED_14K_BAND.goldUsdPerOzMax) {
    return { ok: false, code: "source-metal-band-missing" };
  }

  const costPerDwtCents = extrapolated14kCostPerDwtCents(gold);
  const metalCostCents = metalCostCentsFromPerDwt(costPerDwtCents, millidwt);
  return {
    ok: true,
    result: {
      pricing: "extrapolated",
      goldUsdPerOz: gold,
      millidwt,
      sourceBand: null,
      metalCostCents,
      extrapolation: {
        label: EXTRAPOLATED_METAL_LABEL,
        calibrationSource: GELLER_BLUE_BOOK.editionLabel,
        sourceBandCount: GELLER_14K_COST_OLS.sampleCount,
        highestPublishedBand: HIGHEST_PUBLISHED_14K_BAND,
        slopeMicro: GELLER_14K_COST_OLS.slopeMicro,
        interceptMicro: GELLER_14K_COST_OLS.interceptMicro,
        requestedGoldUsdPerOz: gold,
        extrapolatedCostPerDwtCents: costPerDwtCents,
        supportedMillidwt: millidwt,
        metalCostCents,
        explanation: `Gold input: ${formatGoldUsdPerOz(gold)}\n14K metal cost extrapolated from Geller V5.0 R6.50 published cost bands.`,
      },
    },
  };
}
