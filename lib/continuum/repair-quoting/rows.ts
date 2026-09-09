/**
 * Row mappers for continuum_repair_quotes.
 * Drops invalid rows instead of inventing prices.
 */

import type { RepairQuote, RepairQuoteCalculation, RepairQuoteLineResult, RepairQuoteManualOverride } from "./types";
import {
  isGoldInputSource,
  isGoldWeightKind,
  isRepairMetalFamily,
  isRepairQuoteState,
  isRepairQuoteType,
  isRepairQuoteUuid,
  isSourcePriceSemantics,
  parseCreatedBy,
  parseSourceEdition,
} from "./validate";
import { parseDateOnly } from "@/lib/continuum/date-only";

export const REPAIR_QUOTE_COLUMNS =
  "quote_id, project_id, quote_number, state, repair_type, metal_family, associated_person_id, source_edition_label, source_price_semantics, gold_usd_cents_per_oz, gold_as_of_date, gold_input_source, gold_baseline_usd_cents_per_oz, markup_ratio_permyriad, lines, calculation, override, issued_at, issued_by, voided_at, voided_by, created_at, updated_at, created_by, created_mutation_id, issued_mutation_id";

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

function parseLines(value: unknown): RepairQuoteLineResult[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines: RepairQuoteLineResult[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const rec = row as Record<string, unknown>;
    const sourceAmountCents = intOrNull(rec.sourceAmountCents);
    const metalDeltaCents = intOrNull(rec.metalDeltaCents);
    const adjustedSourceCents = intOrNull(rec.adjustedSourceCents);
    if (
      typeof rec.sourceLineRef !== "string" ||
      typeof rec.sourceLineLabel !== "string" ||
      sourceAmountCents == null ||
      metalDeltaCents == null ||
      adjustedSourceCents == null ||
      typeof rec.goldSensitive !== "boolean"
    ) {
      return null;
    }
    const kind = rec.goldWeightKind == null ? null : rec.goldWeightKind;
    if (kind != null && !isGoldWeightKind(kind)) return null;
    lines.push({
      sourceLineRef: rec.sourceLineRef,
      sourceLineLabel: rec.sourceLineLabel,
      sourceAmountCents,
      goldSensitive: rec.goldSensitive,
      goldWeightKind: kind,
      goldWeightMillidwt: intOrNull(rec.goldWeightMillidwt),
      fineGoldMillidwt: intOrNull(rec.fineGoldMillidwt),
      metalDeltaCents,
      adjustedSourceCents,
    });
  }
  return lines;
}

function parseCalculation(value: unknown): RepairQuoteCalculation | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as RepairQuoteCalculation;
  if (rec.sourceFamily !== "founder_transcribed_blue_book") return null;
  if (!isSourcePriceSemantics(rec.sourcePriceSemantics)) return null;
  if (!Array.isArray(rec.lines) || !Number.isInteger(rec.hourglassQuoteCents)) {
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
  if (!isSourcePriceSemantics(row.source_price_semantics)) return null;
  if (!isGoldInputSource(row.gold_input_source)) return null;
  const sourceEdition = parseSourceEdition(text(row.source_edition_label));
  const createdBy = parseCreatedBy(text(row.created_by));
  const goldAsOfDate = parseDateOnly(text(row.gold_as_of_date));
  const createdAt = text(row.created_at);
  const updatedAt = text(row.updated_at);
  const createdMutationId = text(row.created_mutation_id);
  const quoteNumber = intOrNull(row.quote_number);
  const goldUsdCentsPerTroyOz = intOrNull(row.gold_usd_cents_per_oz);
  const lines = parseLines(row.lines);
  const calculation = parseCalculation(row.calculation);
  if (
    !sourceEdition ||
    !createdBy ||
    !goldAsOfDate ||
    !createdAt ||
    !updatedAt ||
    !createdMutationId ||
    quoteNumber == null ||
    goldUsdCentsPerTroyOz == null ||
    !lines ||
    !calculation
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
    sourceEditionLabel: sourceEdition,
    sourcePriceSemantics: row.source_price_semantics,
    goldUsdCentsPerTroyOz,
    goldAsOfDate,
    goldInputSource: row.gold_input_source,
    goldBaselineUsdCentsPerTroyOz: intOrNull(row.gold_baseline_usd_cents_per_oz),
    markupRatioPermyriad: intOrNull(row.markup_ratio_permyriad),
    lines,
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
    source_price_semantics: quote.sourcePriceSemantics,
    gold_usd_cents_per_oz: quote.goldUsdCentsPerTroyOz,
    gold_as_of_date: quote.goldAsOfDate,
    gold_input_source: quote.goldInputSource,
    gold_baseline_usd_cents_per_oz: quote.goldBaselineUsdCentsPerTroyOz,
    markup_ratio_permyriad: quote.markupRatioPermyriad,
    lines: quote.lines,
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
  priorHourglassQuoteCents: number | null;
  newHourglassQuoteCents: number | null;
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
    prior_hourglass_quote_cents: input.priorHourglassQuoteCents,
    new_hourglass_quote_cents: input.newHourglassQuoteCents,
    changed_at: input.changedAt,
    changed_by: input.changedBy,
  };
}
