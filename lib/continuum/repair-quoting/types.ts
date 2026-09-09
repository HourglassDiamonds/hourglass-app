/**
 * Blue Book repair quoting — source/rule contract (V1).
 *
 * There is no Geller/Edge catalog in this repo. V1 never invents book prices.
 * Founder transcribes a source line and declares what that number means.
 *
 * Historical founder discussion (UNVERIFIED, not live defaults):
 * Geller / Blue Book, Edge / Blue Book v5.0 r6.5, gold baseline ~$2,850,
 * markup context ~2.5x. See UNVERIFIED_HISTORICAL_CONTEXT. The engine must
 * not read those values unless the founder supplies them on this quote.
 *
 * Fail closed when source semantics, gold-sensitive weight, dated gold,
 * or markup rules are missing or contradictory.
 */

export const UNVERIFIED_HISTORICAL_CONTEXT = {
  status: "unverified_not_live_default",
  sourceFamilyHint: "geller_blue_book",
  softwareHint: "edge",
  editionHint: "v5.0 r6.5",
  goldBaselineUsdPerOzHint: 2850,
  markupMultipleHint: 2.5,
} as const;

export const REPAIR_QUOTE_SOURCE_FAMILY = "founder_transcribed_blue_book" as const;

export const SOURCE_PRICE_SEMANTICS = [
  "shop_cost",
  "suggested_retail",
] as const;

export type SourcePriceSemantics = (typeof SOURCE_PRICE_SEMANTICS)[number];

export const GOLD_INPUT_SOURCES = ["founder_manual"] as const;

export type GoldInputSource = (typeof GOLD_INPUT_SOURCES)[number];

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

export const GOLD_WEIGHT_KINDS = ["fine_dwt", "alloy_dwt"] as const;

export type GoldWeightKind = (typeof GOLD_WEIGHT_KINDS)[number];

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

export const GOLD_STALE_AFTER_DAYS = 1;
export const TROY_OZ_TO_DWT = 20;
export const MARKUP_PERMYRIAD_ONE = 10_000;
export const SOURCE_EDITION_MAX = 120;
export const SOURCE_LINE_REF_MAX = 80;
export const SOURCE_LINE_LABEL_MAX = 160;
export const OVERRIDE_REASON_MAX = 240;
export const CREATED_BY_MAX = 80;

export const GOLD_KARAT_BY_METAL: Record<
  RepairMetalFamily,
  10 | 14 | 18 | null
> = {
  gold_10k: 10,
  gold_14k: 14,
  gold_18k: 18,
  platinum: null,
  other: null,
};

/**
 * Default gold-sensitivity policy. Founder may override, but platinum cannot
 * be marked gold-sensitive. Laser and reset default to labor-only.
 */
export const REPAIR_TYPE_GOLD_POLICY: Record<
  RepairQuoteType,
  "gold_sensitive" | "not_gold_sensitive" | "metal_dependent"
> = {
  sizing: "metal_dependent",
  head_prong_replacement: "metal_dependent",
  laser_work: "not_gold_sensitive",
  stone_reset: "not_gold_sensitive",
  platinum_labor: "not_gold_sensitive",
  fourteen_k_operation: "gold_sensitive",
};

export type RepairQuoteLineInput = {
  sourceLineRef: string;
  sourceLineLabel: string;
  sourceAmountCents: number;
  goldSensitive: boolean;
  goldWeightKind?: GoldWeightKind | null;
  goldWeightMillidwt?: number | null;
  manualMetalDeltaCents?: number | null;
};

export type RepairQuoteGoldInput = {
  usdCentsPerTroyOz: number;
  asOfDate: string;
  source: GoldInputSource;
  baselineUsdCentsPerTroyOz: number | null;
};

export type RepairQuoteCalculationInput = {
  repairType: RepairQuoteType;
  metalFamily: RepairMetalFamily;
  sourceEditionLabel: string;
  sourcePriceSemantics: SourcePriceSemantics;
  gold: RepairQuoteGoldInput;
  markupRatioPermyriad: number | null;
  lines: RepairQuoteLineInput[];
  quoteDate: string;
  overrideAmountCents?: number | null;
  overrideReason?: string | null;
};

export type RepairQuoteLineResult = {
  sourceLineRef: string;
  sourceLineLabel: string;
  sourceAmountCents: number;
  goldSensitive: boolean;
  goldWeightKind: GoldWeightKind | null;
  goldWeightMillidwt: number | null;
  fineGoldMillidwt: number | null;
  metalDeltaCents: number;
  adjustedSourceCents: number;
};

export type RepairQuoteWarning = "stale-gold";

export type RepairQuoteCalculation = {
  sourceFamily: typeof REPAIR_QUOTE_SOURCE_FAMILY;
  sourceEditionLabel: string;
  sourcePriceSemantics: SourcePriceSemantics;
  goldUsdCentsPerTroyOz: number;
  goldAsOfDate: string;
  goldInputSource: GoldInputSource;
  goldBaselineUsdCentsPerTroyOz: number | null;
  markupRatioPermyriad: number | null;
  lines: RepairQuoteLineResult[];
  sourceAmountTotalCents: number;
  metalDeltaTotalCents: number;
  adjustedSourceTotalCents: number;
  computedHourglassQuoteCents: number;
  hourglassQuoteCents: number;
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
  sourcePriceSemantics: SourcePriceSemantics;
  goldUsdCentsPerTroyOz: number;
  goldAsOfDate: string;
  goldInputSource: GoldInputSource;
  goldBaselineUsdCentsPerTroyOz: number | null;
  markupRatioPermyriad: number | null;
  lines: RepairQuoteLineResult[];
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
  priorHourglassQuoteCents: number | null;
  newHourglassQuoteCents: number | null;
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
  | "missing-source-semantics"
  | "invalid-source-semantics"
  | "invalid-source-line"
  | "invalid-source-amount"
  | "missing-lines"
  | "invalid-gold-input"
  | "missing-gold-baseline"
  | "missing-gold-weight"
  | "invalid-gold-weight"
  | "platinum-is-not-gold"
  | "double-material-adjustment"
  | "double-markup-blocked"
  | "missing-markup"
  | "invalid-markup"
  | "invalid-override"
  | "issued-quote-immutable"
  | "voided-quote-immutable"
  | "not-draft"
  | "wrong-project"
  | "project-not-repair"
  | "person-not-on-project"
  | "historical-default-blocked";
