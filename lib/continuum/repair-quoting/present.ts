/**
 * Founder-facing repair quote labels. Never display raw UUIDs.
 */

import { formatUsdCents } from "./money";
import { formatMillidwt } from "./gold";
import type {
  RepairMetalFamily,
  RepairQuote,
  RepairQuoteState,
  RepairQuoteType,
  SourcePriceSemantics,
} from "./types";

export const REPAIR_QUOTE_TYPE_LABELS: Record<RepairQuoteType, string> = {
  sizing: "Sizing",
  head_prong_replacement: "Head / prong replacement",
  laser_work: "Laser work",
  stone_reset: "Reset",
  platinum_labor: "Platinum labor",
  fourteen_k_operation: "14K operation",
};

export const REPAIR_METAL_LABELS: Record<RepairMetalFamily, string> = {
  gold_10k: "10K gold",
  gold_14k: "14K gold",
  gold_18k: "18K gold",
  platinum: "Platinum",
  other: "Other metal",
};

export const SOURCE_SEMANTICS_LABELS: Record<SourcePriceSemantics, string> = {
  shop_cost: "Shop cost",
  suggested_retail: "Suggested retail",
};

export const REPAIR_QUOTE_STATE_LABELS: Record<RepairQuoteState, string> = {
  draft: "Draft",
  issued: "Issued",
  voided: "Voided",
};

export const REPAIR_QUOTE_SECTION_TITLE = "Repair quotes";
export const REPAIR_QUOTES_NONE_LABEL = "No repair quotes recorded.";
export const REPAIR_QUOTES_NOT_CONNECTED_LABEL = "Repair quotes are not connected yet.";
export const REPAIR_QUOTE_ADD_LABEL = "New repair quote";
export const STALE_GOLD_WARNING =
  "Gold input is older than one day. Confirm current gold before issuing.";

export function repairQuoteTypeLabel(type: RepairQuoteType): string {
  return REPAIR_QUOTE_TYPE_LABELS[type];
}

export function repairMetalLabel(metal: RepairMetalFamily): string {
  return REPAIR_METAL_LABELS[metal];
}

export function repairQuoteDisplayTitle(quote: RepairQuote): string {
  return `Quote ${quote.quoteNumber} · ${REPAIR_QUOTE_TYPE_LABELS[quote.repairType]}`;
}

export function repairQuoteAmountLabel(quote: RepairQuote): string {
  return formatUsdCents(quote.calculation.hourglassQuoteCents);
}

export function markupMultipleLabel(permyriad: number | null): string {
  if (permyriad == null) return "None";
  const whole = Math.floor(permyriad / 10_000);
  const frac = permyriad % 10_000;
  if (frac === 0) return `${whole}×`;
  const decimals = String(frac).padStart(4, "0").replace(/0+$/, "");
  return `${whole}.${decimals}×`;
}

export function goldWeightLabel(quote: RepairQuote): string | null {
  const line = quote.lines.find((row) => row.goldSensitive);
  if (!line || line.goldWeightMillidwt == null) return null;
  const kind = line.goldWeightKind === "fine_dwt" ? "fine dwt" : "alloy dwt";
  return `${formatMillidwt(line.goldWeightMillidwt)} ${kind}`;
}
