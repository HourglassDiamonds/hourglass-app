"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedRepairQuoteWriter } from "@/lib/continuum/repair-quoting/load-writer";
import { defaultGoldSensitive } from "@/lib/continuum/repair-quoting/calculate";
import { lineFromForm } from "@/lib/continuum/repair-quoting/create";
import type { CreateRepairQuoteResult } from "@/lib/continuum/repair-quoting/create";
import type { MutateRepairQuoteResult } from "@/lib/continuum/repair-quoting/mutate";
import {
  parseMarkupRatioPermyriad,
  parseUsdCentsField,
  parseWeightMillidwt,
} from "@/lib/continuum/repair-quoting/validate";
import {
  conciergeRepairQuotePath,
  conciergeRepairQuotesPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { RepairMetalFamily, RepairQuoteType } from "@/lib/continuum/repair-quoting/types";

export type SaveRepairQuoteState = { ok: false; message: string } | null;

function humanCreateMessage(result: CreateRepairQuoteResult): string {
  if (result.ok) return "Unable to save the repair quote.";
  if (result.code === "missing-source-semantics") {
    return "Choose whether the book number is shop cost or suggested retail.";
  }
  if (result.code === "double-markup-blocked") {
    return "Suggested retail cannot take extra markup.";
  }
  if (result.code === "missing-gold-baseline" || result.code === "missing-gold-weight") {
    return "Gold-sensitive work needs a dated gold input, baseline, and weight.";
  }
  if (result.code === "platinum-is-not-gold") {
    return "Platinum does not adjust with gold. Use a manual metal delta if needed.";
  }
  if (result.code === "project-not-repair") {
    return "Repair quotes are only for Repair / Service projects.";
  }
  if (result.reason === "project-not-found" || result.reason === "entity-kind-mismatch") {
    return "That project could not be found.";
  }
  return "Unable to save the repair quote.";
}

function humanMutateMessage(result: MutateRepairQuoteResult): string {
  if (result.ok) return "Unable to update the repair quote.";
  if (result.code === "issued-quote-immutable") {
    return "Issued quotes stay frozen. Create a new quote instead of repricing.";
  }
  if (result.code === "invalid-override") {
    return "Add an override amount and reason.";
  }
  return "Unable to update the repair quote.";
}

export async function saveRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const repairType = String(formData.get("repairType") ?? "").trim() as RepairQuoteType;
  const metalFamily = String(formData.get("metalFamily") ?? "").trim() as RepairMetalFamily;
  const goldSensitiveField = String(formData.get("goldSensitive") ?? "").trim();
  const goldSensitive =
    goldSensitiveField === "yes"
      ? true
      : goldSensitiveField === "no"
        ? false
        : defaultGoldSensitive({ repairType, metalFamily });
  const result = await auth.writer.createQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    repairType,
    metalFamily,
    associatedPersonId: String(formData.get("associatedPersonId") ?? "").trim() || null,
    sourceEditionLabel: String(formData.get("sourceEditionLabel") ?? ""),
    sourcePriceSemantics: String(formData.get("sourcePriceSemantics") ?? "").trim(),
    goldUsdCentsPerTroyOz: parseUsdCentsField(String(formData.get("goldUsd") ?? "")) ?? 0,
    goldAsOfDate: String(formData.get("goldAsOfDate") ?? "").trim(),
    goldInputSource: "founder_manual",
    goldBaselineUsdCentsPerTroyOz: parseUsdCentsField(
      String(formData.get("goldBaselineUsd") ?? ""),
    ),
    markupRatioPermyriad: parseMarkupRatioPermyriad(
      String(formData.get("markupMultiple") ?? ""),
    ),
    lines: [
      lineFromForm({
        sourceLineRef: String(formData.get("sourceLineRef") ?? ""),
        sourceLineLabel: String(formData.get("sourceLineLabel") ?? ""),
        sourceAmountCents: parseUsdCentsField(String(formData.get("sourceAmount") ?? "")) ?? 0,
        goldSensitive,
        goldWeightKind: String(formData.get("goldWeightKind") ?? "").trim() || null,
        goldWeightMillidwt: parseWeightMillidwt(String(formData.get("goldWeightDwt") ?? "")),
        manualMetalDeltaCents: parseUsdCentsField(
          String(formData.get("manualMetalDelta") ?? ""),
        ),
      }),
    ],
    overrideAmountCents: parseUsdCentsField(String(formData.get("overrideAmount") ?? "")),
    overrideReason: String(formData.get("overrideReason") ?? "").trim() || null,
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, result.quote.quoteId)}?saved=quote`);
  }
  return { ok: false, message: humanCreateMessage(result) };
}

export async function issueSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to issue the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const result = await auth.writer.issueQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId,
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, quoteId)}?saved=issued`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}

export async function overrideSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to override the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const amountCents = parseUsdCentsField(String(formData.get("overrideAmount") ?? ""));
  if (amountCents == null) {
    return { ok: false, message: "Add an override amount and reason." };
  }
  const result = await auth.writer.overrideQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId,
    amountCents,
    reason: String(formData.get("overrideReason") ?? ""),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, quoteId)}?saved=override`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}

export async function voidSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to void the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await auth.writer.voidQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId: String(formData.get("quoteId") ?? "").trim(),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotesPath(projectId)}?saved=voided`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}
