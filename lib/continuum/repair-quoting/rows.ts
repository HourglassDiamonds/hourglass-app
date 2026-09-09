/**
 * Row mappers for continuum_repair_quotes.
 * Drops invalid rows instead of inventing prices.
 */

import type { RepairQuote, RepairQuoteCalculation, RepairQuoteLineResult, RepairQuoteManualOverride } from "./types";
import {
  isRepairMetalFamily,
  isRepairQuoteState,
  isRepairQuoteType,
  isRepairQuoteUuid,
  parseCreatedBy,
} from "./validate";
import { GELLER_BLUE_BOOK } from "./contract";

export const REPAIR_QUOTE_COLUMNS =
  "quote_id, project_id, quote_number, state, repair_type, metal_family, associated_person_id, source_edition_label, source_sku, line, calculation, override, issued_at, issued_by, voided_at, voided_by, created_at, updated_at, created_by, created_mutation_id, issued_mutation_id";

function text(value: unknown): string | null {
  if (value == null) return null;
  const next = String(value).trim();
  return next ? next : null;
}

function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseAmounts(value: unknown): RepairQuoteLineResult["amounts"] | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const priceLaborCents = intOrNull(rec.priceLaborCents);
  const pricePartsCents = intOrNull(rec.pricePartsCents);
  const priceOtherCents = intOrNull(rec.priceOtherCents);
  const costLaborCents = intOrNull(rec.costLaborCents);
  const costPartsCents = intOrNull(rec.costPartsCents);
  const costOtherCents = intOrNull(rec.costOtherCents);
  if (
    priceLaborCents == null ||
    pricePartsCents == null ||
    priceOtherCents == null ||
    costLaborCents == null ||
    costPartsCents == null ||
    costOtherCents == null
  ) {
    return null;
  }
  return {
    priceLaborCents,
    pricePartsCents,
    priceOtherCents,
    costLaborCents,
    costPartsCents,
    costOtherCents,
  };
}

function parseLine(value: unknown): RepairQuoteLineResult | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const sku = text(rec.sku);
  const taskDescription = text(rec.taskDescription);
  const amounts = parseAmounts(rec.amounts);
  const loadedLaborEighthCents = intOrNull(rec.loadedLaborEighthCents);
  const partsCostEighthCents = intOrNull(rec.partsCostEighthCents);
  const otherCostEighthCents = intOrNull(rec.otherCostEighthCents);
  const fullyLoadedDirectCostEighthCents = intOrNull(
    rec.fullyLoadedDirectCostEighthCents,
  );
  if (
    !sku ||
    !taskDescription ||
    !amounts ||
    loadedLaborEighthCents == null ||
    partsCostEighthCents == null ||
    otherCostEighthCents == null ||
    fullyLoadedDirectCostEighthCents == null
  ) {
    return null;
  }
  return {
    sku,
    taskDescription,
    amounts,
    metalBand:
      rec.metalBand && typeof rec.metalBand === "object"
        ? (rec.metalBand as RepairQuoteLineResult["metalBand"])
        : null,
    hasExplicitMetalQuantity: rec.hasExplicitMetalQuantity === true,
    loadedLaborEighthCents,
    partsCostEighthCents,
    otherCostEighthCents,
    fullyLoadedDirectCostEighthCents,
    metalCostEighthCents: intOrNull(rec.metalCostEighthCents) ?? 0,
    metalPricing:
      rec.metalPricing === "source_band" || rec.metalPricing === "extrapolated"
        ? rec.metalPricing
        : "none",
    millidwt: intOrNull(rec.millidwt),
    goldUsdPerOz: intOrNull(rec.goldUsdPerOz),
    publishedMetalBand:
      rec.publishedMetalBand && typeof rec.publishedMetalBand === "object"
        ? (rec.publishedMetalBand as RepairQuoteLineResult["publishedMetalBand"])
        : null,
    metalSensitive:
      rec.metalSensitive && typeof rec.metalSensitive === "object"
        ? (rec.metalSensitive as RepairQuoteLineResult["metalSensitive"])
        : null,
  };
}

function parseCalculation(value: unknown): RepairQuoteCalculation | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as RepairQuoteCalculation;
  if (rec.sourceFamily !== "geller_blue_book") return null;
  if (rec.sourceVersion !== GELLER_BLUE_BOOK.version) return null;
  if (rec.sourceRelease !== GELLER_BLUE_BOOK.release) return null;
  if (rec.sourceEditionLabel !== GELLER_BLUE_BOOK.editionLabel) return null;
  if (rec.laborBurdenNumerator !== 5 || rec.laborBurdenDenominator !== 4) return null;
  if (rec.hourglassMarkupNumerator !== 5 || rec.hourglassMarkupDenominator !== 2) return null;
  if (rec.expressSelected !== false) return null;
  if (!Number.isInteger(rec.rawComputedQuoteEighthCents)) return null;
  if (!Number.isInteger(rec.roundedComputedQuoteEighthCents)) return null;
  if (!Number.isInteger(rec.hourglassQuoteEighthCents)) return null;
  if (
    rec.metalPricing !== "none" &&
    rec.metalPricing !== "source_band" &&
    rec.metalPricing !== "extrapolated"
  ) {
    return null;
  }
  return rec;
}

function parseOverride(value: unknown): RepairQuoteManualOverride | null {
  if (value == null) return null;
  if (typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const amountCents = intOrNull(rec.amountCents);
  const reason = text(rec.reason);
  const overriddenBy = text(rec.overriddenBy);
  const overriddenAt = text(rec.overriddenAt);
  if (amountCents == null || !reason || !overriddenBy || !overriddenAt) return null;
  return { amountCents, reason, overriddenBy, overriddenAt };
}

export function rowToRepairQuote(
  row: Record<string, unknown> | null | undefined,
): RepairQuote | null {
  if (!row) return null;
  const quoteId = text(row.quote_id);
  const projectId = text(row.project_id);
  if (!quoteId || !projectId || !isRepairQuoteUuid(quoteId) || !isRepairQuoteUuid(projectId)) {
    return null;
  }
  if (!isRepairQuoteType(row.repair_type)) return null;
  if (!isRepairMetalFamily(row.metal_family)) return null;
  if (!isRepairQuoteState(row.state)) return null;
  const createdBy = parseCreatedBy(text(row.created_by));
  const createdAt = text(row.created_at);
  const updatedAt = text(row.updated_at);
  const createdMutationId = text(row.created_mutation_id);
  const quoteNumber = intOrNull(row.quote_number);
  const line = parseLine(row.line);
  const calculation = parseCalculation(row.calculation);
  const sourceSku = text(row.source_sku);
  const sourceEditionLabel = text(row.source_edition_label);
  if (
    !createdBy ||
    !createdAt ||
    !updatedAt ||
    !createdMutationId ||
    quoteNumber == null ||
    !line ||
    !calculation ||
    !sourceSku ||
    !sourceEditionLabel
  ) {
    return null;
  }
  const associated = text(row.associated_person_id);
  return {
    quoteId,
    projectId,
    quoteNumber,
    state: row.state,
    repairType: row.repair_type,
    metalFamily: row.metal_family,
    associatedPersonId: associated,
    sourceEditionLabel,
    sourceSku,
    line,
    calculation,
    override: parseOverride(row.override),
    issuedAt: text(row.issued_at),
    issuedBy: text(row.issued_by),
    voidedAt: text(row.voided_at),
    voidedBy: text(row.voided_by),
    createdAt,
    updatedAt,
    createdBy,
    createdMutationId,
    issuedMutationId: text(row.issued_mutation_id),
  };
}

export function repairQuoteToRow(quote: RepairQuote): Record<string, unknown> {
  return {
    quote_id: quote.quoteId,
    project_id: quote.projectId,
    quote_number: quote.quoteNumber,
    state: quote.state,
    repair_type: quote.repairType,
    metal_family: quote.metalFamily,
    associated_person_id: quote.associatedPersonId,
    source_edition_label: quote.sourceEditionLabel,
    source_sku: quote.sourceSku,
    line: quote.line,
    calculation: quote.calculation,
    override: quote.override,
    issued_at: quote.issuedAt,
    issued_by: quote.issuedBy,
    voided_at: quote.voidedAt,
    voided_by: quote.voidedBy,
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
    created_by: quote.createdBy,
    created_mutation_id: quote.createdMutationId,
    issued_mutation_id: quote.issuedMutationId,
  };
}

export function repairQuoteMutationToRow(input: {
  mutationId: string;
  quoteId: string;
  projectId: string;
  action: string;
  priorState: string | null;
  newState: string;
  priorHourglassQuoteEighthCents: number | null;
  newHourglassQuoteEighthCents: number | null;
  changedAt: string;
  changedBy: string;
}): Record<string, unknown> {
  return {
    mutation_id: input.mutationId,
    quote_id: input.quoteId,
    project_id: input.projectId,
    action: input.action,
    prior_state: input.priorState,
    new_state: input.newState,
    prior_hourglass_quote_eighth_cents: input.priorHourglassQuoteEighthCents,
    new_hourglass_quote_eighth_cents: input.newHourglassQuoteEighthCents,
    changed_at: input.changedAt,
    changed_by: input.changedBy,
  };
}
