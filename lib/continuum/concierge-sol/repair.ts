/**
 * Deterministic Hourglass repair quoting for Concierge.
 * Sol may recognize intent; Continuum owns the price. Laser-only for sizing.
 */

import { calculateRepairQuote } from "@/lib/continuum/repair-quoting/calculate";
import { gellerCatalogRows, lookupCatalogSku } from "@/lib/continuum/repair-quoting/catalog";
import { GELLER_COST_BASIS } from "@/lib/continuum/repair-quoting/contract";
import { formatUsdEighthCents } from "@/lib/continuum/repair-quoting/money";
import type { GellerCatalogRow } from "@/lib/continuum/repair-quoting/parse-export";

export const HOURGLASS_SIZING_METHOD = "laser" as const;

export type RepairQuoteToolInput = {
  query?: string | null;
  metal?: string | null;
  repairType?: string | null;
  shankMm?: number | null;
  fromSize?: number | null;
  toSize?: number | null;
  stoneCount?: number | null;
};

export type RepairQuoteToolSuccess = {
  ok: true;
  quoted: true;
  amountLabel: string;
  hourglassQuoteEighthCents: number;
  method: "laser";
  taskDescription: string;
  metalLabel: string;
  direction: "larger" | "smaller";
  shankBand: string;
  stoneBand: string;
  assumedStoneBand: boolean;
  clientAnswer: string;
};

export type RepairQuoteToolFailure = {
  ok: true;
  quoted: false;
  reason:
    | "unrecognized"
    | "ambiguous"
    | "no-laser-sku"
    | "same-size"
    | "calculator-failed";
  detail: string;
};

export type RepairQuoteToolResult = RepairQuoteToolSuccess | RepairQuoteToolFailure;

const TORCH = /\btorch\b/i;
const LASER = /\blaser\b/i;
const HP = /\bsizing-hp\b/i;

function fold(value: string): string {
  return value.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim();
}

export function parseRepairQuoteIntent(input: RepairQuoteToolInput): {
  metal: "yellow" | "white" | "rose" | null;
  karat: "14k" | "10k" | "18k" | null;
  repairType: "sizing" | null;
  shankMm: number | null;
  fromSize: number | null;
  toSize: number | null;
  stoneCount: number | null;
  direction: "larger" | "smaller" | null;
} {
  const raw = fold([input.query, input.metal, input.repairType].filter(Boolean).join(" "));
  let metal: "yellow" | "white" | "rose" | null = null;
  if (/\b14ky\b|\byellow\b|\byg\b/.test(raw)) metal = "yellow";
  else if (/\b14kw\b|\bwhite\b|\bwg\b/.test(raw)) metal = "white";
  else if (/\brose\b|\brg\b/.test(raw)) metal = "rose";
  if (input.metal) {
    const m = fold(input.metal);
    if (/yellow|14ky|yg/.test(m)) metal = "yellow";
    if (/white|14kw|wg/.test(m)) metal = "white";
    if (/rose|rg/.test(m)) metal = "rose";
  }

  let karat: "14k" | "10k" | "18k" | null = null;
  if (/\b14k|\b14kt|\b14ky|\b14kw/.test(raw)) karat = "14k";
  else if (/\b10k|\b10kt/.test(raw)) karat = "10k";
  else if (/\b18k|\b18kt/.test(raw)) karat = "18k";

  const sizing =
    /\bsiz(?:e|ing)\b/.test(raw) ||
    input.repairType?.toLowerCase().includes("siz") === true ||
    input.fromSize != null ||
    input.toSize != null;

  const shankFromQuery = raw.match(/\b(\d+(?:\.\d+)?)\s*mm\b/);
  const shankMm =
    typeof input.shankMm === "number" && Number.isFinite(input.shankMm)
      ? input.shankMm
      : shankFromQuery
        ? Number(shankFromQuery[1])
        : null;

  const fromSize =
    typeof input.fromSize === "number" && Number.isFinite(input.fromSize)
      ? input.fromSize
      : parseSize(raw, /from\s+(?:a\s+)?(\d+(?:\.\d+)?)/);
  const toSize =
    typeof input.toSize === "number" && Number.isFinite(input.toSize)
      ? input.toSize
      : parseSize(raw, /(?:to|up to)\s+(?:a\s+)?(\d+(?:\.\d+)?)/);

  let direction: "larger" | "smaller" | null = null;
  if (fromSize != null && toSize != null) {
    if (toSize > fromSize) direction = "larger";
    else if (toSize < fromSize) direction = "smaller";
  } else if (/\blarger|size up|sizing up\b/.test(raw)) {
    direction = "larger";
  } else if (/\bsmaller|size down|sizing down\b/.test(raw)) {
    direction = "smaller";
  }

  const stoneCount =
    typeof input.stoneCount === "number" && Number.isFinite(input.stoneCount)
      ? input.stoneCount
      : parseStoneCount(raw);

  return {
    metal,
    karat,
    repairType: sizing ? "sizing" : null,
    shankMm,
    fromSize,
    toSize,
    stoneCount,
    direction,
  };
}

function parseSize(raw: string, pattern: RegExp): number | null {
  const match = raw.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseStoneCount(raw: string): number | null {
  const match = raw.match(/\b(\d+)\s+stones?\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function stoneBand(count: number | null): { label: string; assumed: boolean } {
  if (count == null) return { label: "0-4 stones", assumed: true };
  if (count <= 4) return { label: "0-4 stones", assumed: false };
  if (count <= 20) return { label: "5-20 Stones", assumed: false };
  if (count <= 35) return { label: "21-35 Stones", assumed: false };
  return { label: "36-50 Stones", assumed: false };
}

function shankBand(mm: number | null): string | null {
  if (mm == null) return null;
  if (mm < 3) return "Narrow Ring-<3mm";
  return "Wide";
}

function metalNeedle(intent: ReturnType<typeof parseRepairQuoteIntent>): string {
  const karat = intent.karat === "10k" ? "10kt" : intent.karat === "18k" ? "18kt" : "14kt";
  const color = intent.metal === "white" ? "White Gold" : intent.metal === "rose" ? "rose" : "yellow gold";
  return `${karat} ${color}`;
}

function isLaserSizingRow(row: Pick<GellerCatalogRow, "taskDescription">): boolean {
  const desc = row.taskDescription;
  if (!LASER.test(desc)) return false;
  if (TORCH.test(desc)) return false;
  if (HP.test(desc)) return false;
  return /\bsizing\b/i.test(desc);
}

function matchesLaserSizing(
  row: GellerCatalogRow,
  intent: ReturnType<typeof parseRepairQuoteIntent>,
  shank: string,
  stoneLabel: string,
  metal: string,
): boolean {
  if (!isLaserSizingRow(row)) return false;
  const desc = row.taskDescription;
  if (intent.direction === "larger" && !/larger/i.test(desc)) return false;
  if (intent.direction === "smaller" && !/smaller/i.test(desc)) return false;
  if (shank.includes("Narrow") && !/narrow ring-<3mm/i.test(desc)) return false;
  if (!shank.includes("Narrow") && /narrow ring-<3mm/i.test(desc)) return false;
  if (stoneLabel.startsWith("0-4") && !/0-4 stones/i.test(desc)) return false;
  if (stoneLabel.startsWith("5-20") && !/5-20/i.test(desc)) return false;
  if (stoneLabel.startsWith("21-35") && !/21-35/i.test(desc)) return false;
  if (stoneLabel.startsWith("36-50") && !/36-50/i.test(desc)) return false;
  if (metal.includes("yellow") && !/yellow/i.test(desc)) return false;
  if (metal.includes("White") && !/white/i.test(desc)) return false;
  if (intent.karat === "14k" && !/14kt/i.test(desc)) return false;
  if (intent.karat === "10k" && !/10kt/i.test(desc)) return false;
  if (intent.karat === "18k" && !/18kt/i.test(desc)) return false;
  return true;
}

export function quoteRepairFromContinuum(input: RepairQuoteToolInput): RepairQuoteToolResult {
  const intent = parseRepairQuoteIntent(input);
  if (intent.repairType !== "sizing") {
    return {
      ok: true,
      quoted: false,
      reason: "unrecognized",
      detail: "Continuum can quote sizing from the Geller catalog. Ask with metal, shank, and sizes.",
    };
  }
  if (intent.fromSize != null && intent.toSize != null && intent.fromSize === intent.toSize) {
    return {
      ok: true,
      quoted: false,
      reason: "same-size",
      detail: "Those finger sizes are the same, so Continuum has no sizing charge to quote.",
    };
  }
  if (!intent.direction || !intent.karat) {
    return {
      ok: true,
      quoted: false,
      reason: "unrecognized",
      detail: "Continuum needs the metal and whether the ring is being sized up or down.",
    };
  }

  const stones = stoneBand(intent.stoneCount);
  const shank = shankBand(intent.shankMm) ?? "Narrow Ring-<3mm";
  const metal = metalNeedle(intent);
  const rows = gellerCatalogRows().filter((row) =>
    matchesLaserSizing(row, intent, shank, stones.label, metal),
  );

  if (rows.length === 0) {
    return {
      ok: true,
      quoted: false,
      reason: "no-laser-sku",
      detail: "Hourglass quotes laser sizing only, and Continuum could not find a matching laser SKU.",
    };
  }
  if (rows.length > 1) {
    return {
      ok: true,
      quoted: false,
      reason: "ambiguous",
      detail: "Continuum found more than one laser sizing SKU. Specify stone count before quoting.",
    };
  }
  const chosen = rows[0]!;

  const row = lookupCatalogSku(chosen.sku);
  if (!row) {
    return {
      ok: true,
      quoted: false,
      reason: "calculator-failed",
      detail: "The matching catalog line could not be loaded.",
    };
  }

  const calculated = calculateRepairQuote({
    repairType: row.inferredRepairType,
    metalFamily: row.inferredMetalFamily,
    line: {
      sku: row.sku,
      taskDescription: row.taskDescription,
      amounts: row.amounts,
      metalSemantics: row.metalSemantics,
      inventedMetalQuantity: false,
      expressSelected: false,
      costBasis: GELLER_COST_BASIS,
    },
  });
  if (!calculated.ok) {
    return {
      ok: true,
      quoted: false,
      reason: "calculator-failed",
      detail: "Continuum could not calculate that repair from the catalog.",
    };
  }

  const amountLabel = formatUsdEighthCents(calculated.calculation.hourglassQuoteEighthCents);
  const metalLabel = intent.metal === "white" ? "14K white gold" : intent.karat === "10k" ? "10K gold" : "14K yellow gold";
  const sizePhrase =
    intent.fromSize != null && intent.toSize != null
      ? ` from size ${trimSize(intent.fromSize)} to ${trimSize(intent.toSize)}`
      : intent.direction === "larger"
        ? " (sizing up)"
        : " (sizing down)";
  const stonePhrase = stones.assumed ? ", assuming 0–4 stones" : "";
  const clientAnswer =
    `${amountLabel} for a ${metalLabel} laser sizing on a ${intent.shankMm ?? 2}mm shank${sizePhrase}${stonePhrase}. ` +
    `Hourglass quotes laser sizing only.`;

  return {
    ok: true,
    quoted: true,
    amountLabel,
    hourglassQuoteEighthCents: calculated.calculation.hourglassQuoteEighthCents,
    method: "laser",
    taskDescription: row.taskDescription,
    metalLabel,
    direction: intent.direction,
    shankBand: shank,
    stoneBand: stones.label,
    assumedStoneBand: stones.assumed,
    clientAnswer,
  };
}

function trimSize(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function repairContextCopy(): string {
  return "Hourglass quotes laser sizing only. Prices come from the Geller cost columns with the Hourglass 2.5× rule, never from a model guess.";
}
