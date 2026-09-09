/**
 * Issue, override, and void repair quotes.
 * Issued quotes are immutable. Recalculation must create a new draft.
 */

import { calculateRepairQuote } from "./calculate";
import {
  isRepairQuoteUuid,
  parseCreatedBy,
  parseOverrideReason,
} from "./validate";
import type {
  RepairQuote,
  RepairQuoteInvalidCode,
  RepairQuoteManualOverride,
  RepairQuoteMutationAction,
  RepairQuoteMutationRecord,
} from "./types";

export type MutateRepairQuoteResult =
  | { ok: true; status: "applied" | "already-present"; quote: RepairQuote }
  | {
      ok: false;
      reason: "invalid-input" | "quote-not-found" | "project-not-found" | "unavailable";
      code?: RepairQuoteInvalidCode;
    };

export type ApplyRepairQuoteMutationInput = {
  mutation: RepairQuoteMutationRecord;
  next: RepairQuote;
};

export type ApplyRepairQuoteMutationResult = {
  status: "applied" | "already-present";
  quote: RepairQuote;
};

export type MutateRepairQuoteDeps = {
  nowIso: () => string;
  getQuote: (quoteId: string) => Promise<RepairQuote | null>;
  findByMutationId: (mutationId: string) => Promise<RepairQuote | null>;
  applyMutation: (
    input: ApplyRepairQuoteMutationInput,
  ) => Promise<ApplyRepairQuoteMutationResult>;
};

function invalid(code: RepairQuoteInvalidCode): Extract<MutateRepairQuoteResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

function mutation(
  input: {
    mutationId: string;
    quote: RepairQuote;
    action: RepairQuoteMutationAction;
    next: RepairQuote;
    changedBy: string;
    changedAt: string;
  },
): RepairQuoteMutationRecord {
  return {
    mutationId: input.mutationId,
    quoteId: input.quote.quoteId,
    projectId: input.quote.projectId,
    action: input.action,
    priorState: input.quote.state,
    newState: input.next.state,
    priorHourglassQuoteEighthCents: input.quote.calculation.hourglassQuoteEighthCents,
    newHourglassQuoteEighthCents: input.next.calculation.hourglassQuoteEighthCents,
    changedAt: input.changedAt,
    changedBy: input.changedBy,
  };
}

export async function issueRepairQuote(
  deps: MutateRepairQuoteDeps,
  input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  },
): Promise<MutateRepairQuoteResult> {
  return mutate(deps, input, (quote, now, actor) => {
    if (quote.state === "issued") return invalid("issued-quote-immutable");
    if (quote.state === "voided") return invalid("voided-quote-immutable");
    if (quote.state !== "draft") return invalid("not-draft");
    const next: RepairQuote = {
      ...quote,
      state: "issued",
      issuedAt: now,
      issuedBy: actor,
      issuedMutationId: input.mutationId,
      updatedAt: now,
    };
    return { action: "issue", next };
  });
}

export async function overrideRepairQuote(
  deps: MutateRepairQuoteDeps,
  input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    amountCents: number;
    reason: string;
    actor: string;
  },
): Promise<MutateRepairQuoteResult> {
  return mutate(deps, input, (quote, now, actor) => {
    if (quote.state === "issued") return invalid("issued-quote-immutable");
    if (quote.state === "voided") return invalid("voided-quote-immutable");
    if (quote.state !== "draft") return invalid("not-draft");
    const reason = parseOverrideReason(input.reason);
    if (!reason || !Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      return invalid("invalid-override");
    }
    const override: RepairQuoteManualOverride = {
      amountCents: input.amountCents,
      reason,
      overriddenBy: actor,
      overriddenAt: now,
    };
    const recalculated = calculateRepairQuote({
      repairType: quote.repairType,
      metalFamily: quote.metalFamily,
      line: {
        sku: quote.line.sku,
        taskDescription: quote.line.taskDescription,
        amounts: quote.line.amounts,
        metalBand: quote.line.metalBand,
        hasExplicitMetalQuantity: quote.line.hasExplicitMetalQuantity,
        inventedMetalQuantity: false,
        expressSelected: false,
        metalSensitive: quote.line.metalSensitive,
        goldUsdPerOz: quote.line.goldUsdPerOz,
        millidwt: quote.line.millidwt,
        costBasis: "geller_cost_columns",
      },
      overrideAmountCents: input.amountCents,
      overrideReason: reason,
    });
    if (!recalculated.ok) return invalid(recalculated.code);
    const next: RepairQuote = {
      ...quote,
      override,
      calculation: recalculated.calculation,
      updatedAt: now,
    };
    return { action: "override", next };
  });
}

export async function voidRepairQuote(
  deps: MutateRepairQuoteDeps,
  input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  },
): Promise<MutateRepairQuoteResult> {
  return mutate(deps, input, (quote, now, actor) => {
    if (quote.state === "voided") return invalid("voided-quote-immutable");
    if (quote.state !== "issued" && quote.state !== "draft") {
      return invalid("not-draft");
    }
    const next: RepairQuote = {
      ...quote,
      state: "voided",
      voidedAt: now,
      voidedBy: actor,
      updatedAt: now,
    };
    return { action: "void", next };
  });
}

async function mutate(
  deps: MutateRepairQuoteDeps,
  input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  },
  build: (
    quote: RepairQuote,
    now: string,
    actor: string,
  ) =>
    | { action: RepairQuoteMutationAction; next: RepairQuote }
    | Extract<MutateRepairQuoteResult, { ok: false }>,
): Promise<MutateRepairQuoteResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  const quoteId = input.quoteId.trim();
  if (
    !isRepairQuoteUuid(mutationId) ||
    !isRepairQuoteUuid(projectId) ||
    !isRepairQuoteUuid(quoteId)
  ) {
    return invalid("invalid-id");
  }
  const actor = parseCreatedBy(input.actor);
  if (!actor) return invalid("invalid-id");
  try {
    const existingMutation = await deps.findByMutationId(mutationId);
    if (existingMutation) {
      return { ok: true, status: "already-present", quote: existingMutation };
    }
    const quote = await deps.getQuote(quoteId);
    if (!quote) return { ok: false, reason: "quote-not-found" };
    if (quote.projectId !== projectId) return invalid("wrong-project");
    const now = deps.nowIso();
    const built = build(quote, now, actor);
    if ("ok" in built) return built;
    const result = await deps.applyMutation({
      mutation: mutation({
        mutationId,
        quote,
        action: built.action,
        next: built.next,
        changedBy: actor,
        changedAt: now,
      }),
      next: built.next,
    });
    return { ok: true, status: result.status, quote: result.quote };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
