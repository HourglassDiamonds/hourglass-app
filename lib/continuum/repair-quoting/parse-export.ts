/**
 * Deterministic Geller RepairTaskSKUs export parser.
 * Uses Cost/Price tier 1 only. Does not invent dwt or Express.
 */

import { cellText, type CellScalar, type SheetTable } from "@/lib/continuum/client-memory/xlsx";
import { GELLER_BLUE_BOOK } from "./contract";
import {
  inferMetalSemantics,
  inferMetalUnit,
  type MetalSemanticsKind,
  type MetalUnitKind,
} from "./metal-semantics";
import type { GellerSourceAmounts } from "./source";
import type { RepairMetalFamily, RepairQuoteType } from "./types";

export const GELLER_EXPORT_COLUMNS = [
  "Sku",
  "Task Desc",
  "Notes",
  "Inactive",
  "Max Qty 1",
  "Price Labor 1",
  "Price Parts 1",
  "Price Other 1",
  "Cost Labor 1",
  "Cost Parts 1",
  "Cost Other 1",
] as const;

export const GELLER_EXPORT_ABSENT_COLUMNS = ["Express", "JLRC"] as const;

export type GellerRejectReason =
  | "missing-sku"
  | "missing-task-description"
  | "missing-source-amount"
  | "inactive-source-row"
  | "duplicate-sku"
  | "invalid-source-amount";

export type GellerCatalogRow = {
  sku: string;
  taskDescription: string;
  notes: string | null;
  category: string;
  amounts: GellerSourceAmounts;
  maxQty1: number | null;
  hasQuantityBreaks: boolean;
  metalSemantics: MetalSemanticsKind;
  metalUnit: MetalUnitKind;
  inferredRepairType: RepairQuoteType;
  inferredMetalFamily: RepairMetalFamily;
  goldUsdPerOzMin: number | null;
  goldUsdPerOzMax: number | null;
  searchText: string;
};

export type GellerParseRejection = {
  excelRow: number;
  sku: string | null;
  reason: GellerRejectReason;
};

export type GellerParseResult = {
  source: {
    family: typeof GELLER_BLUE_BOOK.family;
    version: typeof GELLER_BLUE_BOOK.version;
    release: typeof GELLER_BLUE_BOOK.release;
    editionLabel: typeof GELLER_BLUE_BOOK.editionLabel;
    exportFile: string;
    sha256: string;
    sheetName: string;
    sourceRowCount: number;
  };
  rows: GellerCatalogRow[];
  rejected: GellerParseRejection[];
};

function dollarsToCents(value: CellScalar): number | null {
  if (value == null || value === "") return 0;
  if (typeof value === "boolean") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    if (!Number.isInteger(cents) || cents > 99_999_999_00) return null;
    return cents;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  if (!Number.isInteger(cents) || cents > 99_999_999_00) return null;
  return cents;
}

function optionalQty(value: CellScalar): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const n = Math.round(value);
  return n > 0 ? n : null;
}

export function parseGoldRangeFromDescription(desc: string): {
  goldUsdPerOzMin: number | null;
  goldUsdPerOzMax: number | null;
} {
  const match = /\$([0-9]{3,5})\s*[-–]\s*\$?([0-9]{3,5})\s*per ounce/i.exec(desc);
  if (!match) return { goldUsdPerOzMin: null, goldUsdPerOzMax: null };
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) {
    return { goldUsdPerOzMin: null, goldUsdPerOzMax: null };
  }
  return { goldUsdPerOzMin: min, goldUsdPerOzMax: max };
}

export function inferRepairTypeFromDescription(desc: string): RepairQuoteType {
  const d = desc.toLowerCase();
  const prefix = d.split(",")[0] ?? d;
  if (/\blaser\b/.test(d)) return "laser_work";
  if (/sizing|forever fit|superfit/.test(prefix)) return "sizing";
  if (/head|bezel|prong|shank|tips/.test(prefix)) return "head_prong_replacement";
  if (/^stones\b|^setting only|repair\/recut|\breset\b/.test(prefix) || /\breset\b/.test(d)) {
    return "stone_reset";
  }
  if (/\bplatinum\b/.test(d) && !/per (pennyweight|gram)/.test(d)) return "platinum_labor";
  return "fourteen_k_operation";
}

export function inferMetalFamilyFromDescription(desc: string): RepairMetalFamily {
  const d = desc.toLowerCase();
  if (/\b10k|\b10kt/.test(d)) return "gold_10k";
  if (/\b18k|\b18kt/.test(d)) return "gold_18k";
  if (/\bplatinum\b/.test(d)) return "platinum";
  if (/\b14k|\b14kt/.test(d)) return "gold_14k";
  return "other";
}

export function catalogSearchText(row: {
  sku: string;
  taskDescription: string;
  notes: string | null;
  category: string;
}): string {
  return [row.sku, row.category, row.taskDescription, row.notes ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/–/g, "-");
}

function tierHasMoney(values: Record<string, CellScalar>, tier: number): boolean {
  return [
    `Price Labor ${tier}`,
    `Price Parts ${tier}`,
    `Price Other ${tier}`,
    `Cost Labor ${tier}`,
    `Cost Parts ${tier}`,
    `Cost Other ${tier}`,
  ].some((key) => {
    const v = values[key];
    return typeof v === "number" && Number.isFinite(v) && v !== 0;
  });
}

export function parseGellerRepairSkuSheet(
  sheet: SheetTable,
  input: { exportFile: string; sha256: string },
): GellerParseResult {
  const seen = new Map<string, number>();
  const rows: GellerCatalogRow[] = [];
  const rejected: GellerParseRejection[] = [];

  for (const row of sheet.rows) {
    const sku = cellText(row.values.Sku);
    const taskDescription = cellText(row.values["Task Desc"]);
    const notesRaw = cellText(row.values.Notes);
    const notes = notesRaw || null;
    if (row.values.Inactive === true) {
      rejected.push({ excelRow: row.excelRow, sku: sku || null, reason: "inactive-source-row" });
      continue;
    }
    if (!sku) {
      rejected.push({ excelRow: row.excelRow, sku: null, reason: "missing-sku" });
      continue;
    }
    if (!taskDescription) {
      rejected.push({ excelRow: row.excelRow, sku, reason: "missing-task-description" });
      continue;
    }
    const priceLaborCents = dollarsToCents(row.values["Price Labor 1"]);
    const pricePartsCents = dollarsToCents(row.values["Price Parts 1"]);
    const priceOtherCents = dollarsToCents(row.values["Price Other 1"]);
    const costLaborCents = dollarsToCents(row.values["Cost Labor 1"]);
    const costPartsCents = dollarsToCents(row.values["Cost Parts 1"]);
    const costOtherCents = dollarsToCents(row.values["Cost Other 1"]);
    if (
      priceLaborCents == null ||
      pricePartsCents == null ||
      priceOtherCents == null ||
      costLaborCents == null ||
      costPartsCents == null ||
      costOtherCents == null
    ) {
      rejected.push({ excelRow: row.excelRow, sku, reason: "invalid-source-amount" });
      continue;
    }
    if (
      costLaborCents + costPartsCents + costOtherCents + priceLaborCents + pricePartsCents + priceOtherCents <=
      0
    ) {
      rejected.push({ excelRow: row.excelRow, sku, reason: "missing-source-amount" });
      continue;
    }
    const prior = seen.get(sku);
    if (prior != null) {
      rejected.push({ excelRow: row.excelRow, sku, reason: "duplicate-sku" });
      continue;
    }
    seen.set(sku, row.excelRow);
    const amounts: GellerSourceAmounts = {
      priceLaborCents,
      pricePartsCents,
      priceOtherCents,
      costLaborCents,
      costPartsCents,
      costOtherCents,
    };
    const category = taskDescription.split(",")[0]?.trim() || taskDescription;
    const metalUnit = inferMetalUnit(taskDescription);
    const metalSemantics = inferMetalSemantics({
      taskDescription,
      costPartsCents,
    });
    const gold = parseGoldRangeFromDescription(taskDescription);
    const catalogRow: GellerCatalogRow = {
      sku,
      taskDescription,
      notes,
      category,
      amounts,
      maxQty1: optionalQty(row.values["Max Qty 1"]),
      hasQuantityBreaks: [2, 3, 4, 5, 6, 7].some((tier) => tierHasMoney(row.values, tier)),
      metalSemantics,
      metalUnit,
      inferredRepairType: inferRepairTypeFromDescription(taskDescription),
      inferredMetalFamily: inferMetalFamilyFromDescription(taskDescription),
      goldUsdPerOzMin: gold.goldUsdPerOzMin,
      goldUsdPerOzMax: gold.goldUsdPerOzMax,
      searchText: "",
    };
    catalogRow.searchText = catalogSearchText(catalogRow);
    rows.push(catalogRow);
  }

  rows.sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  rejected.sort((a, b) => a.excelRow - b.excelRow || a.sku?.localeCompare(b.sku ?? "") || 0);

  return {
    source: {
      family: GELLER_BLUE_BOOK.family,
      version: GELLER_BLUE_BOOK.version,
      release: GELLER_BLUE_BOOK.release,
      editionLabel: GELLER_BLUE_BOOK.editionLabel,
      exportFile: input.exportFile,
      sha256: input.sha256,
      sheetName: sheet.name,
      sourceRowCount: sheet.rows.length,
    },
    rows,
    rejected,
  };
}

export function rejectionCounts(
  rejected: GellerParseRejection[],
): Record<GellerRejectReason, number> {
  const counts: Record<GellerRejectReason, number> = {
    "missing-sku": 0,
    "missing-task-description": 0,
    "missing-source-amount": 0,
    "inactive-source-row": 0,
    "duplicate-sku": 0,
    "invalid-source-amount": 0,
  };
  for (const row of rejected) counts[row.reason] += 1;
  return counts;
}
