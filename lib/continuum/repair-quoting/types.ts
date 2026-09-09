/**
 * Blue Book repair quoting — founder-confirmed source/rule contract (V1).
 *
 * Geller Blue Book Version 5.0 Release 6.50.
 * Bold Price columns = retail. Cost columns = Hourglass cost basis.
 * loadedLabor = Cost Labor × 1.25; Hourglass = 2.5 × (loaded labor + cost parts + cost other).
 * Do not mark up Geller retail. Do not invent dwt when the task has no metal quantity.
 */

import type { GellerMetalBand, GellerSourceAmounts } from "./source";
import { GELLER_BLUE_BOOK, GELLER_COST_BASIS } from "./contract";

export const REPAIR_QUOTE_SOURCE_FAMILY = "geller_blue_book" as const;

export const REPAIR_QUOTE_TYPES = [
  "sizing",
  "head_prong_replacement",
  "laser_work",
  "stone_reset",
  "platinum_labor",
  "fourteen_k_operation",
] as const;

export type RepairQuoteType = (typeof REPAIR_QUOTE_TYPES)[number];

export const REPAIR_METAL_FAMILIES = [
  "gold_10k",
  "gold_14k",
  "gold_18k",
  "platinum",
  "other",
] as const;

export type RepairMetalFamily = (typeof REPAIR_METAL_FAMILIES)[number];

export const REPAIR_QUOTE_STATES = ["draft", "issued", "voided"] as const;

export type RepairQuoteState = (typeof REPAIR_QUOTE_STATES)[number];

export const REPAIR_QUOTE_MUTATION_ACTIONS = [
  "create",
  "revise_draft",
  "override",
  "issue",
  "void",
] as const;

export type RepairQuoteMutationAction =
  (typeof REPAIR_QUOTE_MUTATION_ACTIONS)[number];

export const SOURCE_SKU_MAX = 40;
export const SOURCE_LINE_LABEL_MAX = 240;
export const SOURCE_EDITION_MAX = 120;
export const OVERRIDE_REASON_MAX = 240;
export const CREATED_BY_MAX = 80;

export const EIGHTH_CENTS_PER_DOLLAR = 800;

export type RepairQuoteCostBasis = typeof GELLER_COST_BASIS;

export type RepairQuoteLineInput = {
  sku: string;
  taskDescription: string;
  amounts: GellerSourceAmounts;
  metalBand?: GellerMetalBand | null;
  hasExplicitMetalQuantity?: boolean;
  inventedMetalQuantity?: boolean;
  expressSelected?: boolean;
  /** Forbidden: passing Geller Price columns as the cost basis. */
  costBasis?: RepairQuoteCostBasis | "geller_price_columns";
};

export type RepairQuoteCalculationInput = {
  repairType: RepairQuoteType;
  metalFamily: RepairMetalFamily;
  line: RepairQuoteLineInput;
  overrideAmountCents?: number | null;
  overrideReason?: string | null;
};

export type RepairQuoteLineResult = {
  sku: string;
  taskDescription: string;
  amounts: GellerSourceAmounts;
  metalBand: GellerMetalBand | null;
  hasExplicitMetalQuantity: boolean;
  loadedLaborEighthCents: number;
  partsCostEighthCents: number;
  otherCostEighthCents: number;
  fullyLoadedDirectCostEighthCents: number;
};

export type RepairQuoteWarning = never;

export type RepairQuoteCalculation = {
  sourceFamily: typeof REPAIR_QUOTE_SOURCE_FAMILY;
  sourceVersion: typeof GELLER_BLUE_BOOK.version;
  sourceRelease: typeof GELLER_BLUE_BOOK.release;
  sourceEditionLabel: string;
  sourceSku: string;
  sourceTaskDescription: string;
  sourceAmounts: GellerSourceAmounts;
  laborBurdenNumerator: 5;
  laborBurdenDenominator: 4;
  hourglassMarkupNumerator: 5;
  hourglassMarkupDenominator: 2;
  metalBand: GellerMetalBand | null;
  expressSelected: false;
  line: RepairQuoteLineResult;
  loadedLaborEighthCents: number;
  partsCostEighthCents: number;
  otherCostEighthCents: number;
  fullyLoadedDirectCostEighthCents: number;
  rawComputedQuoteEighthCents: number;
  computedHourglassQuoteEighthCents: number;
  hourglassQuoteEighthCents: number;
  overrideApplied: boolean;
  warnings: RepairQuoteWarning[];
};

export type RepairQuoteManualOverride = {
  amountCents: number;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
};

export type RepairQuote = {
  quoteId: string;
  projectId: string;
  quoteNumber: number;
  state: RepairQuoteState;
  repairType: RepairQuoteType;
  metalFamily: RepairMetalFamily;
  associatedPersonId: string | null;
  sourceEditionLabel: string;
  sourceSku: string;
  line: RepairQuoteLineResult;
  calculation: RepairQuoteCalculation;
  override: RepairQuoteManualOverride | null;
  issuedAt: string | null;
  issuedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdMutationId: string;
  issuedMutationId: string | null;
};

export type RepairQuoteMutationRecord = {
  mutationId: string;
  quoteId: string;
  projectId: string;
  action: RepairQuoteMutationAction;
  priorState: RepairQuoteState | null;
  newState: RepairQuoteState;
  priorHourglassQuoteEighthCents: number | null;
  newHourglassQuoteEighthCents: number | null;
  changedAt: string;
  changedBy: string;
};

export type RepairQuoteCalculateFailure = {
  ok: false;
  reason: "invalid-input";
  code: RepairQuoteInvalidCode;
};

export type RepairQuoteCalculateSuccess = {
  ok: true;
  calculation: RepairQuoteCalculation;
};

export type RepairQuoteCalculateResult =
  | RepairQuoteCalculateSuccess
  | RepairQuoteCalculateFailure;

export type RepairQuoteInvalidCode =
  | "invalid-id"
  | "invalid-repair-type"
  | "invalid-metal"
  | "invalid-source-edition"
  | "invalid-source-line"
  | "invalid-source-amount"
  | "missing-lines"
  | "retail-used-as-cost"
  | "invented-metal-quantity"
  | "express-not-enabled"
  | "double-markup-blocked"
  | "invalid-override"
  | "issued-quote-immutable"
  | "voided-quote-immutable"
  | "not-draft"
  | "wrong-project"
  | "project-not-repair"
  | "person-not-on-project";
