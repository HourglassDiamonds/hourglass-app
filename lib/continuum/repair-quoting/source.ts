/**
 * Verified Geller SKU snapshots from the founder-supplied export.
 * The full spreadsheet was not in the workspace; these rows are founder-verified.
 * Do not invent additional catalog prices.
 */

import { GELLER_BLUE_BOOK } from "./contract";

export type GellerSourceAmounts = {
  priceLaborCents: number;
  pricePartsCents: number;
  priceOtherCents: number;
  costLaborCents: number;
  costPartsCents: number;
  costOtherCents: number;
};

export type GellerMetalBand = {
  label: string;
  metalLabel: string;
  goldUsdPerOzMin: number;
  goldUsdPerOzMax: number;
  unit: "per_pennyweight";
  pricePartsCents: number;
  costPartsCents: number;
};

export type VerifiedGellerSku = {
  sku: string;
  taskDescription: string;
  repairType: "sizing" | "head_prong_replacement" | "laser_work" | "stone_reset" | "platinum_labor" | "fourteen_k_operation";
  metalFamily: "gold_10k" | "gold_14k" | "gold_18k" | "platinum" | "other";
  amounts: GellerSourceAmounts;
  metalBand: GellerMetalBand | null;
  hasExplicitMetalQuantity: boolean;
};

export const VERIFIED_GELLER_SKUS: Record<string, VerifiedGellerSku> = {
  "1000": {
    sku: "1000",
    taskDescription:
      "Sizing, 14kt yellow gold, Narrow Ring <3mm, 0–4 stones, Smaller, Torch",
    repairType: "sizing",
    metalFamily: "gold_14k",
    amounts: {
      priceLaborCents: 6_000,
      pricePartsCents: 0,
      priceOtherCents: 0,
      costLaborCents: 1_600,
      costPartsCents: 0,
      costOtherCents: 0,
    },
    metalBand: null,
    hasExplicitMetalQuantity: false,
  },
  "1008": {
    sku: "1008",
    taskDescription:
      "Sizing, 14kt yellow gold, Narrow Ring <3mm, 0–4 stones, Larger, Torch",
    repairType: "sizing",
    metalFamily: "gold_14k",
    amounts: {
      priceLaborCents: 7_900,
      pricePartsCents: 3_300,
      priceOtherCents: 0,
      costLaborCents: 2_100,
      costPartsCents: 1_100,
      costOtherCents: 0,
    },
    metalBand: null,
    hasExplicitMetalQuantity: false,
  },
};

export const VERIFIED_14KT_GOLD_BAND: GellerMetalBand = {
  label: "14kt Gold $2850–$2899/oz Per Pennyweight",
  metalLabel: "14kt Gold",
  goldUsdPerOzMin: 2850,
  goldUsdPerOzMax: 2899,
  unit: "per_pennyweight",
  pricePartsCents: 27_600,
  costPartsCents: 9_200,
};

export function lookupVerifiedSku(sku: string): VerifiedGellerSku | null {
  const key = sku.trim();
  return VERIFIED_GELLER_SKUS[key] ?? null;
}

export function sourceExportPointer(): string {
  return `${GELLER_BLUE_BOOK.exportFile} · ${GELLER_BLUE_BOOK.editionLabel}`;
}
