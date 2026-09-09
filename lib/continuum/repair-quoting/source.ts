/**
 * Geller source snapshots. SKU lookup reads the generated catalog.
 * VERIFIED_14KT_GOLD_BAND remains the founder-checked per-dwt example.
 */

import { GELLER_BLUE_BOOK } from "./contract";
import { lookupCatalogSku } from "./catalog";
import type { MetalSemanticsKind } from "./metal-semantics";
import type { RepairMetalFamily, RepairQuoteType } from "./types";

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
  repairType: RepairQuoteType;
  metalFamily: RepairMetalFamily;
  amounts: GellerSourceAmounts;
  metalBand: GellerMetalBand | null;
  hasExplicitMetalQuantity: boolean;
  metalSemantics: MetalSemanticsKind;
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
  const row = lookupCatalogSku(sku);
  if (!row) return null;
  return {
    sku: row.sku,
    taskDescription: row.taskDescription,
    repairType: row.inferredRepairType,
    metalFamily: row.inferredMetalFamily,
    amounts: row.amounts,
    metalBand: null,
    hasExplicitMetalQuantity: row.metalSemantics === "per_dwt_14k",
    metalSemantics: row.metalSemantics,
  };
}

export function sourceExportPointer(): string {
  return `${GELLER_BLUE_BOOK.exportFile} · ${GELLER_BLUE_BOOK.editionLabel}`;
}
