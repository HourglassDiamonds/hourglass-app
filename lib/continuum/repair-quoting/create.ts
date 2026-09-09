/**
 * Create a project-linked repair quote draft.
 * Does not infer prices from operating details, notes, or Gmail.
 */

import type { ClientMemoryEntity, PersonProfile, ProjectProfile } from "@/lib/continuum/client-memory/types";
import { calculateRepairQuote } from "./calculate";
import {
  isGoldInputSource,
  isGoldWeightKind,
  isRepairMetalFamily,
  isRepairQuoteType,
  isRepairQuoteUuid,
  isSourcePriceSemantics,
  parseCreatedBy,
  parseOverrideReason,
  parseRequiredDate,
  parseSourceEdition,
  parseSourceLineLabel,
  parseSourceLineRef,
} from "./validate";
import type {
  GoldWeightKind,
  RepairQuote,
  RepairQuoteInvalidCode,
  RepairQuoteLineInput,
} from "./types";

export type CreateRepairQuoteInput = {
  mutationId: string;
  projectId: string;
  repairType: string;
  metalFamily: string;
  associatedPersonId?: string | null;
  sourceEditionLabel: string;
  sourcePriceSemantics: string;
  goldUsdCentsPerTroyOz: number;
  goldAsOfDate: string;
  goldInputSource: string;
  goldBaselineUsdCentsPerTroyOz: number | null;
  markupRatioPermyriad: number | null;
  lines: RepairQuoteLineInput[];
  overrideAmountCents?: number | null;
  overrideReason?: string | null;
  actor: string;
};

export type CreateRepairQuoteResult =
  | { ok: true; status: "created" | "already-present"; quote: RepairQuote }
  | {
      ok: false;
      reason: "invalid-input" | "project-not-found" | "entity-kind-mismatch" | "unavailable";
      code?: RepairQuoteInvalidCode;
    };

export type CreateRepairQuoteDeps = {
  nowIso: () => string;
  newQuoteId: () => string;
  quoteDate: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  hasActiveClientProjectRelationship: (
    projectId: string,
    personId: string,
  ) => Promise<boolean>;
  nextQuoteNumber: (projectId: string) => Promise<number>;
  findByMutationId: (mutationId: string) => Promise<RepairQuote | null>;
  applyCreate: (quote: RepairQuote) => Promise<{ status: "created" | "already-present"; quote: RepairQuote }>;
};

function invalid(code: RepairQuoteInvalidCode): Extract<CreateRepairQuoteResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

export async function createRepairQuote(
  deps: CreateRepairQuoteDeps,
  input: CreateRepairQuoteInput,
): Promise<CreateRepairQuoteResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isRepairQuoteUuid(mutationId) || !isRepairQuoteUuid(projectId)) {
    return invalid("invalid-id");
  }
  if (!isRepairQuoteType(input.repairType)) return invalid("invalid-repair-type");
  if (!isRepairMetalFamily(input.metalFamily)) return invalid("invalid-metal");
  const sourceEdition = parseSourceEdition(input.sourceEditionLabel);
  if (!sourceEdition) return invalid("invalid-source-edition");
  if (!input.sourcePriceSemantics?.trim()) return invalid("missing-source-semantics");
  if (!isSourcePriceSemantics(input.sourcePriceSemantics)) {
    return invalid("invalid-source-semantics");
  }
  if (!isGoldInputSource(input.goldInputSource)) return invalid("invalid-gold-input");
  const goldAsOfDate = parseRequiredDate(input.goldAsOfDate);
  if (!goldAsOfDate) return invalid("invalid-gold-input");
  const createdBy = parseCreatedBy(input.actor);
  if (!createdBy) return invalid("invalid-id");
  const associatedPersonId = input.associatedPersonId?.trim() || null;
  if (associatedPersonId && !isRepairQuoteUuid(associatedPersonId)) {
    return invalid("invalid-id");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return invalid("missing-lines");
  }
  for (const line of input.lines) {
    if (!parseSourceLineRef(line.sourceLineRef) || !parseSourceLineLabel(line.sourceLineLabel)) {
      return invalid("invalid-source-line");
    }
    if (line.goldSensitive && line.goldWeightKind && !isGoldWeightKind(line.goldWeightKind)) {
      return invalid("invalid-gold-weight");
    }
  }

  const quoteDate = deps.quoteDate();
  const calculated = calculateRepairQuote({
    repairType: input.repairType,
    metalFamily: input.metalFamily,
    sourceEditionLabel: sourceEdition,
    sourcePriceSemantics: input.sourcePriceSemantics,
    gold: {
      usdCentsPerTroyOz: input.goldUsdCentsPerTroyOz,
      asOfDate: goldAsOfDate,
      source: input.goldInputSource,
      baselineUsdCentsPerTroyOz: input.goldBaselineUsdCentsPerTroyOz,
    },
    markupRatioPermyriad: input.markupRatioPermyriad,
    lines: input.lines,
    quoteDate,
    overrideAmountCents: input.overrideAmountCents ?? null,
    overrideReason: input.overrideReason ?? null,
  });
  if (!calculated.ok) return invalid(calculated.code);

  let override = null;
  if (input.overrideAmountCents != null) {
    const reason = parseOverrideReason(input.overrideReason);
    if (!reason) return invalid("invalid-override");
    override = {
      amountCents: input.overrideAmountCents,
      reason,
      overriddenBy: createdBy,
      overriddenAt: deps.nowIso(),
    };
  }

  try {
    const existing = await deps.findByMutationId(mutationId);
    if (existing) return { ok: true, status: "already-present", quote: existing };

    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") return { ok: false, reason: "entity-kind-mismatch" };
    const profile = await deps.getProjectProfile(projectId);
    if (!profile || profile.projectId !== projectId) {
      return { ok: false, reason: "project-not-found" };
    }
    if (profile.projectKind !== "repair_service") return invalid("project-not-repair");
    if (associatedPersonId) {
      const person = await deps.getPersonProfile(associatedPersonId);
      if (!person || person.personId !== associatedPersonId) {
        return invalid("person-not-on-project");
      }
      const linked = await deps.hasActiveClientProjectRelationship(
        projectId,
        associatedPersonId,
      );
      if (!linked) return invalid("person-not-on-project");
    }

    const now = deps.nowIso();
    const quote: RepairQuote = {
      quoteId: deps.newQuoteId(),
      projectId,
      quoteNumber: await deps.nextQuoteNumber(projectId),
      state: "draft",
      repairType: input.repairType,
      metalFamily: input.metalFamily,
      associatedPersonId,
      sourceEditionLabel: sourceEdition,
      sourcePriceSemantics: input.sourcePriceSemantics,
      goldUsdCentsPerTroyOz: input.goldUsdCentsPerTroyOz,
      goldAsOfDate,
      goldInputSource: input.goldInputSource,
      goldBaselineUsdCentsPerTroyOz: input.goldBaselineUsdCentsPerTroyOz,
      markupRatioPermyriad: calculated.calculation.markupRatioPermyriad,
      lines: calculated.calculation.lines,
      calculation: calculated.calculation,
      override,
      issuedAt: null,
      issuedBy: null,
      voidedAt: null,
      voidedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy,
      createdMutationId: mutationId,
      issuedMutationId: null,
    };
    const result = await deps.applyCreate(quote);
    return { ok: true, status: result.status, quote: result.quote };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    return { ok: false, reason: "unavailable" };
  }
}

export function lineFromForm(input: {
  sourceLineRef: string;
  sourceLineLabel: string;
  sourceAmountCents: number;
  goldSensitive: boolean;
  goldWeightKind?: string | null;
  goldWeightMillidwt?: number | null;
  manualMetalDeltaCents?: number | null;
}): RepairQuoteLineInput {
  return {
    sourceLineRef: input.sourceLineRef,
    sourceLineLabel: input.sourceLineLabel,
    sourceAmountCents: input.sourceAmountCents,
    goldSensitive: input.goldSensitive,
    goldWeightKind: (input.goldWeightKind as GoldWeightKind | null) ?? null,
    goldWeightMillidwt: input.goldWeightMillidwt ?? null,
    manualMetalDeltaCents: input.manualMetalDeltaCents ?? null,
  };
}
