/**
 * Founder-facing repair quote labels. Never display raw UUIDs.
 */

import { formatUsdCents, formatUsdEighthCents } from "./money";
import { HOURGLASS_MARKUP_LABEL, LABOR_BURDEN_LABEL } from "./contract";
import type {
  RepairMetalFamily,
  RepairQuote,
  RepairQuoteState,
  RepairQuoteType,
} from "./types";

export { HOURGLASS_MARKUP_LABEL, LABOR_BURDEN_LABEL };

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

export const REPAIR_QUOTE_STATE_LABELS: Record<RepairQuoteState, string> = {
  draft: "Draft",
  issued: "Issued",
  voided: "Voided",
};

export const REPAIR_QUOTE_SECTION_TITLE = "Repair quotes";
export const REPAIR_QUOTES_NONE_LABEL = "No repair quotes recorded.";
export const REPAIR_QUOTES_NOT_CONNECTED_LABEL = "Repair quotes are not connected yet.";
export const REPAIR_QUOTE_ADD_LABEL = "New repair quote";

export function repairQuoteTypeLabel(type: RepairQuoteType): string {
  return REPAIR_QUOTE_TYPE_LABELS[type];
}

export function repairMetalLabel(metal: RepairMetalFamily): string {
  return REPAIR_METAL_LABELS[metal];
}

export function repairQuoteDisplayTitle(quote: RepairQuote): string {
  return `Quote ${quote.quoteNumber} · SKU ${quote.sourceSku}`;
}

export function repairQuoteAmountLabel(quote: RepairQuote): string {
  if (quote.override) return formatUsdCents(quote.override.amountCents);
  return formatUsdEighthCents(quote.calculation.hourglassQuoteEighthCents);
}

export function laborBurdenLabel(): string {
  return `${LABOR_BURDEN_LABEL}×`;
}

export function hourglassMarkupLabel(): string {
  return `${HOURGLASS_MARKUP_LABEL}× cost`;
}
